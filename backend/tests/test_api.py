"""Pruebas de integración (TestClient + base de pruebas): autenticación, autorización, sesiones, compras,
liquidaciones y reglas de seguridad. La suite completa de contrato (111 casos) vive en api/v1/tests/api_test.php
y se ejecuta contra PHP y contra este backend (ver docs/python-migration.md)."""

from __future__ import annotations

import json
import time
import uuid

from tests.conftest import PDF


def _address(client, user, **over):
    body = {
        "recipient": "Mercedes Pérez",
        "id_doc": "54091205832",
        "phone": "+53 5234",
        "province": "hab",
        "street": "Calle 23 #456",
        "is_default": True,
        **over,
    }
    r = client.post("/user/addresses", headers=user.h, json=body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


def _purchase(client, user, address_id, order=None):
    items = json.dumps([{"description": "Estación de energía", "qty": 2, "unit_price": "500.00", "discount": "50.00"}])
    return client.post(
        "/purchases",
        headers=user.h,
        data={
            "recipient_id": str(address_id),
            "store": "Amazon",
            "store_order_number": order or f"112-{uuid.uuid4().hex[:8]}",
            "purchased_on": time.strftime("%Y-%m-%d"),
            "accept_terms": "1",
            "items": items,
        },
        files={"receipt": ("f.pdf", PDF, "application/pdf")},
    )


# ── autenticación y sesión ─────────────────────────────────────────────────────────────────────
def test_rutas_privadas_exigen_token(client) -> None:
    for method, path in [
        ("GET", "/user"),
        ("GET", "/purchases"),
        ("GET", "/settlements"),
        ("POST", "/staff/packages"),
        ("POST", "/admin/tariffs"),
    ]:
        assert client.request(method, path).status_code == 401


def test_el_rol_se_toma_de_la_base_no_del_cliente(client, make_user) -> None:
    u = make_user("mass")
    r = client.put("/user", headers=u.h, json={"name": "Nuevo Nombre", "role": "admin"})
    assert r.status_code == 200
    assert client.post("/admin/tariffs", headers=u.h, json={"commission_rate": "0.05", "sell_rate_per_kg": "9"}).status_code == 403


def test_rotacion_y_reutilizacion_de_refresh(client, make_user) -> None:
    u = make_user("rot")
    r1 = client.post("/auth/refresh", json={"refresh_token": u.refresh})
    assert r1.status_code == 200
    assert client.post("/auth/refresh", json={"refresh_token": u.refresh}).status_code == 401  # reutilizado
    assert client.post("/auth/refresh", json={"refresh_token": r1.json()["data"]["refresh_token"]}).status_code == 401  # familia revocada


def test_cambio_de_clave_invalida_las_sesiones(client, make_user) -> None:
    u = make_user("pw")
    assert (
        client.put("/user/password", headers=u.h, json={"current_password": u.password, "new_password": "Nueva-Clave-456"}).status_code
        == 200
    )
    assert client.get("/user", headers=u.h).status_code == 401
    assert client.post("/auth/refresh", json={"refresh_token": u.refresh}).status_code == 401


def test_usuario_suspendido_pierde_acceso(client, make_user, raw_db) -> None:
    u = make_user("susp")
    raw_db.cursor().execute("UPDATE users SET status='suspended' WHERE id=%s", (u.id,))
    assert client.get("/user", headers=u.h).status_code == 401


def test_bloqueo_de_cuenta_tras_fallos(client, make_user) -> None:
    u = make_user("lock")
    for _ in range(5):
        client.post("/auth/login", json={"email": u.email, "password": "mala-clave-1"})
    assert client.post("/auth/login", json={"email": u.email, "password": u.password}).status_code == 401


def test_mismo_error_para_usuario_inexistente_y_clave_mala(client, make_user) -> None:
    u = make_user("enum")
    a = client.post("/auth/login", json={"email": u.email, "password": "mala-clave-1"})
    b = client.post("/auth/login", json={"email": f"nadie.{uuid.uuid4().hex}@x.uy", "password": "mala-clave-1"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


# ── datos de otros usuarios (IDOR/BOLA) y cifrado ──────────────────────────────────────────────
def test_destinatarios_aislados_y_documento_cifrado(client, make_user, raw_db) -> None:
    a, b = make_user("ia"), make_user("ib")
    addr = _address(client, a)
    assert addr["id_doc"] == "••••••••832" and "id_doc_enc" not in addr
    cur = raw_db.cursor()
    cur.execute("SELECT id_doc_enc FROM addresses WHERE id=%s", (addr["id"],))
    assert b"54091205832" not in cur.fetchone()[0]
    assert client.get("/user/addresses", headers=b.h).json()["data"] == []
    assert (
        client.put(
            f"/user/addresses/{addr['id']}", headers=b.h, json={"recipient": "X Y", "province": "HAB", "street": "calle larga"}
        ).status_code
        == 404
    )
    assert client.delete(f"/user/addresses/{addr['id']}", headers=b.h).status_code == 404


def test_compra_aislada_entre_clientes(client, make_user) -> None:
    a, b = make_user("pa"), make_user("pb")
    addr = _address(client, a)
    r = _purchase(client, a, addr["id"])
    assert r.status_code == 201, r.text
    code = r.json()["data"]["code"]
    assert client.get(f"/purchases/{code}", headers=b.h).status_code == 404
    assert client.get(f"/purchases/{code}/receipt", headers=b.h).status_code == 404
    assert client.get(f"/purchases/{code}/receipt", headers=a.h).status_code == 200
    assert _purchase(client, b, addr["id"]).status_code == 422  # destinatario ajeno


# ── archivos ─────────────────────────────────────────────────────────────────────────────────
def test_subida_php_disfrazado_y_png_como_php(client, make_user, tmp_path) -> None:
    a = make_user("up")
    addr = _address(client, a)
    items = json.dumps([{"description": "Producto de prueba", "qty": 1, "unit_price": "10"}])

    def post(order: str, name: str, content: bytes, mime: str):
        return client.post(
            "/purchases",
            headers=a.h,
            data={
                "recipient_id": str(addr["id"]),
                "store": "Amazon",
                "store_order_number": order,
                "purchased_on": time.strftime("%Y-%m-%d"),
                "accept_terms": "1",
                "items": items,
            },
            files={"receipt": (name, content, mime)},
        )

    assert post("PHP-" + uuid.uuid4().hex[:6], "recibo.php", b"<?php system($_GET['c']); ?>", "application/pdf").status_code == 415
    png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 30
    r = post("PNG-" + uuid.uuid4().hex[:6], "shell.php", png, "image/png")
    assert r.status_code == 201
    assert post("BIG-" + uuid.uuid4().hex[:6], "g.pdf", PDF + b"A" * 1_500_000, "application/pdf").status_code == 413


# ── flujo de liquidación y pagos ────────────────────────────────────────────────────────────────
def test_flujo_recepcion_liquidacion_y_pago(client, make_user) -> None:
    a, b = make_user("fa"), make_user("fb")
    wh, ag = make_user("wh", "warehouse"), make_user("ag", "agent")
    code = _purchase(client, a, _address(client, a)["id"]).json()["data"]["code"]

    assert (
        client.post("/staff/packages", headers=a.h, json={"tracking_number": "TRK12345", "weight": "2", "weight_unit": "kg"}).status_code
        == 403
    )
    r = client.post(
        "/staff/packages",
        headers=wh.h,
        json={
            "tracking_number": f"TRK-{uuid.uuid4().hex[:6]}",
            "customer_code": a.suite,
            "purchase_code": code,
            "weight": "11",
            "weight_unit": "lb",
        },
    )
    assert r.status_code == 201 and r.json()["data"]["weight_kg"] == "4.990"

    body = {"user_id": a.id, "purchase_codes": [code]}
    assert client.post("/staff/settlements", headers=ag.h, json=body).status_code == 409  # compra no aceptada
    assert client.post(f"/staff/purchases/{code}/status", headers=ag.h, json={"status": "fully_received"}).status_code == 409
    assert client.post(f"/staff/purchases/{code}/status", headers=ag.h, json={"status": "accepted"}).status_code == 200
    issued = client.post("/staff/settlements", headers=ag.h, json=body)
    assert issued.status_code == 201 and issued.json()["data"]["total"] == "149.89"  # 95.00 + 4.990 kg × 11
    assert client.post("/staff/settlements", headers=ag.h, json=body).status_code == 409  # sin duplicar comisión
    sc = issued.json()["data"]["code"]

    assert client.get(f"/settlements/{sc}", headers=b.h).status_code == 404
    mine = client.get(f"/settlements/{sc}", headers=a.h).json()["data"]
    assert not {"issued_by", "tariff_version_id", "user_id"} & set(mine)

    pay = {"currency_original": "USD", "method": "cash", "branch": "Centro"}
    ref = uuid.uuid4().hex[:6]
    assert (
        client.post(f"/staff/settlements/{sc}/payments", headers=a.h, json={**pay, "amount": "10", "receipt_ref": f"A{ref}"}).status_code
        == 403
    )
    p1 = client.post(f"/staff/settlements/{sc}/payments", headers=ag.h, json={**pay, "amount": "100.00", "receipt_ref": f"B{ref}"})
    assert p1.json()["data"]["settlement_status"] == "partial"
    assert (
        client.post(
            f"/staff/settlements/{sc}/payments", headers=ag.h, json={**pay, "amount": "49.90", "receipt_ref": f"C{ref}"}
        ).status_code
        == 409
    )
    p2 = client.post(f"/staff/settlements/{sc}/payments", headers=ag.h, json={**pay, "amount": "49.89", "receipt_ref": f"D{ref}"})
    assert p2.json()["data"]["settlement_status"] == "paid"
    assert client.get(f"/settlements/{sc}", headers=a.h).json()["data"]["paid"] == "149.89"


def test_calculadora_no_inventa_totales(client) -> None:
    ok = client.post("/quote", json={"value": "100", "weight_kg": "5"}).json()["data"]
    assert ok["optimus_total"] == "65.00" and ok["customs_included"] is False
    assert client.post("/quote", json={"value": "100"}).json()["data"]["needs_quote"] is True
    assert client.post("/quote", json={"value": "100", "weight_kg": "-1"}).status_code == 422


# ── cabeceras, errores y modelo anterior ────────────────────────────────────────────────────────
def test_cabeceras_de_seguridad_y_404_uniforme(client) -> None:
    r = client.get("/tariffs/current")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"] and r.headers["cache-control"] == "no-store"
    assert "x-powered-by" not in r.headers and "server" not in r.headers
    miss = client.delete("/tariffs/current")
    assert miss.status_code == 404 and miss.json() == {"success": False, "message": "Endpoint not found"}


def test_cors_exacto(client) -> None:
    ok = client.get("/tariffs/current", headers={"Origin": "https://shop.example"})
    bad = client.get("/tariffs/current", headers={"Origin": "https://shop.example.evil.com"})
    assert ok.headers.get("access-control-allow-origin") == "https://shop.example"
    assert "access-control-allow-origin" not in bad.headers


def test_modelo_anterior_deshabilitado(client, make_user) -> None:
    u = make_user("old")
    assert client.post("/orders", headers=u.h, json={"items": [{"unit_price": 0.01}]}).status_code == 410
    assert client.post("/pre-alerts", headers=u.h, json={}).status_code == 410
    assert client.get("/orders", headers=u.h).json()["data"] == []
    assert client.get("/locker/shipments", headers=u.h).json()["data"] == []


def test_prefijo_api_v1_equivale(client) -> None:
    assert client.get("/api/v1/tariffs/current").json()["data"] == client.get("/tariffs/current").json()["data"]
