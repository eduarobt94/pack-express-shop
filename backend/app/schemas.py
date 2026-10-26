"""Esquemas de entrada (Pydantic v2) con las mismas reglas que el validador de la API PHP.

Seguridad por diseño:
- `extra="ignore"`: cualquier campo no declarado (role, status, user_id, token_version…) se descarta ⇒ sin mass assignment.
- Los valores no escalares (listas/objetos) se rechazan en lugar de provocar errores de tipo.
- Los textos se limpian de etiquetas HTML y espacios; las contraseñas y tokens NO se tocan (raw).
- Los importes se validan como cadenas con formato estricto y se operan en centavos enteros.
"""

import math
import re
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, GetCoreSchemaHandler, ValidationError
from pydantic_core import core_schema

from app.core.errors import ApiError

Check = Callable[[str], None]
_TAGS = re.compile(r"<[^>]*(>|$)")
_EMAIL = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")


def _to_str(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    raise ValueError("tiene un formato inválido")


# ── comprobaciones (cada una lanza ValueError con el mensaje) ─────────────────────────────────
def valid_email(v: str) -> None:
    if not _EMAIL.match(v):
        raise ValueError("debe ser un email válido")


def min_len(n: int) -> Check:
    def check(v: str) -> None:
        if len(v) < n:
            raise ValueError(f"debe tener al menos {n} caracteres")

    return check


def max_len(n: int) -> Check:
    def check(v: str) -> None:
        if len(v) > n:
            raise ValueError(f"no puede superar {n} caracteres")

    return check


def bytes_max(n: int) -> Check:  # bcrypt ignora todo después de 72 bytes
    def check(v: str) -> None:
        if len(v.encode()) > n:
            raise ValueError(f"no puede superar {n} bytes")

    return check


def integer(v: str) -> None:
    if not re.fullmatch(r"[+-]?\d+", v):
        raise ValueError("debe ser un entero")


def between(lo: float, hi: float) -> Check:
    def check(v: str) -> None:
        try:
            x = float(v)
        except ValueError:
            raise ValueError(f"debe estar entre {lo} y {hi}") from None
        if math.isnan(x) or not (lo <= x <= hi):
            raise ValueError(f"debe estar entre {lo} y {hi}")

    return check


def one_of(*values: str) -> Check:
    def check(v: str) -> None:
        if v not in values:
            raise ValueError("tiene un valor no permitido")

    return check


def date_ymd(v: str) -> None:
    try:
        if datetime.strptime(v, "%Y-%m-%d").strftime("%Y-%m-%d") != v:
            raise ValueError
    except ValueError:
        raise ValueError("debe ser una fecha AAAA-MM-DD") from None


def url_http(v: str) -> None:
    if not re.match(r"^https?://[^\s/$.?#][^\s]*$", v, re.IGNORECASE):
        raise ValueError("debe ser una URL http(s)")


def pattern(rx: str) -> Check:
    compiled = re.compile(rx)

    def check(v: str) -> None:
        if not compiled.search(v):
            raise ValueError("tiene un formato inválido")

    return check


class V:
    """Metadato de validación para campos de texto: normaliza vacío→None, aplica las comprobaciones y limpia HTML/espacios (salvo raw)."""

    def __init__(self, *checks: Check, required: bool = False, raw: bool = False) -> None:
        self.checks, self.required, self.raw = checks, required, raw

    def _validate(self, value: str | None) -> str | None:
        if value is None:
            if self.required:
                raise ValueError("es requerido")
            return None
        for check in self.checks:
            check(value)
        return value if self.raw else _TAGS.sub("", value).strip()

    def __get_pydantic_core_schema__(self, source: Any, handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        inner = core_schema.no_info_after_validator_function(self._validate, handler(source))
        return core_schema.no_info_before_validator_function(_to_str, inner)


class Schema(BaseModel):
    model_config = ConfigDict(extra="ignore", validate_default=True)


# ── autenticación ────────────────────────────────────────────────────────────────────────────
class LoginIn(Schema):
    email: Annotated[str | None, V(valid_email, max_len(150), required=True)] = None
    password: Annotated[str | None, V(bytes_max(72), required=True, raw=True)] = None


class RegisterIn(Schema):
    name: Annotated[str | None, V(min_len(2), max_len(120), required=True)] = None
    email: Annotated[str | None, V(valid_email, max_len(150), required=True)] = None
    password: Annotated[str | None, V(min_len(8), bytes_max(72), required=True, raw=True)] = None
    phone: Annotated[str | None, V(max_len(30))] = None


class TokenIn(Schema):
    refresh_token: Annotated[str | None, V(raw=True)] = None


class ForgotIn(Schema):
    email: Annotated[str | None, V(valid_email, max_len(150), required=True)] = None


class ResetIn(Schema):
    token: Annotated[str | None, V(pattern(r"^[a-f0-9]{64}$"), required=True, raw=True)] = None
    password: Annotated[str | None, V(min_len(8), bytes_max(72), required=True, raw=True)] = None


# ── usuario ──────────────────────────────────────────────────────────────────────────────────
class ProfileIn(Schema):
    name: Annotated[str | None, V(min_len(2), max_len(120), required=True)] = None
    phone: Annotated[str | None, V(max_len(30))] = None


class PasswordChangeIn(Schema):
    current_password: Annotated[str | None, V(bytes_max(72), required=True, raw=True)] = None
    new_password: Annotated[str | None, V(min_len(8), bytes_max(72), required=True, raw=True)] = None


class AddressIn(Schema):
    label: Annotated[str | None, V(max_len(100))] = None
    recipient: Annotated[str | None, V(min_len(2), max_len(120), required=True)] = None
    id_doc: Annotated[str | None, V(max_len(30), pattern(r"^[A-Za-z0-9\-.]*$"))] = None
    phone: Annotated[str | None, V(max_len(30))] = None
    province: Annotated[str | None, V(pattern(r"^[A-Za-z]{3}$"), required=True)] = None
    municipality: Annotated[str | None, V(max_len(80))] = None
    street: Annotated[str | None, V(min_len(3), max_len(300), required=True)] = None
    is_default: Any = None

    @property
    def default_flag(self) -> int:  # equivale a !empty() de PHP
        return 0 if self.is_default in (None, False, 0, "", "0", [], {}, 0.0) else 1


# ── compras ──────────────────────────────────────────────────────────────────────────────────
_MONEY2 = r"^\d{1,6}(\.\d{1,2})?$"


class PurchaseIn(Schema):
    recipient_id: Annotated[str | None, V(integer, required=True)] = None
    store: Annotated[str | None, V(min_len(2), max_len(100), required=True)] = None
    store_order_number: Annotated[str | None, V(min_len(3), max_len(100), required=True)] = None
    purchased_on: Annotated[str | None, V(date_ymd, required=True)] = None
    store_taxes: Annotated[str | None, V(between(0, 100000), pattern(r"^\d+(\.\d{1,2})?$"))] = None
    store_shipping: Annotated[str | None, V(between(0, 100000), pattern(r"^\d+(\.\d{1,2})?$"))] = None
    notes: Annotated[str | None, V(max_len(500))] = None


class PurchaseItemIn(Schema):
    description: Annotated[str | None, V(min_len(2), max_len(300), required=True)] = None
    url: Annotated[str | None, V(max_len(1000), url_http)] = None
    model: Annotated[str | None, V(max_len(100))] = None
    qty: Annotated[str | None, V(integer, between(1, 1000), required=True)] = None
    unit_price: Annotated[str | None, V(pattern(_MONEY2), between(0, 100000), required=True)] = None
    discount: Annotated[str | None, V(pattern(_MONEY2))] = None


# ── tarifas, liquidaciones, personal ───────────────────────────────────────────────────────────
class QuoteIn(Schema):
    value: Annotated[str | None, V(pattern(r"^\d{1,7}(\.\d{1,2})?$"), required=True)] = None
    weight_kg: Annotated[str | None, V(pattern(r"^\d{1,4}(\.\d{1,3})?$"))] = None


class TariffIn(Schema):
    commission_rate: Annotated[str | None, V(pattern(r"^0(\.\d{1,4})?$"), between(0, 0.5), required=True)] = None
    sell_rate_per_kg: Annotated[str | None, V(pattern(r"^\d{1,4}(\.\d{1,2})?$"), between(0.01, 1000), required=True)] = None
    notes: Annotated[str | None, V(max_len(255))] = None


class SettlementIn(Schema):
    user_id: Annotated[str | None, V(integer, required=True)] = None
    shipment_id: Annotated[str | None, V(max_len(20), pattern(r"^[A-Za-z0-9\-]+$"))] = None
    extra_charges: Annotated[str | None, V(pattern(r"^\d{1,5}(\.\d{1,2})?$"))] = None
    extra_charges_note: Annotated[str | None, V(max_len(255))] = None
    purchase_codes: Any = None


class PaymentIn(Schema):
    amount: Annotated[str | None, V(pattern(r"^\d{1,7}(\.\d{1,2})?$"), required=True)] = None
    currency_original: Annotated[str | None, V(one_of("USD", "UYU"), required=True)] = None
    amount_original: Annotated[str | None, V(pattern(r"^\d{1,9}(\.\d{1,2})?$"))] = None
    fx_rate: Annotated[str | None, V(pattern(r"^\d{1,6}(\.\d{1,4})?$"))] = None
    method: Annotated[str | None, V(one_of("cash", "transfer", "card_pos", "other"), required=True)] = None
    branch: Annotated[str | None, V(min_len(2), max_len(80), required=True)] = None
    receipt_ref: Annotated[str | None, V(min_len(3), max_len(80), required=True)] = None


class PackageReceiveIn(Schema):
    tracking_number: Annotated[str | None, V(min_len(5), max_len(100), required=True)] = None
    customer_code: Annotated[str | None, V(max_len(25), pattern(r"^OPT-[A-Z]{2}-\d{6}$"))] = None
    purchase_code: Annotated[str | None, V(max_len(25), pattern(r"^OPT-[A-Z]{3}-\d{4}-\d{5}$"))] = None
    weight: Annotated[str | None, V(pattern(r"^\d{1,4}(\.\d{1,3})?$"), between(0.001, 5000), required=True)] = None
    weight_unit: Annotated[str | None, V(one_of("kg", "lb"), required=True)] = None
    condition: Annotated[str | None, V(max_len(255))] = None


class PurchaseStatusIn(Schema):
    status: Annotated[
        str | None, V(one_of("in_review", "accepted", "partially_received", "fully_received", "cancelled"), required=True)
    ] = None


# ── utilidades ───────────────────────────────────────────────────────────────────────────────
def validation_errors(exc: ValidationError) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    for err in exc.errors():
        field = str(err["loc"][0]) if err["loc"] else "body"
        msg = str(err["msg"]).removeprefix("Value error, ")
        errors.setdefault(field, []).append(f"{field} {msg}")
    return errors


def parse[T: Schema](model: type[T], data: dict[str, Any], message: str = "Datos inválidos") -> T:
    """Valida un diccionario (formularios multipart, elementos de listas) y lanza ApiError(422) con el detalle."""
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise ApiError(422, message, validation_errors(exc)) from exc
