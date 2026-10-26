"""Compatibilidad PHP ↔ Python: lo que escribe un backend lo lee el otro (condición de una reversión segura).

Requiere el binario `php` en el PATH; si no está, las pruebas se omiten.
"""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

from app.config import get_settings
from app.core import crypto, passwords, tokens

API = Path(__file__).resolve().parents[2] / "api" / "v1"
PHP = shutil.which("php")
pytestmark = pytest.mark.skipif(PHP is None, reason="php no disponible")


def php(code: str, **env: str) -> str:
    """Ejecuta PHP con las clases reales del backend original y devuelve su salida."""
    prelude = (
        f"require '{API.as_posix()}/config/app.php'; require '{API.as_posix()}/core/JWT.php'; "
        f"require '{API.as_posix()}/core/Crypto.php'; require '{API.as_posix()}/core/Passwords.php';"
    )
    out = subprocess.run(
        [PHP or "php", "-r", prelude + code],
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
        env={**os.environ, "APP_ENV": "testing", **env},
    )
    return out.stdout.strip()


def test_token_emitido_por_php_es_valido_en_python() -> None:
    s = get_settings()
    token = php(f"echo JWT::encode(['sub'=>42,'ver'=>5,'typ'=>'access'], '{s.jwt_secret}', 900);")
    payload = tokens.decode_access(token)
    assert payload and int(payload["sub"]) == 42 and int(payload["ver"]) == 5


def test_token_emitido_por_python_es_valido_en_php() -> None:
    s = get_settings()
    token = tokens.encode_access(42, 5)
    out = php(f"$p = JWT::decode('{token}', '{s.jwt_secret}', 'access'); echo $p ? $p['sub'].':'.$p['ver'] : 'null';")
    assert out == "42:5"


def test_dato_cifrado_por_php_lo_lee_python() -> None:
    key = get_settings().data_enc_key
    b64 = php("echo base64_encode(Crypto::encrypt('54091205832'));", DATA_ENC_KEY=key)
    assert crypto.decrypt(base64.b64decode(b64)) == "54091205832"


def test_dato_cifrado_por_python_lo_lee_php() -> None:
    key = get_settings().data_enc_key
    b64 = base64.b64encode(crypto.encrypt("88112048711")).decode()
    assert php(f"echo Crypto::decrypt(base64_decode('{b64}'));", DATA_ENC_KEY=key) == "88112048711"


def test_hash_de_php_lo_verifica_python_y_viceversa() -> None:
    php_hash = php("echo password_hash('Clave-Segura-123', PASSWORD_BCRYPT, ['cost'=>12]);")
    assert passwords.verify_password("Clave-Segura-123", php_hash) and not passwords.verify_password("otra", php_hash)
    py_hash = passwords.hash_password("Clave-Segura-123")
    assert php(f"echo password_verify('Clave-Segura-123', '{py_hash}') ? 'si' : 'no';") == "si"


def test_hash_argon2id_de_php_lo_verifica_python() -> None:
    out = php("echo defined('PASSWORD_ARGON2ID') ? password_hash('Clave-Segura-123', PASSWORD_ARGON2ID) : 'NA';")
    if out == "NA":
        pytest.skip("este PHP no tiene Argon2")
    assert passwords.verify_password("Clave-Segura-123", out)


def test_los_tokens_expirados_se_rechazan_igual() -> None:
    s = get_settings()
    old = php(f"echo JWT::encode(['sub'=>1,'ver'=>0,'typ'=>'access'], '{s.jwt_secret}', -10);")
    assert tokens.decode_access(old) is None
    assert time.time() > 0
