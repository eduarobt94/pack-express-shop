"""Rendimiento proporcional al sistema: latencia de endpoints críticos (secuencial y con concurrencia limitada),
ausencia de errores y uso de índices en las consultas calientes.

Los umbrales están en perf_thresholds.json y salen de una LÍNEA BASE medida en esta máquina (ver
docs/automated-testing-report.md): umbral = ~4× el p95 base (mínimo 150 ms), de modo que detectan regresiones
reales (consultas sin índice, trabajo extra por petición) sin fallar por el ruido normal de una máquina compartida.
Con PERF_REPORT=1 se imprime la medición para recalibrar. Concurrencia acotada (8 hilos): nunca contra producción.
"""

from __future__ import annotations

import json
import os
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest

THRESHOLDS = json.loads((Path(__file__).parent / "perf_thresholds.json").read_text(encoding="utf-8"))
SEQUENTIAL, CONCURRENT_THREADS, PER_THREAD = 40, 8, 6


def _user(base):
    email = f"perf.{uuid.uuid4().hex[:8]}@perf.uy"
    d = httpx.post(f"{base}/auth/register", json={"name": "Perf User", "email": email, "password": "Clave-Segura-123"}, timeout=30).json()["data"]
    return email, {"Authorization": f"Bearer {d['token']}"}


def _measure(call, n):
    samples, errors = [], 0
    for _ in range(n):
        t0 = time.perf_counter()
        r = call()
        samples.append((time.perf_counter() - t0) * 1000)
        errors += r.status_code >= 500 or r.status_code == 0
    return samples, errors


def _stats(samples):
    s = sorted(samples)
    return {"p50": round(statistics.median(s), 1), "p95": round(s[int(len(s) * 0.95) - 1], 1), "max": round(s[-1], 1)}


def _report(name, mode, stats):
    if os.environ.get("PERF_REPORT"):
        print(f"PERF {name:<18} {mode:<10} {stats}")


CASES = {
    "tariffs_current": lambda base, h, email: httpx.get(f"{base}/tariffs/current", timeout=30),
    "quote": lambda base, h, email: httpx.post(f"{base}/quote", json={"value": "100", "weight_kg": "5"}, timeout=30),
    "user_profile": lambda base, h, email: httpx.get(f"{base}/user", headers=h, timeout=30),
    "purchases_list": lambda base, h, email: httpx.get(f"{base}/purchases", headers=h, timeout=30),
    "login": lambda base, h, email: httpx.post(f"{base}/auth/login", json={"email": email, "password": "Clave-Segura-123"}, timeout=30),
}


@pytest.mark.perf
@pytest.mark.parametrize("name", list(CASES))
def test_latencia_secuencial(live_server, name):
    email, h = _user(live_server)
    n = 8 if name == "login" else SEQUENTIAL          # el login incluye bcrypt (costoso a propósito)
    CASES[name](live_server, h, email)                 # calentamiento (pool de conexiones, importaciones perezosas)
    samples, errors = _measure(lambda: CASES[name](live_server, h, email), n)
    st = _stats(samples)
    _report(name, "secuencial", st)
    assert errors == 0
    assert st["p95"] <= THRESHOLDS["sequential_p95_ms"][name], f"{name}: p95 {st['p95']} ms supera el umbral {THRESHOLDS['sequential_p95_ms'][name]} ms"


@pytest.mark.perf
@pytest.mark.parametrize("name", ["tariffs_current", "user_profile", "purchases_list"])
def test_latencia_con_concurrencia(live_server, name):
    email, h = _user(live_server)
    CASES[name](live_server, h, email)

    def worker(_):
        return _measure(lambda: CASES[name](live_server, h, email), PER_THREAD)

    with ThreadPoolExecutor(CONCURRENT_THREADS) as pool:
        results = list(pool.map(worker, range(CONCURRENT_THREADS)))
    samples = [s for r in results for s in r[0]]
    st = _stats(samples)
    _report(name, f"{CONCURRENT_THREADS} hilos", st)
    assert sum(r[1] for r in results) == 0, "hubo errores 5xx bajo concurrencia"
    assert st["p95"] <= THRESHOLDS["concurrent_p95_ms"][name], f"{name}: p95 {st['p95']} ms supera el umbral {THRESHOLDS['concurrent_p95_ms'][name]} ms"


@pytest.mark.perf
def test_rendimiento_de_login_bajo_ráfaga_no_bloquea_otros_endpoints(live_server):
    """Una ráfaga de logins (bcrypt) no debe dejar sin respuesta a una lectura simple (hilos del servidor)."""
    email, h = _user(live_server)
    with ThreadPoolExecutor(6) as pool:
        futures = [pool.submit(CASES["login"], live_server, h, email) for _ in range(6)]
        t0 = time.perf_counter()
        r = httpx.get(f"{live_server}/tariffs/current", timeout=30)
        elapsed = (time.perf_counter() - t0) * 1000
        [f.result() for f in futures]
    assert r.status_code == 200
    assert elapsed <= THRESHOLDS["read_during_login_burst_ms"], f"lectura durante ráfaga de logins: {elapsed:.0f} ms"


HOT_QUERIES = {
    "compra por código y dueño": "SELECT id FROM purchases WHERE code = 'x' AND user_id = 1",
    "compras del cliente": "SELECT id FROM purchases WHERE user_id = 1 ORDER BY created_at DESC",
    "liquidación por código": "SELECT id FROM settlements WHERE code = 'x' AND user_id = 1",
    "liquidaciones del cliente": "SELECT id FROM settlements WHERE user_id = 1 AND status <> 'estimate'",
    "paquetes del cliente": "SELECT id FROM packages WHERE user_id = 1 AND status = 'ready'",
    "paquetes de una compra": "SELECT id FROM packages WHERE purchase_id = 1 AND user_id = 1",
    "refresh por hash": "SELECT id FROM refresh_tokens WHERE token_hash = 'x'",
    "rate limit por clave": "SELECT hits FROM rate_limits WHERE bucket_key = 'x'",
    "usuario por email": "SELECT id FROM users WHERE email = 'x'",
    "destinatarios del cliente": "SELECT id FROM addresses WHERE user_id = 1",
    "líneas de una liquidación": "SELECT id FROM settlement_lines WHERE settlement_id = 1",
    "pagos de una liquidación": "SELECT id FROM payments WHERE settlement_id = 1",
    "paquetes de un envío": "SELECT package_id FROM locker_shipment_packages WHERE shipment_id = 'x'",
    "productos de una compra": "SELECT id FROM purchase_items WHERE purchase_id = 1",
    "seguimientos de una compra": "SELECT id FROM purchase_trackings WHERE purchase_id = 1",
}


@pytest.mark.parametrize("label", list(HOT_QUERIES))
def test_consultas_calientes_tienen_indice(raw_db, label):
    cur = raw_db.cursor()
    cur.execute("EXPLAIN " + HOT_QUERIES[label])
    cols = [c[0].lower() for c in cur.description]
    rows = [dict(zip(cols, r, strict=True)) for r in cur.fetchall()]
    # Con una clave única y un valor inexistente MariaDB resuelve la búsqueda por el índice (tabla "const") y avisa
    # "Impossible WHERE noticed after reading const tables": la consulta SÍ usó el índice, solo que no hay fila.
    resolved_by_const_index = lambda r: "Impossible WHERE noticed after reading const tables" in (r.get("extra") or "")  # noqa: E731
    assert all(r["possible_keys"] or resolved_by_const_index(r) for r in rows), f"{label}: sin índice utilizable → {rows}"
