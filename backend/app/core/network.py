"""IP del cliente y detección de HTTPS. X-Forwarded-* solo se respeta si la conexión directa viene de un
proxy declarado en TRUSTED_PROXIES; de lo contrario es falsificable por el cliente."""

from __future__ import annotations

import ipaddress

from starlette.requests import Request

from app.config import get_settings


def _remote(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def client_ip(request: Request) -> str:
    remote = _remote(request)
    xff = request.headers.get("x-forwarded-for")
    if xff and remote in get_settings().proxies:
        candidate = xff.split(",")[-1].strip()  # el último salto lo añadió nuestro proxy de confianza
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass
    return remote


def is_https(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    return _remote(request) in get_settings().proxies and request.headers.get("x-forwarded-proto", "").lower() == "https"
