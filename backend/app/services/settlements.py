"""Reglas de negocio de tarifas y liquidaciones.

La base de datos hace cumplir las reglas críticas (CHECK de cálculo, triggers de emisión/pago/despacho). Este
servicio calcula en centavos enteros, arma la transacción y traduce los rechazos de la base a respuestas claras.
"""

from __future__ import annotations

import re
import time
from decimal import Decimal
from typing import Any

from sqlalchemy.exc import DBAPIError

from app.core import money
from app.core.errors import ApiError, raise_db_error
from app.core.logging import log
from app.db import Db
from app.schemas import PaymentIn, SettlementIn

_PURCHASE_CODE = re.compile(r"^OPT-[A-Z]{3}-\d{4}-\d{5}$")
_BILLABLE = ("accepted", "partially_received", "fully_received")


def current_tariff(db: Db) -> dict[str, Any]:
    t = db.one(
        "SELECT id, commission_rate, sell_rate_per_kg, effective_from, is_reference FROM tariff_versions "
        "WHERE effective_from <= NOW() ORDER BY effective_from DESC, id DESC LIMIT 1"
    )
    if not t:
        raise ApiError(503, "No hay tarifa vigente configurada")
    return t


def _dec(value: Any) -> str:
    return format(value, "f") if isinstance(value, Decimal) else str(value)


def issue(db: Db, staff_id: int, body: SettlementIn) -> dict[str, str]:
    """Crea y emite una liquidación para compras aceptadas con todos sus paquetes pesados."""
    assert body.user_id
    codes = body.purchase_codes
    if not isinstance(codes, list) or not codes or len(codes) > 50:
        raise ApiError(422, "Indicá entre 1 y 50 compras")
    if not all(isinstance(c, str) and _PURCHASE_CODE.match(c) for c in codes):
        raise ApiError(422, "Código de compra inválido")
    extra = money.to_cents(body.extra_charges or "0")
    if extra > 0 and len(body.extra_charges_note or "") < 5:
        raise ApiError(422, "Un cargo extra necesita justificación")

    tariff = current_tariff(db)
    uid = int(body.user_id)
    year = time.localtime().tm_year
    unique = sorted(set(codes))
    binds = {f"c{i}": c for i, c in enumerate(unique)}
    placeholders = ",".join(f":c{i}" for i in range(len(unique)))

    try:
        with db.tx():
            purchases = db.query(
                f"SELECT id, code, status FROM purchases WHERE user_id = :u AND code IN ({placeholders}) FOR UPDATE",  # noqa: S608 (solo marcadores)
                {"u": uid, **binds},
            )
            if len(purchases) != len(unique):
                raise ApiError(422, "Alguna compra no existe o no pertenece a ese cliente")

            lines: list[tuple[int, int, int]] = []
            base_sum = kg_sum = 0
            for p in purchases:
                if p["status"] not in _BILLABLE:
                    raise ApiError(409, f"La compra {p['code']} todavía no fue aceptada")
                base_row = db.one(
                    "SELECT COALESCE(SUM(line_amount),0) AS t FROM purchase_items WHERE purchase_id = :i", {"i": int(p["id"])}
                )
                base = money.to_cents(_dec(base_row["t"] if base_row else 0))
                w = db.one(
                    "SELECT COALESCE(SUM(weight_kg),0) AS kg, COALESCE(SUM(weight_kg IS NULL),0) AS missing, COUNT(*) AS n "
                    "FROM packages WHERE purchase_id = :i AND user_id = :u",
                    {"i": int(p["id"]), "u": uid},
                )
                assert w is not None
                if int(w["n"]) == 0 or int(w["missing"]) > 0 or Decimal(w["kg"]) <= 0:
                    raise ApiError(409, f"La compra {p['code']} no tiene todos sus paquetes recibidos y pesados")
                milli = money.scaled(_dec(w["kg"]), 3)
                lines.append((int(p["id"]), base, milli))
                base_sum += base
                kg_sum += milli

            kg = money.kg_str(kg_sum)
            rate = _dec(tariff["commission_rate"])
            per_kg = _dec(tariff["sell_rate_per_kg"])
            comm = money.commission(base_sum, rate)
            ship = money.shipping(kg, per_kg)
            code = f"LQ-{year}-{db.next_seq('settlement', year):05d}"

            sid = db.insert(
                "INSERT INTO settlements (code, user_id, shipment_id, tariff_version_id, commission_rate, sell_rate_per_kg, product_base, "
                "commission, weight_billable_kg, shipping, extra_charges, extra_charges_note, total) "
                "VALUES (:c,:u,:sh,:t,:cr,:sr,:pb,:cm,:w,:sp,:ex,:en,:tot)",
                {
                    "c": code,
                    "u": uid,
                    "sh": body.shipment_id,
                    "t": int(tariff["id"]),
                    "cr": rate,
                    "sr": per_kg,
                    "pb": money.fmt(base_sum),
                    "cm": money.fmt(comm),
                    "w": kg,
                    "sp": money.fmt(ship),
                    "ex": money.fmt(extra),
                    "en": body.extra_charges_note,
                    "tot": money.fmt(comm + ship + extra),
                },
            )
            for pid, base, milli in lines:
                db.execute(
                    "INSERT INTO settlement_lines (settlement_id, purchase_id, product_base, weight_kg) VALUES (:s,:p,:b,:w)",
                    {"s": sid, "p": pid, "b": money.fmt(base), "w": money.kg_str(milli)},
                )
            # Los triggers validan el rol del emisor, las sumas y los pesos antes de permitir la emisión.
            db.execute(
                "UPDATE settlements SET status = 'issued', issued_by = :i, issued_at = NOW() WHERE id = :s", {"i": staff_id, "s": sid}
            )
    except DBAPIError as exc:
        raise_db_error(exc)

    log.audit("settlement_issue", staff_id, settlement=code)
    return {"code": code, "total": money.fmt(comm + ship + extra)}


def register_payment(db: Db, staff_id: int, code: str, body: PaymentIn) -> dict[str, Any]:
    settlement = db.one("SELECT id FROM settlements WHERE code = :c", {"c": code})
    if not settlement:
        raise ApiError.not_found("Liquidación no encontrada")
    usd = body.currency_original == "USD"
    if not usd and (not body.amount_original or not body.fx_rate):
        raise ApiError(422, "Pagos en UYU requieren importe original y cotización")

    try:
        with db.tx():
            payment_id = db.insert(
                "INSERT INTO payments (settlement_id, amount, currency_original, amount_original, fx_rate, method, "
                "branch, received_by, receipt_ref) "
                "VALUES (:s,:a,:cur,:ao,:fx,:m,:b,:rb,:rr)",
                {
                    "s": int(settlement["id"]),
                    "a": body.amount,
                    "cur": body.currency_original,
                    "ao": body.amount if usd else (body.amount_original or "0"),
                    "fx": None if usd else body.fx_rate,
                    "m": body.method,
                    "b": body.branch,
                    "rb": staff_id,
                    "rr": body.receipt_ref,
                },
            )
    except DBAPIError as exc:
        raise_db_error(exc)

    log.audit("payment_register", staff_id, settlement=code, payment_id=payment_id)
    status = db.one("SELECT status FROM settlements WHERE id = :i", {"i": int(settlement["id"])})
    return {"payment_id": payment_id, "settlement_status": status["status"] if status else None}
