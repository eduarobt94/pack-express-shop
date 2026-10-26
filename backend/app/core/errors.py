"""Errores de dominio y su traducción al contrato JSON de la API (mismo formato que la API PHP)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.exc import DBAPIError

from app.core.logging import log


class ApiError(Exception):
    """Respuesta de error controlada: {"success": false, "message": ..., "errors"?: ...}."""

    def __init__(self, status: int, message: str, errors: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors
        self.headers = headers or {}

    @classmethod
    def unauthorized(cls, message: str = "Unauthorized") -> ApiError:
        return cls(401, message)

    @classmethod
    def forbidden(cls, message: str = "Forbidden") -> ApiError:
        return cls(403, message)

    @classmethod
    def not_found(cls, message: str = "Not found") -> ApiError:
        return cls(404, message)


# Errores de la base de datos → respuesta. PyMySQL no expone SQLSTATE, se mapea por código de error.
_TRIGGER = 1644  # SIGNAL SQLSTATE '45000' de las reglas de negocio de la base
_INTEGRITY = {1062, 1451, 1452, 4025, 1048, 1216, 1217, 3819}  # duplicado, FK, CHECK, NOT NULL
_RANGE = {1264, 1292, 1265, 1406, 1366}


def db_error_code(exc: DBAPIError) -> tuple[int, str]:
    args: tuple[Any, ...] = tuple(getattr(exc.orig, "args", ()))
    code = int(args[0]) if args and isinstance(args[0], int) else 0
    msg = str(args[1]) if len(args) > 1 else str(exc.orig)
    return code, msg


def raise_db_error(exc: DBAPIError) -> None:
    """Traduce los errores deliberados de los triggers (mensajes ya en español) y los de integridad."""
    code, msg = db_error_code(exc)
    if code == _TRIGGER:
        raise ApiError(409, msg) from exc
    if code in _INTEGRITY:
        raise ApiError(409, "La operación viola una restricción de integridad") from exc
    if code in _RANGE:
        raise ApiError(422, "Valor fuera de rango") from exc
    log.error("db_error", code=code, msg=msg)
    raise ApiError(500, "Error interno del servidor") from exc
