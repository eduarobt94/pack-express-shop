"""Pruebas unitarias: dinero, criptografía, contraseñas, tokens, esquemas, detección de archivos, red y configuración."""

from __future__ import annotations

import base64
import time

import jwt
import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.core import crypto, money, passwords, tokens
from app.schemas import AddressIn, LoginIn, PurchaseItemIn, RegisterIn, parse
from app.services import files


# ── dinero ────────────────────────────────────────────────────────────────────────────────────
def test_caso_de_aceptacion_100_usd_5_kg() -> None:
    comm = money.commission(money.to_cents("100"), "0.1000")
    ship = money.shipping("5.000", "11.00")
    assert (money.fmt(comm), money.fmt(ship), money.fmt(comm + ship)) == ("10.00", "55.00", "65.00")


@pytest.mark.parametrize(
    ("base", "rate", "expected"),
    [("0.05", "0.1000", "0.01"), ("0.04", "0.1000", "0.00"), ("950.00", "0.1000", "95.00"), ("19.99", "0.1000", "2.00")],
)
def test_comision_redondea_half_up(base: str, rate: str, expected: str) -> None:
    assert money.fmt(money.commission(money.to_cents(base), rate)) == expected


def test_envio_4_990_kg() -> None:
    assert money.fmt(money.shipping("4.990", "11.00")) == "54.89"


@pytest.mark.parametrize("bad", ["", "abc", "-1", "1.234", "1e5", "10,5", "NaN"])
def test_importes_invalidos_se_rechazan(bad: str) -> None:
    with pytest.raises(ValueError):
        money.to_cents(bad)


# ── cifrado (formato compatible con PHP) ─────────────────────────────────────────────────────────
def test_cifrado_roundtrip_y_formato() -> None:
    blob = crypto.encrypt("54091205832")
    assert blob[:1] == b"\x01" and len(blob) == 1 + 12 + 16 + len("54091205832")
    assert b"54091205832" not in blob
    assert crypto.decrypt(blob) == "54091205832"


def test_cifrado_detecta_alteraciones() -> None:
    blob = bytearray(crypto.encrypt("secreto"))
    blob[-1] ^= 1
    assert crypto.decrypt(bytes(blob)) is None


def test_cifrado_sin_clave_falla(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "data_enc_key", "")
    with pytest.raises(RuntimeError):
        crypto.encrypt("x")


# ── contraseñas ──────────────────────────────────────────────────────────────────────────────
def test_bcrypt_usa_prefijo_php_y_verifica() -> None:
    h = passwords.hash_password("Clave-Segura-123")
    assert h.startswith("$2y$12$") and passwords.verify_password("Clave-Segura-123", h)
    assert not passwords.verify_password("otra-clave-1", h)
    assert not passwords.verify_password("x", "no-es-un-hash")


def test_argon2id_y_rehash(monkeypatch: pytest.MonkeyPatch) -> None:
    bcrypt_hash = passwords.hash_password("Clave-Segura-123")
    monkeypatch.setattr(get_settings(), "password_algo", "argon2id")
    h = passwords.hash_password("Clave-Segura-123")
    assert h.startswith("$argon2id$") and passwords.verify_password("Clave-Segura-123", h)
    assert passwords.needs_rehash(bcrypt_hash) and not passwords.needs_rehash(h)


# ── tokens ───────────────────────────────────────────────────────────────────────────────────
def test_token_valido_y_manipulaciones() -> None:
    t = tokens.encode_access(7, 3)
    p = tokens.decode_access(t)
    assert p and p["sub"] == 7 and p["ver"] == 3 and p["typ"] == "access"
    head, body, sig = t.split(".")
    assert tokens.decode_access(f"{head}.{body}.{sig[::-1]}") is None
    none_token = jwt.encode({"sub": 1, "typ": "access", "exp": int(time.time()) + 60}, key=None, algorithm="none")
    assert tokens.decode_access(none_token) is None


def test_token_de_otro_tipo_o_vencido_no_sirve() -> None:
    secret = get_settings().jwt_secret
    refresh_like = jwt.encode({"sub": 1, "ver": 0, "typ": "refresh", "exp": int(time.time()) + 60}, secret, algorithm="HS256")
    expired = jwt.encode({"sub": 1, "ver": 0, "typ": "access", "exp": int(time.time()) - 5}, secret, algorithm="HS256")
    other_secret = jwt.encode({"sub": 1, "ver": 0, "typ": "access", "exp": int(time.time()) + 60}, "x" * 48, algorithm="HS256")
    assert tokens.decode_access(refresh_like) is None
    assert tokens.decode_access(expired) is None
    assert tokens.decode_access(other_secret) is None


