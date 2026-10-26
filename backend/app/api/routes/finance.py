"""Tarifas, calculadora, liquidaciones (cliente) y operaciones del personal (liquidar, cobrar, recibir paquetes)."""

from __future__ import annotations

import time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.exc import DBAPIError

from app.api.deps import current_user, get_db, rate_limit_general, rate_limit_sensitive, require_admin, require_staff, require_warehouse
from app.core import money
from app.core.errors import ApiError, raise_db_error
from app.core.logging import log
from app.core.responses import ApiResponse, created, ok
from app.db import Db
from app.schemas import PackageReceiveIn, PaymentIn, PurchaseStatusIn, QuoteIn, SettlementIn, TariffIn
from app.services import settlements

router = APIRouter(tags=["finance"])
RL = [Depends(rate_limit_general)]

_PUBLIC_COLS = (
    "s.code, s.version, s.commission_rate, s.sell_rate_per_kg, s.product_base, s.commission, s.weight_billable_kg, "
    "s.shipping, s.extra_charges, s.extra_charges_note, s.total, s.status, s.issued_at"
)
_LB_PER_KG = Decimal("2.20462262")


# ── tarifas públicas (sin costos internos ni márgenes) ───────────────────────────────────────────
@router.get("/tariffs/current", dependencies=RL)
def tariff_current(db: Db = Depends(get_db)) -> ApiResponse:
    t = settlements.current_tariff(db)
    del t["id"]
    return ok(t)


@router.post("/quote", dependencies=RL)
def quote(body: QuoteIn, db: Db = Depends(get_db)) -> ApiResponse:
    """Estimación. Sin peso NO inventa un total: devuelve needs_quote."""
    assert body.value
    t = settlements.current_tariff(db)
    base = money.to_cents(body.value)
    comm = money.commission(base, format(t["commission_rate"], "f"))
    out: dict[str, Any] = {
        "estimate": True,
        "product_value": money.fmt(base),
        "commission": money.fmt(comm),
        "shipping": None,
        "optimus_total": None,
        "needs_quote": True,
        "customs_included": False,
        "tariff_is_reference": bool(t["is_reference"]),
    }
    if body.weight_kg and Decimal(body.weight_kg) > 0:
        ship = money.shipping(body.weight_kg, format(t["sell_rate_per_kg"], "f"))
        out.update(shipping=money.fmt(ship), optimus_total=money.fmt(comm + ship), needs_quote=False)
    return ok(out)


@router.post("/admin/tariffs", dependencies=[Depends(rate_limit_sensitive)])
def create_tariff(body: TariffIn, admin: dict = Depends(require_admin), db: Db = Depends(get_db)) -> ApiResponse:
    new_id = db.insert(
        "INSERT INTO tariff_versions (commission_rate, sell_rate_per_kg, effective_from, is_reference, notes, created_by) "
        "VALUES (:c,:s,NOW(),0,:n,:u)",
        {"c": body.commission_rate, "s": body.sell_rate_per_kg, "n": body.notes, "u": int(admin["id"])},
    )
    log.audit("tariff_create", int(admin["id"]), tariff_id=new_id)
    return created({"id": new_id}, "Nueva versión de tarifa creada (las liquidaciones ya emitidas no cambian)")


