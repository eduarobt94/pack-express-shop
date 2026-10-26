"""Casillero (paquetes y envíos del cliente) y rutas del modelo anterior (solo lectura / deshabilitadas).

Los endpoints de pre-alertas y órdenes pertenecen al modelo anterior (el producto se pagaba en la plataforma):
se conservan GET y la cancelación de pre-alertas históricas; las creaciones responden 410 (ver docs).
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import current_user, get_db, rate_limit_general
from app.core.errors import ApiError
from app.core.logging import log
from app.core.responses import ApiResponse, ok
from app.db import Db

router = APIRouter(tags=["locker"], dependencies=[Depends(rate_limit_general)])

_PKG = (
    "id, suite_id, purchase_id, tracking_number, store, description, declared_value, weight_kg, status, received_at, "
    "photo_url, retained_reason, notes, created_at"
)
_PACKAGE_STATUS = {
    "in_transit",
    "received",
    "verifying",
    "no_docs",
    "ready",
    "retained",
    "shipped",
    "pending_reception",
    "received_us",
    "preparing",
    "dispatched",
    "in_cuba",
    "out_for_delivery",
    "delivered",
    "incident",
}
_SHIP = (
    "ls.id, ls.suite_id, ls.address_id, ls.total_weight_kg, ls.status, ls.operator_guide, ls.created_at, ls.dispatched_at, ls.delivered_at"
)


def _json_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else json.loads(value)


@router.get("/locker")
def locker(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    row = db.one(
        "SELECT s.suite_id, s.country, s.member_since, "
        "COUNT(CASE WHEN p.status NOT IN ('shipped') THEN 1 END) AS packages_in_locker, "
        "COUNT(CASE WHEN p.status = 'ready' THEN 1 END) AS `ready`, COUNT(CASE WHEN p.status = 'retained' THEN 1 END) AS retained, "
        "COUNT(pa.id) AS pending_alerts FROM suites s "
        "LEFT JOIN packages p ON p.suite_id = s.suite_id LEFT JOIN pre_alerts pa ON pa.suite_id = s.suite_id AND pa.status = 'pending' "
        "WHERE s.user_id = :u GROUP BY s.suite_id",
        {"u": int(user["id"])},
    )
    if not row:
        raise ApiError.not_found("Suite no encontrada")
    return ok(row)


@router.get("/locker/packages")
def packages(status: str | None = None, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    params: dict[str, Any] = {"u": int(user["id"])}
    sql = f"SELECT {_PKG} FROM packages WHERE user_id = :u"  # noqa: S608 (columnas fijas)
    if status in _PACKAGE_STATUS:  # lista blanca
        sql += " AND status = :s"
        params["s"] = status
    rows = db.query(sql + " ORDER BY received_at DESC", params)
    for r in rows:
        r["notes"] = _json_list(r["notes"])
    return ok(rows)


@router.get("/locker/packages/{package_id}")
def package_detail(package_id: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    pkg = db.one(f"SELECT {_PKG} FROM packages WHERE id = :i AND user_id = :u", {"i": package_id, "u": int(user["id"])})  # noqa: S608
    if not pkg:
        raise ApiError.not_found("Paquete no encontrado")
    pkg["notes"] = _json_list(pkg["notes"])
    return ok(pkg)


def _package_ids(db: Db, shipment_ids: list[str]) -> dict[str, list[str]]:
    """Ids de paquetes por envío con una consulta portable (JSON_ARRAYAGG no existe en MariaDB < 10.5)."""
    ids: dict[str, list[str]] = {s: [] for s in shipment_ids}
    if shipment_ids:
        binds = {f"s{i}": s for i, s in enumerate(shipment_ids)}
        marks = ",".join(f":s{i}" for i in range(len(shipment_ids)))
        for r in db.query(
            f"SELECT shipment_id, package_id FROM locker_shipment_packages WHERE shipment_id IN ({marks}) ORDER BY package_id",  # noqa: S608 (solo marcadores :sN)
            binds,
        ):
            ids[r["shipment_id"]].append(r["package_id"])
    return ids


@router.get("/locker/shipments")
def shipments(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    rows = db.query(f"SELECT {_SHIP} FROM locker_shipments ls WHERE ls.user_id = :u ORDER BY ls.created_at DESC", {"u": int(user["id"])})  # noqa: S608
    ids = _package_ids(db, [r["id"] for r in rows])
    for r in rows:
        r["package_ids"] = ids[r["id"]]
    return ok(rows)


@router.get("/locker/shipments/{shipment_id}")
def shipment_detail(shipment_id: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    s = db.one(f"SELECT {_SHIP} FROM locker_shipments ls WHERE ls.id = :i AND ls.user_id = :u", {"i": shipment_id, "u": int(user["id"])})  # noqa: S608
    if not s:
        raise ApiError.not_found("Envío no encontrado")
    s["package_ids"] = _package_ids(db, [s["id"]])[s["id"]]
    return ok(s)


# ── modelo anterior ────────────────────────────────────────────────────────────────────────────
@router.get("/pre-alerts")
def pre_alerts(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    """Sin factura_path (ruta interna del servidor)."""
    return ok(
        db.query(
            "SELECT id, tracking_number, store, description, declared_value, pieces, carrier, status, created_at "
            "FROM pre_alerts WHERE user_id = :u ORDER BY created_at DESC LIMIT 200",
            {"u": int(user["id"])},
        )
    )


@router.post("/pre-alerts")
def pre_alert_create(_: dict = Depends(current_user)) -> ApiResponse:
    raise ApiError(410, "Las pre-alertas fueron reemplazadas por el registro de compras (POST /purchases)")


@router.delete("/pre-alerts/{alert_id}")
def pre_alert_cancel(alert_id: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    alert = db.one("SELECT id, status FROM pre_alerts WHERE id = :i AND user_id = :u", {"i": alert_id, "u": int(user["id"])})
    if not alert:
        raise ApiError.not_found("Pre-alerta no encontrada")
    if alert["status"] == "received":
        raise ApiError(409, "No se puede cancelar una pre-alerta ya recibida")
    db.execute("UPDATE pre_alerts SET status = 'cancelled' WHERE id = :i AND user_id = :u", {"i": alert_id, "u": int(user["id"])})
    log.audit("pre_alert_cancel", int(user["id"]), pre_alert_id=alert_id)
    return ok(None, "Pre-alerta cancelada")


@router.get("/orders")
def orders(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    rows = db.query(
        "SELECT o.id, o.method, o.status, o.subtotal, o.shipping, o.customs, o.total, o.eta, o.paid_at, o.created_at "
        "FROM orders o WHERE o.user_id = :u ORDER BY o.created_at DESC",
        {"u": int(user["id"])},
    )
    items: dict[str, list[dict[str, Any]]] = {r["id"]: [] for r in rows}
    if rows:
        binds = {f"o{i}": r["id"] for i, r in enumerate(rows)}
        marks = ",".join(f":o{i}" for i in range(len(rows)))
        for it in db.query(
            f"SELECT order_id, product_id, name, qty, unit_price FROM order_items WHERE order_id IN ({marks}) ORDER BY id",  # noqa: S608 (solo marcadores :oN)
            binds,
        ):
            items[it.pop("order_id")].append(it)
    for r in rows:
        r["items"] = items[r["id"]]
    return ok(rows)


@router.get("/orders/{order_id}")
def order(order_id: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    o = db.one(
        "SELECT o.id, o.method, o.status, o.subtotal, o.shipping, o.customs, o.total, o.eta, o.paid_at, o.created_at "
        "FROM orders o WHERE o.id = :i AND o.user_id = :u",
        {"i": order_id, "u": int(user["id"])},
    )
    if not o:
        raise ApiError.not_found("Orden no encontrada")
    o["items"] = db.query("SELECT product_id, name, qty, unit_price FROM order_items WHERE order_id = :i", {"i": order_id})
    return ok(o)


@router.post("/orders")
def order_create(_: dict = Depends(current_user)) -> ApiResponse:
    """DESHABILITADO: aceptaba precios enviados por el cliente y tenía un INSERT inválido. Ver POST /purchases."""
    raise ApiError(410, "Este endpoint fue reemplazado por POST /purchases")
