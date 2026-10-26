"""Hash de contraseñas.

Verifica los hashes existentes ($2y$ de PHP/bcrypt y $argon2id$) y escribe según PASSWORD_ALGO:
- bcrypt cost 12 (por defecto: compatible con el backend PHP mientras exista la posibilidad de volver atrás)
- argon2id (tras el corte definitivo)
Rehash transparente en el login. Se guarda el prefijo $2y$ (el que usa PHP) en lugar de $2b$ de la librería.
"""

from __future__ import annotations

import secrets

import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings

_ARGON = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)
_BCRYPT_COST = 12
_dummy: str | None = None


def hash_password(plain: str) -> str:
    if get_settings().password_algo == "argon2id":  # noqa: S105
        return _ARGON.hash(plain)
    raw = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_COST)).decode("ascii")
    return "$2y$" + raw[4:]


def verify_password(plain: str, hashed: str) -> bool:
    try:
        if hashed.startswith("$argon2"):
            return _ARGON.verify(hashed, plain)
        if hashed.startswith(("$2y$", "$2a$", "$2b$")):
            return bcrypt.checkpw(plain.encode("utf-8")[:72], ("$2b$" + hashed[4:]).encode("ascii"))
    except (VerificationError, InvalidHashError, ValueError):
        return False
    return False


def needs_rehash(hashed: str) -> bool:
    if get_settings().password_algo == "argon2id":  # noqa: S105
        return not hashed.startswith("$argon2id$") or _ARGON.check_needs_rehash(hashed)
    if hashed.startswith("$2"):
        try:
            return int(hashed.split("$")[2]) < _BCRYPT_COST
        except (IndexError, ValueError):
            return True
    return True


def dummy_hash() -> str:
    """Hash ficticio: se verifica contra él cuando el usuario no existe, para igualar los tiempos."""
    global _dummy  # noqa: PLW0603
    if _dummy is None:
        _dummy = hash_password("dummy-" + secrets.token_hex(8))
    return _dummy