def test_cabecera_bearer() -> None:
    assert tokens.bearer_from_header("Bearer " + "a" * 30) == "a" * 30
    assert tokens.bearer_from_header("Basic abc") is None and tokens.bearer_from_header(None) is None


# ── esquemas (validación y anti mass-assignment) ────────────────────────────────────────────────
def test_la_contrasena_no_se_altera() -> None:
    assert LoginIn(email="a@b.com", password="  <b>Cl</b>ave<x>123  ").password == "  <b>Cl</b>ave<x>123  "


def test_el_texto_se_limpia_de_html() -> None:
    a = parse(
        AddressIn, {"recipient": "<script>alert(1)</script>Juana", "province": "hab", "street": "<img src=x onerror=alert(1)>Calle 5"}
    )
    assert a.recipient == "alert(1)Juana" and a.street == "Calle 5"


def test_campos_privilegiados_se_descartan() -> None:
    r = RegisterIn.model_validate(
        {"name": "Mal Actor", "email": "m@a.com", "password": "Clave-Segura-123", "role": "admin", "status": "active"}
    )
    assert not hasattr(r, "role") and "role" not in r.model_dump()


@pytest.mark.parametrize(
    "payload", [{"email": ["a@b.com"], "password": ["x"]}, {"email": {"a": 1}, "password": "x"}, {"email": "no-es-email", "password": "x"}]
)
def test_tipos_no_escalares_y_emails_invalidos(payload: dict) -> None:
    with pytest.raises(ValidationError):
        LoginIn.model_validate(payload)


def test_contrasena_de_mas_de_72_bytes() -> None:
    with pytest.raises(ValidationError):
        RegisterIn(name="Ana P", email="a@b.com", password="ñ" * 40)  # 80 bytes


@pytest.mark.parametrize(
    "item",
    [
        {"qty": 0, "unit_price": "1"},
        {"qty": 1, "unit_price": "-5"},
        {"qty": 1, "unit_price": "10.999"},
        {"qty": 1, "unit_price": "10", "url": "javascript:alert(1)"},
        {"qty": 1001, "unit_price": "1"},
    ],
)
def test_producto_invalido(item: dict) -> None:
    with pytest.raises(Exception):
        parse(PurchaseItemIn, {"description": "Producto de prueba", **item})


# ── archivos ─────────────────────────────────────────────────────────────────────────────────
def test_deteccion_por_firma() -> None:
    png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    assert files.sniff(b"%PDF-1.4") == "application/pdf" and files.sniff(png) == "image/png"
    assert files.sniff(b"\xff\xd8\xff\xe0") == "image/jpeg" and files.sniff(b"RIFF\x00\x00\x00\x00WEBP") == "image/webp"
    assert files.sniff(b"<?php system($_GET['c']); ?>") is None and files.sniff(b"GIF89a") is None


# ── configuración y red ─────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(("env", "prod"), [("production", True), ("", True), ("staging", True), ("development", False), ("testing", False)])
def test_falla_cerrado_el_entorno(env: str, prod: bool) -> None:
    assert Settings(app_env=env, jwt_secret="x" * 40).is_production is prod


@pytest.mark.parametrize("secret", ["", "corto", "change-this-to-a-secure-random-64-char-string", "x" * 31])
def test_secreto_debil_impide_arrancar(secret: str) -> None:
    with pytest.raises(RuntimeError):
        Settings(jwt_secret=secret).assert_secure()


def test_secreto_fuerte_es_valido() -> None:
    Settings(jwt_secret="x" * 40).assert_secure()


def test_ip_y_https_solo_con_proxy_de_confianza() -> None:
    from starlette.requests import Request

    from app.core.network import client_ip, is_https

    def req(remote: str, headers: dict[str, str]) -> Request:
        return Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "scheme": "http",
                "query_string": b"",
                "client": (remote, 1),
                "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
                "server": ("t", 80),
            }
        )

    spoof = {"X-Forwarded-For": "203.0.113.9", "X-Forwarded-Proto": "https"}
    s = get_settings()
    original = s.trusted_proxies
    try:
        s.trusted_proxies = ""
        assert client_ip(req("10.0.0.5", spoof)) == "10.0.0.5" and not is_https(req("10.0.0.5", spoof))
        s.trusted_proxies = "10.0.0.5"
        assert client_ip(req("10.0.0.5", spoof)) == "203.0.113.9" and is_https(req("10.0.0.5", spoof))
        assert client_ip(req("10.0.0.6", spoof)) == "10.0.0.6"  # otro origen no se beneficia
    finally:
        s.trusted_proxies = original


def test_clave_base64_valida() -> None:
    assert len(base64.b64decode(get_settings().data_enc_key)) == 32
