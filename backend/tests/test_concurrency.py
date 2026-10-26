"""Concurrencia real: varios hilos contra un servidor uvicorn y la base de pruebas. Verifican que las reglas
se cumplen aunque dos peticiones coincidan (sin sobrepagos, sin duplicados, sin códigos repetidos)."""

from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from tests.conftest import PDF

PAY = {"currency_original": "USD", "method": "cash", "branch": "Centro"}


def _user(base, role, raw_db, tag):
    email = f"{tag}.{uuid.uuid4().hex[:8]}@conc.uy"
    r = httpx.post(f"{base}/auth/register", json={"name": f"Usuario {tag}", "email": email, "password": "Clave-Segura-123"}, timeout=30)
    d = r.json()["data"]
    if role != "customer":
        raw_db.cursor().execute("UPDATE users SET role=%s WHERE email=%s", (role, email))
    return {"id": d["user"]["id"], "suite": d["user"]["suite_id"], "h": {"Authorization": f"Bearer {d['token']}"}, "refresh": d["refresh_token"], "email": email}


def _purchase(base, user, address_id, order, status_check=False):
    items = json.dumps([{"description": "Estación de energía", "qty": 2, "unit_price": "500.00", "discount": "50.00"}])
    return httpx.post(f"{base}/purchases", headers=user["h"], timeout=60, data={
        "recipient_id": str(address_id), "store": "Amazon", "store_order_number": order, "purchased_on": time.strftime("%Y-%m-%d"),
        "accept_terms": "1", "items": items}, files={"receipt": ("f.pdf", PDF, "application/pdf")})


def _address(base, user):
    r = httpx.post(f"{base}/user/addresses", headers=user["h"], timeout=30, json={"recipient": "Mercedes P", "province": "HAB", "street": "Calle 23 #456"})
    return r.json()["data"]["id"]


def _parallel(n, fn):
    with ThreadPoolExecutor(max_workers=n) as pool:
        return list(pool.map(fn, range(n)))


def test_doble_envio_de_la_misma_compra_solo_crea_una(live_server, raw_db):
    a = _user(live_server, "customer", raw_db, "dup")
    addr = _address(live_server, a)
    order = f"DUP-{uuid.uuid4().hex[:8]}"
    codes = sorted(r.status_code for r in _parallel(6, lambda _: _purchase(live_server, a, addr, order)))
    assert codes == [201, 409, 409, 409, 409, 409]
    cur = raw_db.cursor()
    cur.execute("SELECT COUNT(*) FROM purchases WHERE user_id=%s AND store_order_number=%s", (a["id"], order))
    assert cur.fetchone()[0] == 1


def test_codigos_de_compra_unicos_bajo_concurrencia(live_server, raw_db):
    a = _user(live_server, "customer", raw_db, "seq")
    addr = _address(live_server, a)
    results = _parallel(10, lambda i: _purchase(live_server, a, addr, f"SEQ-{i}-{uuid.uuid4().hex[:6]}"))
    assert [r.status_code for r in results] == [201] * 10
    codes = [r.json()["data"]["code"] for r in results]
    assert len(set(codes)) == 10, "códigos repetidos: el contador no es atómico"


def test_pagos_simultaneos_nunca_superan_el_total(live_server, raw_db):
    a = _user(live_server, "customer", raw_db, "pay")
    wh, ag = _user(live_server, "warehouse", raw_db, "wh"), _user(live_server, "agent", raw_db, "ag")
    code = _purchase(live_server, a, _address(live_server, a), f"PAY-{uuid.uuid4().hex[:8]}").json()["data"]["code"]
    httpx.post(f"{live_server}/staff/packages", headers=wh["h"], timeout=30, json={
        "tracking_number": f"TRK-{uuid.uuid4().hex[:8]}", "customer_code": a["suite"], "purchase_code": code, "weight": "10", "weight_unit": "kg"})
    httpx.post(f"{live_server}/staff/purchases/{code}/status", headers=ag["h"], timeout=30, json={"status": "accepted"})
    sc = httpx.post(f"{live_server}/staff/settlements", headers=ag["h"], timeout=30, json={"user_id": a["id"], "purchase_codes": [code]}).json()["data"]
    assert sc["total"] == "205.00"                                              # 95 comisión + 110 envío

    def pay(i):
        return httpx.post(f"{live_server}/staff/settlements/{sc['code']}/payments", headers=ag["h"], timeout=60,
                          json={**PAY, "amount": "100.00", "receipt_ref": f"C{i}{uuid.uuid4().hex[:6]}"})

    statuses = sorted(r.status_code for r in _parallel(5, pay))
    assert statuses == [201, 201, 409, 409, 409], statuses                       # solo caben dos pagos de 100 en 205
    cur = raw_db.cursor()
    cur.execute("SELECT COALESCE(SUM(amount),0) FROM payments p JOIN settlements s ON s.id=p.settlement_id WHERE s.code=%s", (sc["code"],))
    assert float(cur.fetchone()[0]) == 200.0
    cur.execute("SELECT status FROM settlements WHERE code=%s", (sc["code"],))
    assert cur.fetchone()[0] == "partial"


def test_refresh_simultaneo_solo_rota_una_vez(live_server, raw_db):
    u = _user(live_server, "customer", raw_db, "ref")
    results = _parallel(6, lambda _: httpx.post(f"{live_server}/auth/refresh", json={"refresh_token": u["refresh"]}, timeout=30))
    assert sorted(r.status_code for r in results).count(200) == 1
    assert all(r.status_code in (200, 401) for r in results)


def test_registro_simultaneo_del_mismo_email_no_da_500(live_server):
    email = f"race.{uuid.uuid4().hex[:8]}@conc.uy"
    results = _parallel(5, lambda _: httpx.post(f"{live_server}/auth/register", timeout=60, json={"name": "Carrera Uno", "email": email, "password": "Clave-Segura-123"}))
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1 and 500 not in codes, codes
    assert set(codes) <= {201, 409}


@pytest.mark.parametrize("n", [20])
def test_ráfaga_de_lecturas_no_produce_errores(live_server, raw_db, n):
    u = _user(live_server, "customer", raw_db, "burst")
    results = _parallel(n, lambda _: httpx.get(f"{live_server}/user", headers=u["h"], timeout=30))
    assert all(r.status_code == 200 for r in results)
