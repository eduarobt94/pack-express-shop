"""Cobertura adicional de integración: recuperación de acceso, destinatarios, casillero con datos, modelo anterior,
personal/administración, archivos, cabeceras y modo producción."""

from __future__ import annotations

import hashlib
import json
import time
import uuid

import pytest

from app.config import get_settings
from tests.conftest import PDF
from tests.test_api import _address, _purchase

PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 30
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 30
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 30


def _sql(raw_db, sql, args=()):
    cur = raw_db.cursor()
    cur.execute(sql, args)
    return cur


# ── recuperación de acceso y sesiones ──────────────────────────────────────────────────────────
def _reset_token(raw_db, user, *, expired=False):
    token = uuid.uuid4().hex + uuid.uuid4().hex
    _sql(raw_db, "REPLACE INTO password_reset_tokens (email, token, expires_at, user_id) VALUES (%s,%s,DATE_ADD(NOW(), INTERVAL %s MINUTE),%s)",
         (user.email, hashlib.sha256(token.encode()).hexdigest(), -5 if expired else 60, user.id))
    return token


def test_forgot_password_misma_respuesta_exista_o_no(client, make_user):
    u = make_user("fg")
    a = client.post("/auth/forgot-password", json={"email": u.email})
    b = client.post("/auth/forgot-password", json={"email": f"nadie.{uuid.uuid4().hex}@x.uy"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert client.post("/auth/forgot-password", json={"email": "no-es-email"}).status_code == 422


def test_forgot_password_no_guarda_el_token_en_claro(client, make_user, raw_db):
    u = make_user("fg2")
    client.post("/auth/forgot-password", json={"email": u.email})
    stored = _sql(raw_db, "SELECT token FROM password_reset_tokens WHERE user_id=%s", (u.id,)).fetchone()[0]
    assert len(stored) == 64  # SHA-256 hex: el valor utilizable nunca se almacena


def test_reset_password_flujo_completo_y_un_solo_uso(client, make_user, raw_db):
    u = make_user("rs")
    token = _reset_token(raw_db, u)
    assert client.post("/auth/reset-password", json={"token": token, "password": "Reseteada-789"}).status_code == 200
    assert client.post("/auth/login", json={"email": u.email, "password": u.password}).status_code == 401   # clave vieja
    assert client.post("/auth/login", json={"email": u.email, "password": "Reseteada-789"}).status_code == 200
    assert client.get("/user", headers=u.h).status_code == 401                                              # sesiones previas cerradas
    assert client.post("/auth/refresh", json={"refresh_token": u.refresh}).status_code == 401
    assert client.post("/auth/reset-password", json={"token": token, "password": "Otra-Clave-000"}).status_code == 400  # token de un solo uso


def test_reset_password_rechaza_vencido_inexistente_y_clave_debil(client, make_user, raw_db):
    u = make_user("rs2")
    assert client.post("/auth/reset-password", json={"token": _reset_token(raw_db, u, expired=True), "password": "Reseteada-789"}).status_code == 400
    assert client.post("/auth/reset-password", json={"token": "0" * 64, "password": "Reseteada-789"}).status_code == 400
    assert client.post("/auth/reset-password", json={"token": _reset_token(raw_db, u), "password": "corta"}).status_code == 422
    assert client.post("/auth/reset-password", json={"token": "no-hex", "password": "Reseteada-789"}).status_code == 422


def test_logout_revoca_la_familia_de_refresh(client, make_user):
    u = make_user("lo")
    assert client.post("/auth/logout", json={"refresh_token": u.refresh}).status_code == 200
    assert client.post("/auth/refresh", json={"refresh_token": u.refresh}).status_code == 401
    assert client.post("/auth/logout", json={}).status_code == 200  # sin token: no falla


def test_refresh_sin_token_y_registro_invalido(client):
    assert client.post("/auth/refresh", json={}).status_code == 422
    for bad in ({"name": "A", "email": "a@b.uy", "password": "Clave-Segura-123"}, {"name": "Ana P", "email": "x", "password": "Clave-Segura-123"},
                {"name": "Ana P", "email": "a@b.uy", "password": "1234567"}, {"name": "Ana P", "email": "a@b.uy", "password": "Clave-Segura-123", "phone": "9" * 31}):
        assert client.post("/auth/register", json=bad).status_code == 422


def test_login_cuenta_suspendida_o_inexistente_da_el_mismo_error(client, make_user, raw_db):
    u = make_user("sp2")
    _sql(raw_db, "UPDATE users SET status='suspended' WHERE id=%s", (u.id,))
    r = client.post("/auth/login", json={"email": u.email, "password": u.password})
    assert r.status_code == 401 and r.json()["message"] == "Credenciales incorrectas"


def test_email_en_mayusculas_inicia_sesion(client, make_user):
    u = make_user("up")
    assert client.post("/auth/login", json={"email": u.email.upper(), "password": u.password}).status_code == 200


# ── perfil y destinatarios ──────────────────────────────────────────────────────────────────────
def test_perfil_y_validaciones(client, make_user):
    u = make_user("pf")
    me = client.get("/user", headers=u.h).json()["data"]
    assert me["email"] == u.email and me["role"] == "customer" and me["suite_id"] == u.suite and me["country"] == "UY"
    assert not {"password_hash", "token_version", "status", "failed_logins"} & set(me)
    assert client.put("/user", headers=u.h, json={"name": "A"}).status_code == 422
    assert client.put("/user", headers=u.h, json={"name": "Ana Nueva", "phone": "+598 99 111 222"}).status_code == 200
    assert client.get("/user", headers=u.h).json()["data"]["name"] == "Ana Nueva"


def test_destinatarios_documento_default_y_borrado(client, make_user, raw_db):
    u = make_user("ad")
    a1 = _address(client, u, is_default=True)
    a2 = _address(client, u, province="SCU", recipient="Luis Rodríguez", is_default=True)
    listing = client.get("/user/addresses", headers=u.h).json()["data"]
    assert [x["is_default"] for x in listing] == [True, False] and listing[0]["id"] == a2["id"]  # un solo predeterminado
    enc = lambda aid: _sql(raw_db, "SELECT id_doc_enc FROM addresses WHERE id=%s", (aid,)).fetchone()[0]  # noqa: E731
    before = enc(a1["id"])
    body = {"recipient": "Mercedes P", "province": "HAB", "street": "Calle larga 12"}
    assert client.put(f"/user/addresses/{a1['id']}", headers=u.h, json=body).status_code == 200
    assert enc(a1["id"]) == before                                         # omitir id_doc conserva el cifrado
    assert client.put(f"/user/addresses/{a1['id']}", headers=u.h, json={**body, "id_doc": "99999999999"}).status_code == 200
    assert enc(a1["id"]) != before                                          # enviarlo lo reemplaza
    assert client.put(f"/user/addresses/{a1['id']}", headers=u.h, json={**body, "id_doc": ""}).status_code == 200
    assert enc(a1["id"]) is None                                            # vacío lo elimina
    assert client.put("/user/addresses/abc", headers=u.h, json=body).status_code == 404
    assert client.post("/user/addresses", headers=u.h, json={**body, "id_doc": "con espacios!"}).status_code == 422
    # un destinatario con compras no se puede borrar (RESTRICT); uno libre sí
    assert _purchase(client, u, a2["id"]).status_code == 201
    assert client.delete(f"/user/addresses/{a2['id']}", headers=u.h).status_code == 409
    assert client.delete(f"/user/addresses/{a1['id']}", headers=u.h).status_code == 200


# ── casillero con datos (regresión: JSON_ARRAYAGG no existe en MariaDB < 10.5) ─────────────────────
def _seed_locker(raw_db, user):
    pid, sid = f"WR-T-{uuid.uuid4().hex[:6]}", f"SH-T-{uuid.uuid4().hex[:6]}"
    _sql(raw_db, "INSERT INTO packages (id,user_id,suite_id,tracking_number,weight_kg,status,notes,received_at) VALUES (%s,%s,%s,%s,2.5,'ready',%s,NOW())",
         (pid, user.id, user.suite, "TRK" + pid, json.dumps(["Nota"])))
    _sql(raw_db, "INSERT INTO locker_shipments (id,user_id,suite_id) VALUES (%s,%s,%s)", (sid, user.id, user.suite))
    _sql(raw_db, "INSERT INTO locker_shipment_packages (shipment_id,package_id) VALUES (%s,%s)", (sid, pid))
    return pid, sid


def test_casillero_lista_paquetes_y_envios_con_datos(client, make_user, raw_db):
    a, b = make_user("la"), make_user("lb")
    pid, sid = _seed_locker(raw_db, a)
    lock = client.get("/locker", headers=a.h).json()["data"]
    assert lock["suite_id"] == a.suite and int(lock["ready"]) == 1
    pk = client.get("/locker/packages", headers=a.h).json()["data"]
    assert [p["id"] for p in pk] == [pid] and pk[0]["notes"] == ["Nota"] and pk[0]["weight_kg"] == "2.500"
    assert [p["id"] for p in client.get("/locker/packages?status=ready", headers=a.h).json()["data"]] == [pid]
    assert client.get("/locker/packages?status=shipped", headers=a.h).json()["data"] == []
    sh = client.get("/locker/shipments", headers=a.h).json()["data"]
    assert sh[0]["id"] == sid and sh[0]["package_ids"] == [pid]
    assert client.get(f"/locker/shipments/{sid}", headers=a.h).json()["data"]["package_ids"] == [pid]
    # aislamiento: b no ve nada de a
    assert client.get(f"/locker/packages/{pid}", headers=b.h).status_code == 404
    assert client.get(f"/locker/shipments/{sid}", headers=b.h).status_code == 404
    assert client.get("/locker/packages", headers=b.h).json()["data"] == []


def test_locker_sin_suite_o_con_suite_vacia(client, make_user):
    u = make_user("ls")
    lock = client.get("/locker", headers=u.h).json()["data"]
    assert lock["suite_id"] == u.suite and int(lock["packages_in_locker"]) == 0


# ── modelo anterior ─────────────────────────────────────────────────────────────────────────────
def test_ordenes_y_prealertas_historicas(client, make_user, raw_db):
    a, b = make_user("oa"), make_user("ob")
    oid, paid = f"OLD-{uuid.uuid4().hex[:6]}", f"PA-{uuid.uuid4().hex[:6]}"
    _sql(raw_db, "INSERT INTO orders (id,user_id,subtotal,total,status) VALUES (%s,%s,100,120,'delivered')", (oid, a.id))
    _sql(raw_db, "INSERT INTO order_items (order_id,product_id,name,qty,unit_price) VALUES (%s,'p1','Cosa',2,50)", (oid,))
    _sql(raw_db, "INSERT INTO pre_alerts (id,user_id,suite_id,status) VALUES (%s,%s,%s,'pending')", (paid, a.id, a.suite))
    orders = client.get("/orders", headers=a.h).json()["data"]
    assert [o["id"] for o in orders] == [oid] and orders[0]["items"][0]["name"] == "Cosa"
    assert client.get(f"/orders/{oid}", headers=a.h).json()["data"]["items"][0]["qty"] == 2
    assert client.get(f"/orders/{oid}", headers=b.h).status_code == 404
    assert "factura_path" not in client.get("/pre-alerts", headers=a.h).json()["data"][0]
    assert client.delete(f"/pre-alerts/{paid}", headers=b.h).status_code == 404
    assert client.delete(f"/pre-alerts/{paid}", headers=a.h).status_code == 200
    _sql(raw_db, "UPDATE pre_alerts SET status='received' WHERE id=%s", (paid,))
    assert client.delete(f"/pre-alerts/{paid}", headers=a.h).status_code == 409


# ── personal, tarifas y liquidaciones ──────────────────────────────────────────────────────────
def _ready_purchase(client, make_user, weight="10", kg_unit="kg"):
    a = make_user("sa")
    wh, ag = make_user("swh", "warehouse"), make_user("sag", "agent")
    code = _purchase(client, a, _address(client, a)["id"]).json()["data"]["code"]
    r = client.post("/staff/packages", headers=wh.h, json={"tracking_number": f"TRK-{uuid.uuid4().hex[:8]}", "customer_code": a.suite,
                                                           "purchase_code": code, "weight": weight, "weight_unit": kg_unit})
    assert r.status_code == 201
    assert client.post(f"/staff/purchases/{code}/status", headers=ag.h, json={"status": "accepted"}).status_code == 200
    return a, wh, ag, code


def test_bandeja_de_no_identificados_solo_para_almacen(client, make_user):
    wh, a = make_user("swh2", "warehouse"), make_user("sc")
    tracking = f"NOB-{uuid.uuid4().hex[:8]}"
    assert client.post("/staff/packages", headers=wh.h, json={"tracking_number": tracking, "weight": "3", "weight_unit": "kg"}).status_code == 201
    inbox = client.get("/staff/packages/unidentified", headers=wh.h).json()["data"]
    assert tracking in [p["tracking_number"] for p in inbox]
    assert client.get("/staff/packages/unidentified", headers=a.h).status_code == 403


def test_recepcion_valida_codigos_y_pesos(client, make_user):
    wh, a = make_user("swh3", "warehouse"), make_user("sd")
    base = {"tracking_number": "TRK-12345", "weight": "2", "weight_unit": "kg"}
    assert client.post("/staff/packages", headers=wh.h, json={**base, "customer_code": "OPT-UY-999999"}).status_code == 422   # cliente inexistente
    assert client.post("/staff/packages", headers=wh.h, json={**base, "purchase_code": "OPT-HAB-2026-00001"}).status_code == 422  # compra sin cliente
    assert client.post("/staff/packages", headers=wh.h, json={**base, "customer_code": a.suite, "purchase_code": "OPT-HAB-2099-99999"}).status_code == 422
    for bad in ({"weight": "0"}, {"weight": "-1"}, {"weight": "abc"}, {"weight": "6000"}, {"weight_unit": "stone"}, {"tracking_number": "x"}):
        assert client.post("/staff/packages", headers=wh.h, json={**base, **bad}).status_code == 422


def test_liquidacion_con_cargo_extra_y_pago_en_uyu(client, make_user):
    a, _wh, ag, code = _ready_purchase(client, make_user)               # base 950, 10 kg
    body = {"user_id": a.id, "purchase_codes": [code]}
    assert client.post("/staff/settlements", headers=ag.h, json={**body, "extra_charges": "10"}).status_code == 422          # sin justificación
    assert client.post("/staff/settlements", headers=ag.h, json={**body, "purchase_codes": ["no-es-codigo"]}).status_code == 422
    assert client.post("/staff/settlements", headers=ag.h, json={**body, "purchase_codes": []}).status_code == 422
    assert client.post("/staff/settlements", headers=ag.h, json={**body, "purchase_codes": ["OPT-HAB-2099-99999"]}).status_code == 422
    r = client.post("/staff/settlements", headers=ag.h, json={**body, "extra_charges": "10.50", "extra_charges_note": "Embalaje especial"})
    assert r.status_code == 201 and r.json()["data"]["total"] == "215.50"      # 95 comisión + 110 envío + 10,50
    sc = r.json()["data"]["code"]
    pay = {"currency_original": "UYU", "method": "cash", "branch": "Centro", "receipt_ref": f"U{uuid.uuid4().hex[:6]}"}
    assert client.post(f"/staff/settlements/{sc}/payments", headers=ag.h, json={**pay, "amount": "215.50"}).status_code == 422          # UYU sin cotización
    ok = client.post(f"/staff/settlements/{sc}/payments", headers=ag.h, json={**pay, "amount": "215.50", "amount_original": "8620.00", "fx_rate": "40.0000"})
    assert ok.status_code == 201 and ok.json()["data"]["settlement_status"] == "paid"
    assert client.post("/staff/settlements/LQ-2099-00000/payments", headers=ag.h, json={**pay, "amount": "1", "currency_original": "USD"}).status_code == 404


def test_tarifa_nueva_no_altera_liquidaciones_emitidas(client, make_user):
    a, _wh, ag, code = _ready_purchase(client, make_user, weight="5")
    ad = make_user("sad", "admin")
    sc = client.post("/staff/settlements", headers=ag.h, json={"user_id": a.id, "purchase_codes": [code]}).json()["data"]["code"]
    before = client.get(f"/settlements/{sc}", headers=a.h).json()["data"]
    assert client.post("/admin/tariffs", headers=ad.h, json={"commission_rate": "0.1200", "sell_rate_per_kg": "13.00", "notes": "regresión"}).status_code == 201
    assert client.get("/tariffs/current").json()["data"]["sell_rate_per_kg"] == "13.00"
    assert client.get(f"/settlements/{sc}", headers=a.h).json()["data"] == before
    # restaura la tarifa de referencia para no afectar a otras pruebas
    assert client.post("/admin/tariffs", headers=ad.h, json={"commission_rate": "0.1000", "sell_rate_per_kg": "11.00"}).status_code == 201


@pytest.mark.parametrize("payload", [{"commission_rate": "0.9", "sell_rate_per_kg": "9"}, {"commission_rate": "abc", "sell_rate_per_kg": "9"},
                                     {"commission_rate": "0.1", "sell_rate_per_kg": "0"}, {"commission_rate": "0.1", "sell_rate_per_kg": "-5"}, {}])
def test_tarifas_invalidas(client, make_user, payload):
    assert client.post("/admin/tariffs", headers=make_user("sadm", "admin").h, json=payload).status_code == 422


def test_estado_de_compra_desconocido(client, make_user):
    ag = make_user("sag2", "agent")
    assert client.post("/staff/purchases/OPT-HAB-2099-99999/status", headers=ag.h, json={"status": "accepted"}).status_code == 404
    assert client.post("/staff/purchases/OPT-HAB-2099-99999/status", headers=ag.h, json={"status": "inventado"}).status_code == 422


def test_calculadora_formatos(client):
    for bad in ({}, {"value": "abc"}, {"value": "-5"}, {"value": "10.999"}, {"value": "100", "weight_kg": "abc"}, {"value": "100", "weight_kg": "1.2345"}):
        assert client.post("/quote", json=bad).status_code == 422
    r = client.post("/quote", json={"value": "19.99", "weight_kg": "4.990"}).json()["data"]
    assert (r["commission"], r["shipping"], r["optimus_total"]) == ("2.00", "54.89", "56.89")
    assert client.get("/tariffs/current").json()["data"].keys() >= {"commission_rate", "sell_rate_per_kg", "is_reference"}


# ── compras y archivos ─────────────────────────────────────────────────────────────────────────
def test_formatos_de_comprobante_y_descarga_del_personal(client, make_user):
    a, ag = make_user("fa"), make_user("fag", "agent")
    addr = _address(client, a)
    codes = []
    for name, data, mime in (("a.png", PNG, "image/png"), ("b.jpg", JPG, "image/jpeg"), ("c.webp", WEBP, "image/webp")):
        r = _purchase_with(client, a, addr["id"], name, data, mime)
        assert r.status_code == 201, name
        codes.append(r.json()["data"]["code"])
    for code, ctype in zip(codes, ("image/png", "image/jpeg", "image/webp"), strict=True):
        d = client.get(f"/purchases/{code}/receipt", headers=ag.h)       # el personal descarga cualquier comprobante
        assert d.status_code == 200 and d.headers["content-type"] == ctype
        assert d.headers["x-content-type-options"] == "nosniff" and "attachment" in d.headers["content-disposition"]
    assert _purchase_with(client, a, addr["id"], "vacio.pdf", b"", "application/pdf").status_code == 413
    assert _purchase_with(client, a, addr["id"], "gif.pdf", b"GIF89a" + b"\x00" * 20, "application/pdf").status_code == 415


def _purchase_with(client, user, address_id, name, data, mime):
    items = json.dumps([{"description": "Producto de prueba", "qty": 1, "unit_price": "10"}])
    return client.post("/purchases", headers=user.h, data={
        "recipient_id": str(address_id), "store": "Amazon", "store_order_number": f"F-{uuid.uuid4().hex[:10]}",
        "purchased_on": time.strftime("%Y-%m-%d"), "accept_terms": "1", "items": items}, files={"receipt": (name, data, mime)})


def test_listado_de_compras_incluye_importe_y_paquetes(client, make_user):
    a, wh = make_user("pl"), make_user("plw", "warehouse")
    code = _purchase(client, a, _address(client, a)["id"]).json()["data"]["code"]
    assert client.get("/purchases", headers=a.h).json()["data"][0]["products_amount"] == "950.00"
    client.post("/staff/packages", headers=wh.h, json={"tracking_number": f"TRK-{uuid.uuid4().hex[:8]}", "customer_code": a.suite, "purchase_code": code, "weight": "4", "weight_unit": "kg"})
    assert client.get(f"/purchases/{code}", headers=a.h).json()["data"]["packages"][0]["weight_kg"] == "4.000"


@pytest.mark.parametrize("override", [{"store_taxes": "-1"}, {"store_taxes": "abc"}, {"store": "A"}, {"store_order_number": "ab"}, {"purchased_on": "25/10/2026"},
                                      {"purchased_on": "2026-02-30"}, {"recipient_id": "abc"}, {"notes": "x" * 501}])
def test_compra_campos_invalidos(client, make_user, override):
    a = make_user("cv")
    addr = _address(client, a)
    items = json.dumps([{"description": "Producto de prueba", "qty": 1, "unit_price": "10"}])
    data = {"recipient_id": str(addr["id"]), "store": "Amazon", "store_order_number": f"V-{uuid.uuid4().hex[:8]}", "purchased_on": time.strftime("%Y-%m-%d"),
            "accept_terms": "1", "items": items, **override}
    assert client.post("/purchases", headers=a.h, data=data, files={"receipt": ("f.pdf", PDF, "application/pdf")}).status_code == 422


def test_compra_con_muchos_productos_o_json_roto(client, make_user):
    a = make_user("cm")
    addr = _address(client, a)
    base = {"recipient_id": str(addr["id"]), "store": "Amazon", "purchased_on": time.strftime("%Y-%m-%d"), "accept_terms": "1"}
    f = lambda: {"receipt": ("f.pdf", PDF, "application/pdf")}  # noqa: E731
    too_many = json.dumps([{"description": "Producto", "qty": 1, "unit_price": "1"}] * 51)
    assert client.post("/purchases", headers=a.h, data={**base, "store_order_number": "M-1" + uuid.uuid4().hex[:6], "items": too_many}, files=f()).status_code == 422
    assert client.post("/purchases", headers=a.h, data={**base, "store_order_number": "M-2" + uuid.uuid4().hex[:6], "items": "{rota"}, files=f()).status_code == 422
    assert client.post("/purchases", headers=a.h, data={**base, "store_order_number": "M-3" + uuid.uuid4().hex[:6], "items": json.dumps(["no-objeto"])}, files=f()).status_code == 422


# ── cabeceras, errores y modo producción ───────────────────────────────────────────────────────
def test_cabeceras_en_errores_y_preflight(client):
    for r in (client.get("/no-existe"), client.post("/quote", json={}), client.get("/user")):
        assert r.headers["x-content-type-options"] == "nosniff" and r.headers["content-security-policy"].startswith("default-src 'none'")
        assert r.headers["content-type"].startswith("application/json")
    pre = client.options("/user", headers={"Origin": "https://shop.example"})
    assert pre.status_code == 204 and pre.headers["access-control-allow-origin"] == "https://shop.example"
    assert "authorization" in pre.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-origin" not in client.options("/user", headers={"Origin": "https://evil.example"}).headers


def test_cuerpo_demasiado_grande_se_rechaza_antes_de_leerlo(client):
    r = client.post("/purchases", content=b"x", headers={"Content-Length": str(50 * 1024 * 1024), "Content-Type": "application/json"})
    assert r.status_code == 413


def test_el_cuerpo_json_invalido_da_422_no_500(client):
    r = client.post("/auth/login", content=b"{no es json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and "errors" not in r.json()
    assert client.post("/quote", content=b"[1,2]", headers={"Content-Type": "application/json"}).status_code == 422


def test_modo_produccion_exige_https_y_activa_hsts(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "app_env", "production")
    monkeypatch.setattr(s, "trusted_proxies", "testclient")                    # el TestClient se presenta como host "testclient"
    r = client.get("/tariffs/current")
    assert r.status_code == 426 and "access-control-allow-origin" not in r.headers
    ok = client.get("/tariffs/current", headers={"X-Forwarded-Proto": "https", "Origin": "https://shop.example"})
    assert ok.status_code == 200 and "max-age=31536000" in ok.headers["strict-transport-security"]
    assert ok.headers["access-control-allow-origin"] == "https://shop.example"
    # en producción no se permite el origen de desarrollo
    dev = client.get("/tariffs/current", headers={"X-Forwarded-Proto": "https", "Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" not in dev.headers


def test_healthz_no_requiere_base_ni_autenticacion(client):
    r = client.get("/healthz")
    assert r.status_code == 200 and r.json()["data"] == {"status": "up"}
