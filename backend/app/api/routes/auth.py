"""Autenticación: /auth/login, register, refresh, logout, forgot-password, reset-password.

Mantiene el contrato de la API PHP (rutas, códigos de estado, forma de las respuestas).
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.exc import DBAPIError

from app.api.deps import get_db, rate_limit_auth
from app.config import get_settings
from app.core import passwords, ratelimit
from app.core.errors import ApiError, db_error_code, raise_db_error
from app.core.logging import log
from app.core.network import client_ip
from app.core.responses import ApiResponse, created, ok
from app.db import Db
from app.schemas import ForgotIn, LoginIn, RegisterIn, ResetIn, TokenIn
from app.services import mailer, sessions

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(rate_limit_auth)])

nl = chr(10)
MAX_FAILED = 5  # intentos fallidos antes de bloquear la cuenta
LOCK_MINUTES = 15


def _public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {"id": int(u["id"]), "name": u["name"], "email": u["email"], "role": u["role"], "suite_id": u.get("suite_id")}


@router.post("/login")
def login(body: LoginIn, request: Request, db: Db = Depends(get_db)) -> ApiResponse:
    assert body.email and body.password
    email = body.email.lower()

    # Límite por cuenta (además del límite por IP): frena el relleno de credenciales.
    if not ratelimit.hit(db, "login-account", email, 8, 900):
        raise ApiError(429, "Demasiados intentos. Intentá más tarde.", headers={"Retry-After": "900"})

    user = db.one(
        "SELECT u.id, u.name, u.email, u.role, u.status, u.password_hash, u.token_version, u.failed_logins, "
        "(u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked, s.suite_id "
        "FROM users u LEFT JOIN suites s ON s.user_id = u.id WHERE u.email = :e LIMIT 1",
        {"e": email},
    )

    # Se verifica SIEMPRE un hash (real o ficticio): el tiempo no revela si el email existe.
    matches = passwords.verify_password(body.password, user["password_hash"] if user else passwords.dummy_hash())
    locked = bool(user and int(user["is_locked"]) == 1)

    if not user or not matches or user["status"] != "active" or locked:
        if user and not locked:
            db.execute(
                "UPDATE users SET locked_until = IF(failed_logins + 1 >= :m, DATE_ADD(NOW(), INTERVAL :l MINUTE), locked_until), "
                "failed_logins = failed_logins + 1 WHERE id = :i",
                {"m": MAX_FAILED, "l": LOCK_MINUTES, "i": int(user["id"])},
            )
        log.warning("login_failed", user_id=user["id"] if user else None, locked=locked)
        raise ApiError(401, "Credenciales incorrectas")  # mismo mensaje en todos los casos

    db.execute("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = :i", {"i": int(user["id"])})
    if passwords.needs_rehash(user["password_hash"]):
        db.execute("UPDATE users SET password_hash = :h WHERE id = :i", {"h": passwords.hash_password(body.password), "i": int(user["id"])})

    log.audit("login", int(user["id"]))
    return ok({**sessions.issue(db, user, client_ip(request)), "user": _public_user(user)}, "Login exitoso")


@router.post("/register")
def register(body: RegisterIn, request: Request, db: Db = Depends(get_db)) -> ApiResponse:
    assert body.name and body.email and body.password
    email = body.email.lower()
    if db.one("SELECT id FROM users WHERE email = :e", {"e": email}):
        raise ApiError(409, "No se pudo completar el registro con esos datos")

    # El rol siempre es "customer": nunca viene del cliente (anti mass-assignment).
    try:
        with db.tx():
            user_id = db.insert(
                "INSERT INTO users (name, email, phone, password_hash, status, role) VALUES (:n,:e,:p,:h,'active','customer')",
                {"n": body.name, "e": email, "p": body.phone, "h": passwords.hash_password(body.password)},
            )
            # Código personal del cliente (formato definitivo pendiente de Optimus)
            db.execute(
                "INSERT INTO suites (user_id, suite_id, country, member_since) VALUES (:u, :s, 'UY', CURDATE())",
                {"u": user_id, "s": f"OPT-UY-{user_id:06d}"},
            )
    except DBAPIError as exc:
        if db_error_code(exc)[0] == 1062:  # carrera: otro registro del mismo email ganó entre el SELECT y el INSERT
            raise ApiError(409, "No se pudo completar el registro con esos datos") from exc
        log.error("register_failed", error=str(exc.orig))
        raise ApiError(500, "Error al registrar usuario") from exc

    user = db.one(
        "SELECT u.id, u.name, u.email, u.role, u.token_version, s.suite_id FROM users u "
        "LEFT JOIN suites s ON s.user_id = u.id WHERE u.id = :i",
        {"i": user_id},
    )
    assert user
    log.audit("register", user_id)
    return created({**sessions.issue(db, user, client_ip(request)), "user": _public_user(user)}, "Registro exitoso")


@router.post("/refresh")
def refresh(body: TokenIn, request: Request, db: Db = Depends(get_db)) -> ApiResponse:
    if not body.refresh_token:
        raise ApiError(422, "refresh_token requerido")
    result = sessions.rotate(db, body.refresh_token, client_ip(request))
    if not result:
        raise ApiError.unauthorized("Token de refresco inválido o expirado")
    suite = db.one("SELECT suite_id FROM suites WHERE user_id = :u", {"u": int(result["user"]["id"])})
    user = {**result["user"], "suite_id": suite["suite_id"] if suite else None}
    return ok({**result["tokens"], "user": _public_user(user)}, "Token renovado")


@router.post("/logout")
def logout(body: TokenIn, db: Db = Depends(get_db)) -> ApiResponse:
    if body.refresh_token:
        sessions.revoke_family_of(db, body.refresh_token)
    return ok(None, "Sesión cerrada")


@router.post("/forgot-password")
def forgot_password(body: ForgotIn, background: BackgroundTasks, db: Db = Depends(get_db)) -> ApiResponse:
    assert body.email
    email = body.email.lower()
    message = "Si el email existe recibirás instrucciones para restablecer tu contraseña"  # siempre 200: sin enumeración
    if not ratelimit.hit(db, "forgot-account", email, 3, 3600):
        return ok(None, message)

    user = db.one("SELECT id FROM users WHERE email = :e AND status = 'active'", {"e": email})
    if user:
        token = secrets.token_hex(32)
        db.execute(
            "REPLACE INTO password_reset_tokens (email, token, expires_at, user_id) VALUES (:e, :t, DATE_ADD(NOW(), INTERVAL 1 HOUR), :u)",
            {"e": email, "t": hashlib.sha256(token.encode()).hexdigest(), "u": int(user["id"])},
        )
        # El envío va en segundo plano: el tiempo de respuesta no distingue cuentas existentes de inexistentes.
        link = f"{get_settings().app_url.rstrip('/')}/restablecer?token={token}"
        background.add_task(
            mailer.send,
            email,
            "Restablecé tu contraseña de Optimus Envíos",
            "Recibimos un pedido para restablecer tu contraseña." + nl * 2
            + f"Abrí este enlace (vale 1 hora y se usa una sola vez):{nl}{link}" + nl * 2
            + "Si no lo pediste vos, ignorá este mensaje: tu contraseña no cambia.",
        )
        log.info("password_reset_requested", user_id=int(user["id"]))  # el token en claro jamás se registra
    return ok(None, message)


@router.post("/reset-password")
def reset_password(body: ResetIn, db: Db = Depends(get_db)) -> ApiResponse:
    assert body.token and body.password
    try:
        with db.tx():
            record = db.one(
                "SELECT email, user_id FROM password_reset_tokens WHERE token = :t AND expires_at > NOW() FOR UPDATE",
                {"t": hashlib.sha256(body.token.encode()).hexdigest()},
            )
            if not record or not record["user_id"]:
                raise ApiError(400, "Token inválido o expirado")
            user_id = int(record["user_id"])
            db.execute(
                "UPDATE users SET password_hash = :h, failed_logins = 0, locked_until = NULL WHERE id = :i",
                {"h": passwords.hash_password(body.password), "i": int(record["user_id"])},
            )
            db.execute("DELETE FROM password_reset_tokens WHERE email = :e", {"e": record["email"]})
            sessions.revoke_all(db, int(record["user_id"]))  # cierra todas las sesiones abiertas
    except DBAPIError as exc:
        raise_db_error(exc)
    log.audit("password_reset", user_id)
    return ok(None, "Contraseña actualizada correctamente")
