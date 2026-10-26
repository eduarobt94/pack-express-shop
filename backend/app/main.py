"""Aplicación FastAPI de Optimus Envíos.

Contrato: mismas rutas, métodos, códigos de estado y envoltorio JSON que la API PHP (`api/v1`).
Las rutas se publican sin prefijo y también bajo `/api/v1` (como las atendía el router PHP).
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.api.routes import auth, finance, locker, purchases, users
from app.config import get_settings
from app.core.errors import ApiError
from app.core.logging import log
from app.core.network import client_ip, is_https
from app.core.responses import ApiResponse, error_body
from app.db import dispose_engine

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
}
_CORS_DEV = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"


class SecurityMiddleware(BaseHTTPMiddleware):
    """Cabeceras de seguridad, HTTPS obligatorio en producción, CORS de coincidencia exacta y tope de tamaño."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        s = get_settings()
        log.client_ip_getter = lambda: client_ip(request)
        origin = request.headers.get("origin", "")
        cors_ok = bool(origin) and (origin in s.cors_origins or (not s.is_production and re.match(_CORS_DEV, origin) is not None))

        if s.is_production and not is_https(request):
            response: Response = ApiResponse(error_body("HTTPS requerido"), 426)  # sin cabeceras CORS (igual que PHP)
        else:
            limit = (s.upload_max_mb + 1) * 1024 * 1024
            declared = request.headers.get("content-length", "")
            if request.method == "OPTIONS":
                response = Response(status_code=204)
            elif declared.isdigit() and int(declared) > limit:
                response = ApiResponse(error_body("El cuerpo de la petición es demasiado grande"), 413)
            else:
                try:
                    response = await call_next(request)
                except Exception as exc:
                    log.error("unhandled_exception", error=type(exc).__name__, detail=str(exc))
                    response = ApiResponse(error_body("Error interno del servidor" if s.is_production else type(exc).__name__), 500)
            if cors_ok:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
                response.headers["Access-Control-Max-Age"] = "600"

        for name, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if s.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]
        if "server" in response.headers:
            del response.headers["server"]
        return response


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    s = get_settings()
    s.assert_secure()  # se niega a arrancar con un JWT_SECRET débil o de ejemplo
    log.configure(s.log_dir)
    yield
    dispose_engine()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="Optimus Envíos API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if s.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if s.is_production else "/openapi.json",
    )
    app.add_middleware(SecurityMiddleware)

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> ApiResponse:
        return ApiResponse(error_body(exc.message, exc.errors), exc.status, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> ApiResponse:
        if request.url.path.endswith(("/auth/login", "/auth/forgot-password")):
            return ApiResponse(error_body("Datos inválidos"), 422)  # contrato PHP: sin detalle por campo
        errors: dict[str, list[str]] = {}
        for err in exc.errors():
            loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
            field = loc[0] if loc else "body"
            errors.setdefault(field, []).append(f"{field} tiene un formato inválido")
        return ApiResponse(error_body("Datos inválidos", errors), 422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> ApiResponse:
        # El router PHP respondía 404 «Endpoint not found» también para método no permitido.
        if exc.status_code in (404, 405):
            return ApiResponse(error_body("Endpoint not found"), 404)
        return ApiResponse(error_body("Error en la petición"), exc.status_code)

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> ApiResponse:
        """Liveness para balanceadores y pruebas: no toca la base de datos ni exige autenticación."""
        return ApiResponse({"success": True, "message": "ok", "data": {"status": "up"}})

    for prefix, in_schema in (("", True), ("/api/v1", False)):
        for module in (auth, users, purchases, finance, locker):
            app.include_router(module.router, prefix=prefix, include_in_schema=in_schema)
    return app


app = create_app()
