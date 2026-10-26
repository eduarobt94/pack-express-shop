"""Access token JWT (HS256) — formato idéntico al de la API PHP: los tokens de uno valen en el otro.

Reglas: algoritmo fijado (rechaza alg=none y similares), `exp` obligatorio, `typ=access`,
`ver` = users.token_version (permite revocar todas las sesiones al cambiar la contraseña).
El refresh token NO es un JWT: es opaco, se guarda como SHA-256 y rota (ver services/sessions.py).
"""

from __future__ import annotations

import re
import time
from typing import Any

import jwt

from app.config import get_settings

_BEARER = re.compile(r"^Bearer\s+([A-Za-z0-9_\-.]{20,2048})$")


def encode_access(user_id: int, token_version: int) -> str:
    s = get_settings()
    now = int(time.time())
    payload = {"sub": int(user_id), "ver": int(token_version), "typ": "access", "iat": now, "exp": now + s.jwt_expiry}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def decode_access(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp"], "verify_sub": False},  # PHP emite `sub` entero
        )
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "access" or not str(payload.get("sub", "")).isdigit():
        return None
    return payload


def bearer_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    m = _BEARER.match(authorization)
    return m.group(1) if m else None
