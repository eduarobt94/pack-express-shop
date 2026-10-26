"""Fixtures de pytest. Las pruebas de integración usan una base DESECHABLE (DB_NAME debe terminar en _test)
y se omiten si no hay base disponible. Variables: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME."""

from __future__ import annotations

import base64
import os
import secrets
import shutil
import tempfile
import uuid
from collections.abc import Iterator
from pathlib import Path

import pymysql
import pytest

_TMP = Path(tempfile.mkdtemp(prefix="optimus_pytest_"))
os.environ.update(
    {
        "APP_ENV": "testing",
        "JWT_SECRET": secrets.token_hex(32),
        "DATA_ENC_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
        "UPLOAD_DIR": str(_TMP / "uploads"),
        "LOG_DIR": str(_TMP / "logs"),
        "UPLOAD_MAX_MB": "1",
        "CORS_ORIGIN": "https://shop.example",
        "TERMS_VERSION": "v1-test",
        "AUTH_RATE_LIMIT": "100000",
        "RATE_LIMIT_REQUESTS": "100000",
        "DB_HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "DB_PORT": os.environ.get("DB_PORT", "3306"),
        "DB_USER": os.environ.get("DB_USER", "root"),
        "DB_PASS": os.environ.get("DB_PASS", ""),
        "DB_NAME": os.environ.get("DB_NAME", "optimus_test"),
    }
)

REPO = Path(__file__).resolve().parents[2]
PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


def pytest_sessionfinish() -> None:
    shutil.rmtree(_TMP, ignore_errors=True)


def _connect() -> pymysql.Connection:
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASS"],
        database=os.environ["DB_NAME"],
        autocommit=True,
    )


@pytest.fixture(scope="session")
def raw_db() -> Iterator[pymysql.Connection]:
    if not os.environ["DB_NAME"].endswith("_test"):
        pytest.skip("DB_NAME debe terminar en _test")
    try:
        conn = _connect()
        conn.cursor().execute("SELECT 1 FROM tariff_versions LIMIT 1")  # migraciones aplicadas
    except pymysql.MySQLError:
        pytest.skip("base de pruebas no disponible (aplicar migraciones: php database/migrate.php up)")
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def client(raw_db: pymysql.Connection):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


class Account:
    def __init__(self, email: str, token: str, refresh: str, user_id: int, suite: str, password: str) -> None:
        self.email, self.token, self.refresh, self.id, self.suite, self.password = email, token, refresh, user_id, suite, password

    @property
    def h(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


@pytest.fixture
def make_user(client, raw_db):
    """Crea un usuario por la API; `role` lo asigna el 'DBA' (no existe API para elevar privilegios)."""

    def _make(tag: str = "u", role: str = "customer") -> Account:
        email = f"{tag}.{uuid.uuid4().hex[:8]}@pytest.uy"
        pw = "Clave-Segura-123"
        r = client.post("/auth/register", json={"name": f"Usuario {tag}", "email": email, "password": pw})
        assert r.status_code == 201, r.text
        d = r.json()["data"]
        if role != "customer":
            raw_db.cursor().execute("UPDATE users SET role=%s WHERE email=%s", (role, email))
        return Account(email, d["token"], d["refresh_token"], d["user"]["id"], d["user"]["suite_id"], pw)

    return _make


# ── servidor real (uvicorn) para pruebas de concurrencia y rendimiento ─────────────────────────────
@pytest.fixture(scope="session")
def live_server(raw_db):  # noqa: ANN201
    import socket
    import subprocess
    import sys

    import httpx

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning", "--no-proxy-headers"],
        cwd=str(REPO / "backend"), env=os.environ.copy(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            httpx.get(f"{url}/tariffs/current", timeout=1)
            break
        except httpx.HTTPError:
            import time

            time.sleep(0.2)
    else:
        proc.terminate()
        pytest.fail("el servidor de pruebas no arrancó (infraestructura, no producto)")
    yield url
    proc.terminate()
    proc.wait(timeout=10)
