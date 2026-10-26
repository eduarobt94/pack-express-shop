"""Compras: pedidos hechos por el cliente en tiendas de EE.UU. El producto se paga en la tienda; aquí solo se
registra (con comprobante) para gestionarlo. Todo acceso se filtra por user_id (404 si es de otro cliente)."""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.exc import DBAPIError

from app.api.deps import current_user, get_db, rate_limit_general, rate_limit_sensitive
from app.config import get_settings
from app.core import money
from app.core.errors import ApiError, db_error_code
from app.core.logging import log
from app.core.responses import ApiResponse, created, ok
from app.db import Db
from app.schemas import PurchaseIn, PurchaseItemIn, PurchaseTrackingIn, parse
from app.services import files

router = APIRouter(prefix="/purchases", tags=["purchases"])
RL = [Depends(rate_limit_general)]

_COLS = (
    "p.id, p.code, p.store, p.store_order_number, p.purchased_on, p.currency, p.store_taxes, p.store_shipping, "
    "p.status, p.notes, p.created_at, a.label AS recipient_label, a.recipient AS recipient_name, a.province AS recipient_province"
)


def _load(db: Db, code: str, user_id: int) -> dict[str, Any]:
    p = db.one(
        f"SELECT {_COLS} FROM purchases p JOIN addresses a ON a.id = p.recipient_id "  # noqa: S608 (columnas fijas)
        "WHERE p.code = :c AND p.user_id = :u",
        {"c": code, "u": user_id},
    )
    if not p:  # 404 también si es de otro cliente: no se revela que existe
        raise ApiError.not_found("Compra no encontrada")
    p["items"] = db.query(
        "SELECT description, url, model, qty, unit_price, discount, line_amount FROM purchase_items WHERE purchase_id = :i ORDER BY id",
        {"i": int(p["id"])},
    )
    p["trackings"] = db.query(
        "SELECT tracking_number, carrier, created_at FROM purchase_trackings WHERE purchase_id = :i ORDER BY id",
        {"i": int(p["id"])},
    )
    p["packages"] = db.query(
        "SELECT id, tracking_number, weight_kg, status, received_at FROM packages WHERE purchase_id = :i AND user_id = :u",
        {"i": int(p["id"]), "u": user_id},
    )
    del p["id"]
    return p


def _parse_trackings(raw: str | None) -> list[PurchaseTrackingIn]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except ValueError:
        data = None
    if not isinstance(data, list) or len(data) > 20:
        raise ApiError(422, "Los seguimientos deben ser una lista de hasta 20")
    out: list[PurchaseTrackingIn] = []
    seen: set[str] = set()
    for n, entry in enumerate(data, start=1):
        if not isinstance(entry, dict):
            raise ApiError(422, f"Seguimiento #{n} inválido")
        t = parse(PurchaseTrackingIn, entry, f"Seguimiento #{n} inválido")
        key = (t.tracking_number or "").strip().upper()
        if key in seen:
            raise ApiError(422, f"Seguimiento #{n} repetido")
        seen.add(key)
        out.append(t)
    return out