# ── liquidaciones del cliente ───────────────────────────────────────────────────────────────────
@router.get("/settlements", dependencies=RL)
def my_settlements(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    rows = db.query(
        f"SELECT {_PUBLIC_COLS} FROM settlements s WHERE s.user_id = :u AND s.status <> 'estimate' "  # noqa: S608 (columnas fijas)
        "ORDER BY s.created_at DESC LIMIT 200",
        {"u": int(user["id"])},
    )
    return ok(rows)


@router.get("/settlements/{code}", dependencies=RL)
def my_settlement(code: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    s = db.one(
        f"SELECT s.id, {_PUBLIC_COLS} FROM settlements s WHERE s.code = :c AND s.user_id = :u AND s.status <> 'estimate'",  # noqa: S608
        {"c": code, "u": int(user["id"])},
    )
    if not s:
        raise ApiError.not_found("Liquidación no encontrada")
    sid = int(s.pop("id"))
    s["purchases"] = db.query(
        "SELECT p.code, l.product_base, l.weight_kg FROM settlement_lines l "
        "JOIN purchases p ON p.id = l.purchase_id WHERE l.settlement_id = :s ORDER BY p.code",
        {"s": sid},
    )
    paid = db.one("SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE settlement_id = :s", {"s": sid})
    s["paid"] = money.fmt(money.to_cents(format(paid["t"], "f"))) if paid else "0.00"
    return ok(s)


# ── personal ─────────────────────────────────────────────────────────────────────────────────
@router.post("/staff/settlements", dependencies=[Depends(rate_limit_sensitive)])
def staff_issue(body: SettlementIn, staff: dict = Depends(require_staff), db: Db = Depends(get_db)) -> ApiResponse:
    return created(settlements.issue(db, int(staff["id"]), body), "Liquidación emitida")


@router.post("/staff/settlements/{code}/payments", dependencies=[Depends(rate_limit_sensitive)])
def staff_pay(code: str, body: PaymentIn, staff: dict = Depends(require_staff), db: Db = Depends(get_db)) -> ApiResponse:
    return created(settlements.register_payment(db, int(staff["id"]), code, body), "Pago registrado")


@router.post("/staff/purchases/{code}/status", dependencies=[Depends(rate_limit_sensitive)])
def staff_purchase_status(code: str, body: PurchaseStatusIn, staff: dict = Depends(require_staff), db: Db = Depends(get_db)) -> ApiResponse:
    """La máquina de estados la hace cumplir la base de datos (tabla status_transitions + triggers)."""
    try:
        db.execute("UPDATE purchases SET status = :s WHERE code = :c", {"s": body.status, "c": code})
    except DBAPIError as exc:
        raise_db_error(exc)
    if not db.one("SELECT id FROM purchases WHERE code = :c", {"c": code}):
        raise ApiError.not_found("Compra no encontrada")
    log.audit("purchase_status", int(staff["id"]), purchase=code, status=body.status)
    return ok(None, "Estado actualizado")


@router.post("/staff/packages", dependencies=[Depends(rate_limit_sensitive)])
def receive_package(body: PackageReceiveIn, staff: dict = Depends(require_warehouse), db: Db = Depends(get_db)) -> ApiResponse:
    """Sin customer_code el paquete queda NO IDENTIFICADO (bandeja de revisión): nunca se asigna por suposición."""
    assert body.tracking_number and body.weight and body.weight_unit
    user_id: int | None = None
    suite: str | None = None
    purchase_id: int | None = None
    if body.customer_code:
        s = db.one("SELECT user_id, suite_id FROM suites WHERE suite_id = :c", {"c": body.customer_code})
        if not s:
            raise ApiError(422, "Código de cliente inexistente")
        user_id, suite = int(s["user_id"]), s["suite_id"]
    if body.purchase_code:
        if user_id is None:
            raise ApiError(422, "Para vincular una compra hay que identificar al cliente")
        p = db.one("SELECT id FROM purchases WHERE code = :c AND user_id = :u", {"c": body.purchase_code, "u": user_id})
        if not p:
            raise ApiError(422, "La compra no existe o no pertenece a ese cliente")
        purchase_id = int(p["id"])

    # Conversión sin perder el dato original: se guarda el peso cargado y su unidad.
    original = Decimal(body.weight)
    kg = original if body.weight_unit == "kg" else (original / _LB_PER_KG).quantize(Decimal("0.001"))
    if kg <= 0:
        raise ApiError(422, "Peso inválido")
    year = time.localtime().tm_year
    status = "unidentified" if user_id is None else "received_us"
    try:
        package_id = f"WR-{year}-{db.next_seq('package', year):05d}"
        db.execute(
            "INSERT INTO packages (id, user_id, suite_id, purchase_id, tracking_number, weight_kg, weight_original, weight_unit, "
            "observed_condition, status, received_at) VALUES (:i,:u,:s,:p,:t,:kg,:wo,:wu,:c,:st,NOW())",
            {
                "i": package_id,
                "u": user_id,
                "s": suite,
                "p": purchase_id,
                "t": body.tracking_number,
                "kg": format(kg, "f"),
                "wo": body.weight,
                "wu": body.weight_unit,
                "c": body.condition,
                "st": status,
            },
        )
    except DBAPIError as exc:
        raise_db_error(exc)
    log.audit("package_receive", int(staff["id"]), package=package_id, identified=user_id is not None)
    return created({"id": package_id, "weight_kg": format(kg, "f"), "status": status}, "Paquete registrado")


@router.get("/staff/packages/unidentified", dependencies=[Depends(rate_limit_sensitive)])
def unidentified(_: dict = Depends(require_warehouse), db: Db = Depends(get_db)) -> ApiResponse:
    return ok(
        db.query(
            "SELECT id, tracking_number, weight_kg, observed_condition, received_at FROM packages "
            "WHERE user_id IS NULL ORDER BY received_at DESC LIMIT 200"
        )
    )
