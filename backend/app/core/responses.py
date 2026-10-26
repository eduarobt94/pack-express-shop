"""Respuestas JSON con el mismo envoltorio y serialización que la API PHP.

Serialización compatible: DECIMAL → string ("500.00"), DATETIME → "AAAA-MM-DD HH:MM:SS", DATE → "AAAA-MM-DD",
JSON sin escapar Unicode ni barras. Todas las respuestas JSON llevan Cache-Control: no-store.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from starlette.responses import Response


def _default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray, memoryview)):
        raise TypeError("datos binarios no serializables")
    raise TypeError(f"no serializable: {type(value)!r}")


class ApiResponse(Response):
    media_type = "application/json"

    def __init__(self, content: Any, status_code: int = 200, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(content, ensure_ascii=False, separators=(",", ":"), default=_default).encode("utf-8")
        super().__init__(body, status_code, headers, "application/json; charset=utf-8")
        self.headers["Cache-Control"] = "no-store"


def ok(data: Any = None, message: str = "ok") -> ApiResponse:
    return ApiResponse({"success": True, "message": message, "data": data})


def created(data: Any = None, message: str = "created") -> ApiResponse:
    return ApiResponse({"success": True, "message": message, "data": data}, 201)


def error_body(message: str, errors: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"success": False, "message": message}
    if errors:
        body["errors"] = errors
    return body
