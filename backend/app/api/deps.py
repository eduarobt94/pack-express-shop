"""Dependencias de FastAPI: base de datos por petición, autenticación, roles y rate limiting."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Any

from fastapi import Depends, Request

from app.config import get_settings
from app.core import ratelimit, tokens
from app.core.errors import ApiError
from app.core.logging import log
from app.core.network import client_ip
from app.db import Db, new_db


def get_db() -> Iterator[Db]:
    yield from new_db()


def current_user(request: Request, db: Db = Depends(get_db)) -> dict[str, Any]:
    """Usuario autenticado. Se recarga de la base en CADA petición: rol, estado y token_version son los vigentes,
    de modo que suspender a un usuario o cambiarle el rol/contraseña surte efecto de inmediato."""
    token = tokens.bearer_from_header(request.headers.get("authorization"))
    if not token:
        raise ApiError.unauthorized("Token de acceso requerido")
    payload = tokens.decode_access(token)
    if not payload:
        raise ApiError.unauthorized("Token inválido o expirado")

    user = db.one("SELECT id, name, email, role, status, token_version FROM users WHERE id = :i", {"i": int(payload["sub"])})
    if not user or user["status"] != "active" or int(user["token_version"]) != int(payload.get("ver", -1)):
        raise ApiError.unauthorized("Sesión inválida o revocada")

    db.set_actor(int(user["id"]))  # el historial de estados (triggers) atribuye los cambios a este usuario
    request.state.user = user
    return user


def _roles(*allowed: str) -> Callable[..., dict[str, Any]]:
    def dependency(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] not in allowed:
            raise ApiError.forbidden("Permisos insuficientes")
        return user

    return dependency


require_staff = _roles("agent", "admin")
require_warehouse = _roles("warehouse", "agent", "admin")
require_admin = _roles("admin")


def _route(request: Request) -> str:
    return f"{request.method} {request.url.path}"


def _too_many(window: int, route: str, scope: str, **ctx: Any) -> ApiError:
    log.warning("rate_limited", route=route, scope=scope, **ctx)
    return ApiError(429, "Demasiadas solicitudes. Intentá nuevamente en breve.", headers={"Retry-After": str(window)})


def rate_limit_general(request: Request, db: Db = Depends(get_db)) -> None:
    s = get_settings()
    route = _route(request)
    if not ratelimit.hit(db, "global", f"{client_ip(request)}|{route}", s.rate_limit_requests, s.rate_limit_window):
        raise _too_many(s.rate_limit_window, route, "global")


def rate_limit_auth(request: Request, db: Db = Depends(get_db)) -> None:
    """Autenticación: AUTH_RATE_LIMIT intentos por minuto por IP y endpoint."""
    route = _route(request)
    if not ratelimit.hit(db, "auth", f"{client_ip(request)}|{route}", get_settings().auth_rate_limit, 60):
        raise _too_many(60, route, "auth")


def rate_limit_sensitive(request: Request, user: dict[str, Any] = Depends(current_user), db: Db = Depends(get_db)) -> None:
    """Operaciones sensibles (cargas, pagos, emisión): 20 por minuto y POR USUARIO. Va después de la autenticación."""
    route = _route(request)
    if not ratelimit.hit(db, "sensitive", f"u{user['id']}|{route}", 20, 60):
        raise _too_many(60, route, "sensitive", user_id=int(user["id"]))
