"""Recuperación de contraseña por correo y seguimientos de compra (requisitos de la especificación v1)."""

from __future__ import annotations

import json
import re
import time
import uuid

from app.services import mailer
from tests.conftest import PDF
from tests.test_api import _address


def _reset_link_for(email: str) -> str | None:
    for m in reversed(mailer.outbox):
        if m.to == email:
            found = re.search(r"/restablecer\?token=([a-f0-9]{64})", m.body)
            return found.group(1) if found else None
    return None


# ── recuperación de contraseña ───────────────────────────────────────────────────────────────────
def test_recuperacion_envia_enlace_y_permite_cambiar_la_clave(client, make_user) -> None:
    u = make_user("rec")
    r = client.post("/auth/forgot-password", json={"email": u.email})
    assert r.status_code == 200
    token = _reset_link_for(u.email)
    assert token, "debe haberse enviado un correo con el enlace"

    r = client.post("/auth/reset-password", json={"token": token, "password": "Nueva-Clave-456"})
    assert r.status_code == 200, r.text
    assert client.post("/auth/login", json={"email": u.email, "password": u.password}).status_code == 401
    assert client.post("/auth/login", json={"email": u.email, "password": "Nueva-Clave-456"}).status_code == 200
    # El token es de un solo uso y las sesiones anteriores quedan cerradas
    assert client.post("/auth/reset-password", json={"token": token, "password": "Otra-Clave-789"}).status_code == 400
    assert client.get("/user", headers=u.h).status_code == 401


def test_recuperacion_no_revela_si_la_cuenta_existe(client) -> None:
    antes = len(mailer.outbox)
    ok = client.post("/auth/forgot-password", json={"email": f"nadie.{uuid.uuid4().hex[:8]}@pytest.uy"})
    assert ok.status_code == 200
    assert len(mailer.outbox) == antes  # no se envía nada a cuentas inexistentes
    assert "Si el email existe" in ok.json()["message"]


def test_recuperacion_rechaza_tokens_invalidos_y_claves_debiles(client, make_user) -> None:
    u = make_user("recbad")
    client.post("/auth/forgot-password", json={"email": u.email})
    token = _reset_link_for(u.email)
    assert client.post("/auth/reset-password", json={"token": "x" * 64, "password": "Nueva-Clave-456"}).status_code in (400, 422)
    assert client.post("/auth/reset-password", json={"token": "no-es-hex", "password": "Nueva-Clave-456"}).status_code == 422
    assert client.post("/auth/reset-password", json={"token": token, "password": "corta"}).status_code == 422
    # un token vencido no sirve
    return None


def test_recuperacion_token_vencido(client, make_user, raw_db) -> None:
    u = make_user("recexp")
    client.post("/auth/forgot-password", json={"email": u.email})
    token = _reset_link_for(u.email)
    raw_db.cursor().execute("UPDATE password_reset_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE email=%s", (u.email,))
    assert client.post("/auth/reset-password", json={"token": token, "password": "Nueva-Clave-456"}).status_code == 400


def test_el_token_se_guarda_solo_como_hash(client, make_user, raw_db) -> None:
    u = make_user("rechash")
    client.post("/auth/forgot-password", json={"email": u.email})
    token = _reset_link_for(u.email)
    cur = raw_db.cursor()
    cur.execute("SELECT token FROM password_reset_tokens WHERE email=%s", (u.email,))
    assert cur.fetchone()[0] != token


# ── seguimientos de la compra ────────────────────────────────────────────────────────────────────
def _buy(client, user, address_id, trackings=None):
    data = {
        "recipient_id": str(address_id),
        "store": "Amazon",
        "store_order_number": f"112-{uuid.uuid4().hex[:8]}",
        "purchased_on": time.strftime("%Y-%m-%d"),
        "accept_terms": "1",
        "items": json.dumps([{"description": "Lámpara solar", "qty": 1, "unit_price": "40.00"}]),
    }
    if trackings is not None:
        data["trackings"] = json.dumps(trackings)
    return client.post("/purchases", headers=user.h, data=data, files={"receipt": ("f.pdf", PDF, "application/pdf")})


def test_compra_con_seguimientos_y_agregado_posterior(client, make_user) -> None:
    a, b = make_user("tka"), make_user("tkb")
    addr = _address(client, a)
    r = _buy(client, a, addr["id"], [{"tracking_number": "TBA123456789", "carrier": "Amazon Logistics"}])
    assert r.status_code == 201, r.text
    code = r.json()["data"]["code"]
    assert [t["tracking_number"] for t in r.json()["data"]["trackings"]] == ["TBA123456789"]

    # la compra se dividió: se agrega otro seguimiento
    r = client.post(f"/purchases/{code}/trackings", headers=a.h, json={"tracking_number": "1Z999AA10123456784", "carrier": "UPS"})
    assert r.status_code == 201 and len(r.json()["data"]["trackings"]) == 2
    assert client.post(f"/purchases/{code}/trackings", headers=a.h, json={"tracking_number": "1Z999AA10123456784"}).status_code == 409
    # otro cliente no puede tocar ni ver la compra
    assert client.post(f"/purchases/{code}/trackings", headers=b.h, json={"tracking_number": "ZZZ-111122"}).status_code == 404
    assert client.get(f"/purchases/{code}", headers=b.h).status_code == 404


def test_seguimientos_invalidos_se_rechazan(client, make_user) -> None:
    a = make_user("tkv")
    addr = _address(client, a)
    assert _buy(client, a, addr["id"], [{"tracking_number": "ab"}]).status_code == 422  # muy corto
    assert _buy(client, a, addr["id"], [{"tracking_number": "<script>alert(1)</script>"}]).status_code == 422
    assert _buy(client, a, addr["id"], [{"tracking_number": "TBA111122223"}, {"tracking_number": "tba111122223"}]).status_code == 422
    assert _buy(client, a, addr["id"], "no-es-lista").status_code == 422
    assert _buy(client, a, addr["id"], [{"tracking_number": f"TRK{i:06d}"} for i in range(21)]).status_code == 422


def test_compra_sin_seguimientos_sigue_siendo_valida(client, make_user) -> None:
    a = make_user("tk0")
    r = _buy(client, a, _address(client, a)["id"])
    assert r.status_code == 201 and r.json()["data"]["trackings"] == []


def test_el_listado_de_compras_incluye_los_seguimientos_solo_del_dueno(client, make_user) -> None:
    a, b = make_user("tkl"), make_user("tkm")
    addr = _address(client, a)
    code = _buy(client, a, addr["id"], [{"tracking_number": "TBA555566667"}]).json()["data"]["code"]
    client.post(f"/purchases/{code}/trackings", headers=a.h, json={"tracking_number": "1Z000000000000001", "carrier": "UPS"})
    rows = client.get("/purchases", headers=a.h).json()["data"]
    assert [t["tracking_number"] for t in rows[0]["trackings"]] == ["TBA555566667", "1Z000000000000001"]
    assert client.get("/purchases", headers=b.h).json()["data"] == []
