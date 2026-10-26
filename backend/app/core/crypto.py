"""Cifrado en reposo AES-256-GCM, con el MISMO formato binario que la API PHP:
0x01 | iv(12) | tag(16) | ciphertext. Los datos cifrados por un backend los lee el otro (reversión segura).
"""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

_VERSION = b"\x01"


def _key() -> bytes:
    try:
        key = base64.b64decode(get_settings().data_enc_key, validate=True)
    except Exception as exc:
        raise RuntimeError("DATA_ENC_KEY no configurada (32 bytes en base64)") from exc
    if len(key) != 32:
        raise RuntimeError("DATA_ENC_KEY no configurada (32 bytes en base64)")
    return key


def encrypt(plain: str) -> bytes:
    iv = os.urandom(12)
    sealed = AESGCM(_key()).encrypt(iv, plain.encode("utf-8"), None)  # ciphertext || tag(16)
    ciphertext, tag = sealed[:-16], sealed[-16:]
    return _VERSION + iv + tag + ciphertext


def decrypt(blob: bytes) -> str | None:
    if len(blob) < 30 or blob[:1] != _VERSION:
        return None
    iv, tag, ciphertext = blob[1:13], blob[13:29], blob[29:]
    try:
        return AESGCM(_key()).decrypt(iv, ciphertext + tag, None).decode("utf-8")
    except (InvalidTag, UnicodeDecodeError):
        return None
