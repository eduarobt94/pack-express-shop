"""Rate limiting en base de datos (compartido entre procesos y con el backend PHP: misma tabla y misma clave).

Un único INSERT … ON DUPLICATE KEY UPDATE por golpe: atómico, sin carreras de lectura-modificación-escritura.
Ventana fija: una ráfaga puede llegar a 2× el límite al cruzar el borde de la ventana (limitación conocida).
"""

from __future__ import annotations

import hashlib
import random
import time

from app.db import Db


def hit(db: Db, scope: str, identifier: str, limit: int, window: int) -> bool:
    """Cuenta un golpe; True si sigue dentro del límite."""
    slot = int(time.time()) // window
    key = hashlib.sha256(f"{scope}|{identifier}|{slot}".encode()).hexdigest()
    db.execute(
        "INSERT INTO rate_limits (bucket_key, hits, window_start) VALUES (:k, 1, :w) ON DUPLICATE KEY UPDATE hits = hits + 1",
        {"k": key, "w": slot * window},
    )
    row = db.one("SELECT hits FROM rate_limits WHERE bucket_key = :k", {"k": key})
    if random.randint(1, 200) == 1:  # limpieza ocasional de ventanas viejas  # noqa: S311
        db.execute("DELETE FROM rate_limits WHERE window_start < :t", {"t": int(time.time()) - 86400})
    return row is not None and int(row["hits"]) <= limit