@router.get("", dependencies=RL)
def index(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    rows = db.query(
        f"SELECT {_COLS}, (SELECT COALESCE(SUM(line_amount),0) FROM purchase_items i WHERE i.purchase_id = p.id) AS products_amount "  # noqa: S608
        "FROM purchases p JOIN addresses a ON a.id = p.recipient_id WHERE p.user_id = :u ORDER BY p.created_at DESC LIMIT 200",
        {"u": int(user["id"])},
    )
    # Seguimientos de todas las compras del cliente en una sola consulta (sin N+1)
    by_purchase: dict[int, list[dict[str, Any]]] = {}
    for t in db.query(
        "SELECT t.purchase_id, t.tracking_number, t.carrier FROM purchase_trackings t "
        "JOIN purchases p ON p.id = t.purchase_id WHERE p.user_id = :u ORDER BY t.id",
        {"u": int(user["id"])},
    ):
        by_purchase.setdefault(int(t["purchase_id"]), []).append({"tracking_number": t["tracking_number"], "carrier": t["carrier"]})
    for r in rows:
        r["trackings"] = by_purchase.get(int(r["id"]), [])
    return ok(rows)


@router.get("/{code}", dependencies=RL)
def show(code: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    return ok(_load(db, code, int(user["id"])))


@router.post("/{code}/trackings", dependencies=[Depends(rate_limit_sensitive)], status_code=201)
def add_tracking(code: str, body: dict[str, Any], user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    """Agrega un seguimiento a una compra propia (por ejemplo, si la tienda la dividió en varios envíos)."""
    uid = int(user["id"])
    p = db.one("SELECT id, status FROM purchases WHERE code = :c AND user_id = :u", {"c": code, "u": uid})
    if not p:
        raise ApiError.not_found("Compra no encontrada")
    if p["status"] == "cancelled":
        raise ApiError(409, "La compra está cancelada")
    t = parse(PurchaseTrackingIn, body, "Seguimiento inválido")
    assert t.tracking_number
    try:
        db.execute(
            "INSERT INTO purchase_trackings (purchase_id, tracking_number, carrier) VALUES (:p,:t,:c)",
            {"p": int(p["id"]), "t": t.tracking_number, "c": t.carrier},
        )
    except DBAPIError as exc:
        errno, _ = db_error_code(exc)
        if errno == 1062:
            raise ApiError(409, "Ese seguimiento ya está registrado en la compra") from exc
        raise ApiError(500, "No se pudo agregar el seguimiento") from exc
    log.audit("purchase_tracking_add", uid, purchase=code)
    return created(_load(db, code, uid), "Seguimiento agregado")


@router.get("/{code}/receipt", dependencies=RL)
def receipt(code: str, user: dict = Depends(current_user), db: Db = Depends(get_db)):  # noqa: ANN201
    """Solo el dueño (o el personal) descarga el comprobante."""
    if user["role"] in ("agent", "admin"):
        row = db.one("SELECT receipt_path FROM purchases WHERE code = :c", {"c": code})
    else:
        row = db.one("SELECT receipt_path FROM purchases WHERE code = :c AND user_id = :u", {"c": code, "u": int(user["id"])})
    if not row:
        raise ApiError.not_found("Compra no encontrada")
    return files.stream(row["receipt_path"])


@router.post("", dependencies=[Depends(rate_limit_sensitive)], status_code=201)
def create(
    recipient_id: str | None = Form(None),
    store: str | None = Form(None),
    store_order_number: str | None = Form(None),
    purchased_on: str | None = Form(None),
    store_taxes: str | None = Form(None),
    store_shipping: str | None = Form(None),
    notes: str | None = Form(None),
    accept_terms: str | None = Form(None),
    items: str | None = Form(None),
    trackings: str | None = Form(None),
    receipt: UploadFile | None = File(None),
    user: dict = Depends(current_user),
    db: Db = Depends(get_db),
) -> ApiResponse:
    uid = int(user["id"])
    form = parse(
        PurchaseIn,
        {
            "recipient_id": recipient_id,
            "store": store,
            "store_order_number": store_order_number,
            "purchased_on": purchased_on,
            "store_taxes": store_taxes,
            "store_shipping": store_shipping,
            "notes": notes,
        },
    )
    if (accept_terms or "").lower() not in ("1", "true", "on", "yes"):
        raise ApiError(422, "Tenés que aceptar las condiciones del servicio")
    assert form.purchased_on and form.recipient_id and form.store and form.store_order_number
    if time.mktime(time.strptime(form.purchased_on, "%Y-%m-%d")) > time.time() + 86400:
        raise ApiError(422, "La fecha de compra no puede ser futura")

    # Productos
    try:
        raw_items = json.loads(items or "")
    except ValueError:
        raw_items = None
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 50:
        raise ApiError(422, "Agregá entre 1 y 50 productos")
    clean: list[PurchaseItemIn] = []
    for n, raw in enumerate(raw_items, start=1):
        if not isinstance(raw, dict):
            raise ApiError(422, f"Producto #{n} inválido")
        item = parse(PurchaseItemIn, raw, f"Producto #{n} inválido")
        assert item.unit_price and item.qty
        gross = money.to_cents(item.unit_price) * int(item.qty)
        if money.to_cents(item.discount or "0") > gross:
            raise ApiError(422, f"Producto #{n}: el descuento supera el importe")
        clean.append(item)

    # Seguimientos de la tienda o del transportista (opcionales; se pueden agregar después)
    clean_trk = _parse_trackings(trackings)

    # El destinatario debe ser del cliente (además lo exige la FK compuesta de la base)
    addr = db.one("SELECT id, province FROM addresses WHERE id = :i AND user_id = :u", {"i": int(form.recipient_id), "u": uid})
    if not addr:
        raise ApiError(422, "Destinatario inválido")

    if receipt is None:
        raise ApiError(422, "El comprobante de la compra es obligatorio")
    receipt_key = files.save_upload(receipt)

    year = time.localtime().tm_year
    try:
        with db.tx():
            code = f"OPT-{addr['province']}-{year}-{db.next_seq('purchase', year):05d}"
            pid = db.insert(
                "INSERT INTO purchases (code, user_id, recipient_id, store, store_order_number, purchased_on, store_taxes, "
                "store_shipping, receipt_path, terms_version, terms_accepted_at, notes) "
                "VALUES (:c,:u,:r,:s,:o,:d,:t,:sh,:rp,:tv,NOW(),:n)",
                {
                    "c": code,
                    "u": uid,
                    "r": int(addr["id"]),
                    "s": form.store,
                    "o": form.store_order_number,
                    "d": form.purchased_on,
                    "t": form.store_taxes or "0",
                    "sh": form.store_shipping or "0",
                    "rp": receipt_key,
                    "tv": get_settings().terms_version,
                    "n": form.notes,
                },
            )
            for it in clean:
                db.execute(
                    "INSERT INTO purchase_items (purchase_id, description, url, model, qty, unit_price, discount) "
                    "VALUES (:p,:d,:u,:m,:q,:up,:dc)",
                    {
                        "p": pid,
                        "d": it.description,
                        "u": it.url,
                        "m": it.model,
                        "q": int(it.qty or 1),
                        "up": it.unit_price,
                        "dc": it.discount or "0",
                    },
                )
            for t in clean_trk:
                db.execute(
                    "INSERT INTO purchase_trackings (purchase_id, tracking_number, carrier) VALUES (:p,:t,:c)",
                    {"p": pid, "t": t.tracking_number, "c": t.carrier},
                )
    except DBAPIError as exc:
        files.delete(receipt_key)
        errno, msg = db_error_code(exc)
        if errno == 1062 and "uq_purchases_store_order" in msg:
            raise ApiError(409, "Ya registraste esa compra de la tienda") from exc
        log.error("purchase_create_failed", error=msg)
        raise ApiError(500, "No se pudo registrar la compra") from exc

    log.audit("purchase_create", uid, purchase=code)
    return created(_load(db, code, uid), "Compra registrada")
