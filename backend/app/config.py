"""Configuración tipada desde variables de entorno (mismos nombres que la API PHP: es un reemplazo directo).

Precedencia: variables reales del entorno > backend/.env > api/v1/.env (compatibilidad con el despliegue actual).
Falla CERRADO: cualquier APP_ENV distinto de "development"/"testing" se trata como producción.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_DIR / "api" / "v1" / ".env"), str(BASE_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "production"
    app_url: str = "http://localhost"

    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "optimus"
    db_user: str = "root"
    db_pass: str = ""

    jwt_secret: str = ""
    jwt_expiry: int = 900
    jwt_refresh_expiry: int = 604800

    data_enc_key: str = ""

    cors_origin: str = ""
    trusted_proxies: str = ""

    rate_limit_requests: int = 60
    rate_limit_window: int = 60
    auth_rate_limit: int = 10

    upload_max_mb: int = Field(default=5, ge=1, le=50)
    upload_dir: str = ""
    terms_version: str = "v0-pendiente"

    # bcrypt (compatible con el backend PHP y con una reversión) o argon2id (tras el corte definitivo)
    password_algo: str = "bcrypt"  # noqa: S105
    log_dir: str = str(BASE_DIR / "logs")

    @property
    def is_production(self) -> bool:
        return self.app_env not in ("development", "testing")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]

    @property
    def proxies(self) -> set[str]:
        return {p.strip() for p in self.trusted_proxies.split(",") if p.strip()}

    @property
    def upload_root(self) -> Path:
        if self.upload_dir:
            p = Path(self.upload_dir)
            return p if p.is_absolute() else (REPO_DIR / "api" / "v1" / p).resolve()
        return REPO_DIR / "api" / "storage" / "receipts"

    def assert_secure(self) -> None:
        """La aplicación se niega a arrancar con una configuración insegura (secreto débil o de ejemplo)."""
        weak = len(self.jwt_secret) < 32 or "change-this" in self.jwt_secret.lower()
        if weak:
            raise RuntimeError("JWT_SECRET ausente, corto (<32) o de ejemplo: configuración insegura, arranque abortado")
        if self.password_algo not in ("bcrypt", "argon2id"):
            raise RuntimeError("PASSWORD_ALGO debe ser bcrypt o argon2id")


@lru_cache
def get_settings() -> Settings:
    return Settings()
