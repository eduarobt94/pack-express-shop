"""Sesiones: access JWT corto + refresh token OPACO con rotación (mismas tablas y semántica que la API PHP).

- El refresh token se guarda como SHA-256; la base nunca contiene un valor utilizable.
- Cada uso lo rota. Si se presenta uno ya usado (robo/replay) se revoca TODA la familia.
- Cambiar/restablecer la contraseña incrementa users.token_version y revoca los refresh tokens.
- La caducidad se compara en SQL (NOW()): PHP/Python y la base pueden estar en zonas horarias distintas.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from typing import Any

from app.config import get_settings
from app.core import tokens
from app.core.logging import log
from app.db import Db

_REFRESH = re.compile(r"^[a-f0-9]{64}$")


def issue(db: Db, user: dict[str, Any], ip: str, family_id: str | None = None) -> dict[str, Any]:
    s = get_settings()
    refresh = secrets.token_hex(32)
    db.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, created_ip) "
        "VALUES (:u, :h, :f, DATE_ADD(NOW(), INTERVAL :ttl SECOND), :ip)",
        {
            "u": int(user["id"]),
            "h": hashlib.sha256(refresh.encode()).hexdigest(),
            "f": family_id or secrets.token_hex(16),
            "ttl": s.jwt_refresh_expiry,
            "ip": ip[:45],
        },
    )
    return {
        "token": tokens.encode_access(int(user["id"]), int(user["token_version"])),
        "refresh_token": refresh,
        "expires_in": s.jwt_expiry,
    }


def rotate(db: Db, refresh: str, ip: str) -> dict[str, Any] | None:
    """Valida y rota un refresh token. Devuelve {'user', 'tokens'} o None."""
    if not _REFRESH.match(refresh):
        return None
    digest = hashlib.sha256(refresh.encode()).hexdigest()
    with db.tx():
        row = db.one(
            "SELECT id, user_id, family_id, (expires_at > NOW()) AS still_valid, revoked_at "
            "FROM refresh_tokens WHERE token_hash = :h FOR UPDATE",
            {"h": digest},
        )
        if not row:
            return None
        if row["revoked_at"] is not None:  # reutilización: se revoca la familia completa
            db.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = :f AND revoked_at IS NULL", {"f": row["family_id"]})
            log.warning("refresh_reuse_detected", user_id=int(row["user_id"]))
            return None
        if int(row["still_valid"]) != 1:
            return None
        user = db.one("SELECT id, name, email, role, status, token_version FROM users WHERE id = :u", {"u": int(row["user_id"])})
        if not user or user["status"] != "active":
            return None
        db.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = :i", {"i": int(row["id"])})
        return {"user": user, "tokens": issue(db, user, ip, row["family_id"])}


def revoke_family_of(db: Db, refresh: str) -> None:
    if not _REFRESH.match(refresh):
        return
    row = db.one("SELECT family_id FROM refresh_tokens WHERE token_hash = :h", {"h": hashlib.sha256(refresh.encode()).hexdigest()})
    if row:
        db.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = :f AND revoked_at IS NULL", {"f": row["family_id"]})


def revoke_all(db: Db, user_id: int) -> None:
    """Cierra TODAS las sesiones del usuario (cambio o reseteo de contraseña)."""
    db.execute("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = :u AND revoked_at IS NULL", {"u": user_id})
    db.execute("UPDATE users SET token_version = token_version + 1 WHERE id = :u", {"u": user_id})
