"""Acceso a datos: SQLAlchemy Core con consultas parametrizadas (`text()` + parámetros con nombre).

Por qué Core y no ORM: el esquema, sus restricciones y las reglas de negocio viven en la base de datos
(CHECK, FK compuestas, 31 triggers, bloqueos `FOR UPDATE`). La API necesita exactamente esas sentencias
SQL; un ORM añadiría una capa que reproducir sin aportar. Cada petición usa UNA conexión (así
`SET @app_user_id` llega a los triggers de historial) en modo autocommit, con transacciones explícitas.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.engine import URL

from app.config import get_settings

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine  # noqa: PLW0603
    if _engine is None:
        s = get_settings()
        url = URL.create(
            "mysql+pymysql",
            username=s.db_user,
            password=s.db_pass,
            host=s.db_host,
            port=s.db_port,
            database=s.db_name,
            query={"charset": "utf8mb4"},
        )
        _engine = create_engine(url, pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=1800, isolation_level="AUTOCOMMIT")
    return _engine


def dispose_engine() -> None:
    global _engine  # noqa: PLW0603
    if _engine is not None:
        _engine.dispose()
        _engine = None


class Db:
    """Envoltorio mínimo sobre una conexión: query / one / execute / insert / tx."""

    def __init__(self, conn: Connection) -> None:
        self.conn = conn

    def query(self, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [dict(r) for r in self.conn.execute(text(sql), params or {}).mappings().all()]

    def one(self, sql: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
        row = self.conn.execute(text(sql), params or {}).mappings().first()
        return dict(row) if row else None

    def execute(self, sql: str, params: dict[str, Any] | None = None) -> int:
        return int(self.conn.execute(text(sql), params or {}).rowcount)

    def insert(self, sql: str, params: dict[str, Any] | None = None) -> int:
        return int(self.conn.execute(text(sql), params or {}).lastrowid)

    def next_seq(self, name: str, year: int) -> int:
        """Contador atómico por (nombre, año): sin SELECT MAX + INSERT, sin carreras."""
        self.execute(
            "INSERT INTO counters (name, year, seq) VALUES (:n, :y, LAST_INSERT_ID(1)) "
            "ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1)",
            {"n": name, "y": year},
        )
        row = self.one("SELECT LAST_INSERT_ID() AS v")
        return int(row["v"]) if row else 0

    def set_actor(self, user_id: int | None) -> None:
        """Atribuye los cambios de estado a un usuario (lo leen los triggers de status_log)."""
        self.conn.exec_driver_sql("SET @app_user_id = " + ("NULL" if user_id is None else str(int(user_id))))

    @contextmanager
    def tx(self) -> Iterator[None]:
        """Transacción explícita: COMMIT si el bloque termina bien, ROLLBACK ante cualquier excepción."""
        self.conn.exec_driver_sql("START TRANSACTION")
        try:
            yield
        except BaseException:
            self.conn.exec_driver_sql("ROLLBACK")
            raise
        else:
            self.conn.exec_driver_sql("COMMIT")


def new_db() -> Iterator[Db]:
    """Dependencia de FastAPI: una conexión por petición, con el actor reiniciado (el pool la reutiliza)."""
    with get_engine().connect() as conn:
        db = Db(conn)
        db.set_actor(None)
        yield db
