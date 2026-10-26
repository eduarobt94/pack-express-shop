"""Perfil y destinatarios del usuario autenticado. Toda consulta está filtrada por user_id (sin IDOR)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.exc import DBAPIError

from app.api.deps import current_user, get_db, rate_limit_general, rate_limit_sensitive
from app.core import crypto, passwords
from app.core.errors import ApiError, db_error_code
from app.core.logging import log
from app.core.responses import ApiResponse, created, ok
from app.db import Db
from app.schemas import AddressIn, PasswordChangeIn, ProfileIn
from app.services import sessions

router = APIRouter(prefix="/user", tags=["user"])
RL = [Depends(rate_limit_general)]  # primero la frecuencia, luego la autenticación (orden de la API PHP)

_ADDR_SELECT = (
    "SELECT a.id, a.label, a.recipient, a.id_doc_enc, a.phone, a.province, p.name AS province_name, "
    "a.municipality, a.street, a.is_default FROM addresses a JOIN provinces p ON p.code = a.province"
)


def _public_address(a: dict[str, Any]) -> dict[str, Any]:
    """Respuesta mínima: el documento se devuelve enmascarado; jamás el valor cifrado ni en claro."""
    doc = None
    if a.get("id_doc_enc"):
        plain = crypto.decrypt(bytes(a["id_doc_enc"]))
        doc = ("•" * max(0, len(plain) - 3) + plain[-3:]) if plain is not None else "••••"
    return {
        "id": int(a["id"]),
        "label": a["label"],
        "recipient": a["recipient"],
        "id_doc": doc,
        "phone": a["phone"],
        "province": a["province"],
        "province_name": a.get("province_name"),
        "municipality": a["municipality"],
        "street": a["street"],
        "is_default": bool(a["is_default"]),
    }


def _id(raw: str) -> int:
    """Como (int) de PHP: un id no numérico equivale a 0 (y termina en 404, no en 422)."""
    return int(raw) if raw.isdigit() else 0


def _own_address(db: Db, address_id: int, user_id: int) -> None:
    if not db.one("SELECT id FROM addresses WHERE id = :i AND user_id = :u", {"i": address_id, "u": user_id}):
        raise ApiError.not_found("Dirección no encontrada")


def _enc_doc(doc: str | None) -> bytes | None:
    return crypto.encrypt(doc) if doc else None


@router.get("", dependencies=RL)
def profile(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    row = db.one(
        "SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, s.suite_id, s.country, s.member_since "
        "FROM users u LEFT JOIN suites s ON s.user_id = u.id WHERE u.id = :i",
        {"i": int(user["id"])},
    )
    if not row:
        raise ApiError.not_found("Usuario no encontrado")
    return ok(row)


@router.put("", dependencies=RL)
def update_profile(body: ProfileIn, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    # Lista blanca: solo name y phone (role, email, status… enviados por el cliente se descartan en el esquema).
    db.execute("UPDATE users SET name = :n, phone = :p WHERE id = :i", {"n": body.name, "p": body.phone, "i": int(user["id"])})
    log.audit("profile_update", int(user["id"]))
    return ok(None, "Perfil actualizado")


@router.put("/password", dependencies=[Depends(rate_limit_sensitive)])
def change_password(body: PasswordChangeIn, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    assert body.current_password and body.new_password
    row = db.one("SELECT password_hash FROM users WHERE id = :i", {"i": int(user["id"])})
    if not row or not passwords.verify_password(body.current_password, row["password_hash"]):
        raise ApiError(401, "La contraseña actual es incorrecta")
    db.execute("UPDATE users SET password_hash = :h WHERE id = :i", {"h": passwords.hash_password(body.new_password), "i": int(user["id"])})
    sessions.revoke_all(db, int(user["id"]))
    log.audit("password_change", int(user["id"]))
    return ok(None, "Contraseña actualizada. Volvé a iniciar sesión.")


@router.get("/addresses", dependencies=RL)
def addresses(user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    rows = db.query(_ADDR_SELECT + " WHERE a.user_id = :u ORDER BY a.is_default DESC, a.id ASC", {"u": int(user["id"])})
    return ok([_public_address(r) for r in rows])


def _province_or_error(exc: DBAPIError) -> ApiError | None:
    code, msg = db_error_code(exc)
    return ApiError(422, "Provincia inválida") if code == 1452 and "fk_addresses_province" in msg else None


@router.post("/addresses", dependencies=RL)
def create_address(body: AddressIn, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    uid = int(user["id"])
    try:
        with db.tx():
            if body.default_flag:
                db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = :u", {"u": uid})
            new_id = db.insert(
                "INSERT INTO addresses (user_id, label, recipient, id_doc_enc, phone, province, municipality, street, is_default) "
                "VALUES (:u,:l,:r,:d,:p,:pr,:m,:s,:df)",
                {
                    "u": uid,
                    "l": body.label,
                    "r": body.recipient,
                    "d": _enc_doc(body.id_doc),
                    "p": body.phone,
                    "pr": (body.province or "").upper(),
                    "m": body.municipality,
                    "s": body.street,
                    "df": body.default_flag,
                },
            )
    except DBAPIError as exc:
        if (err := _province_or_error(exc)) is not None:
            raise err from exc
        log.error("create_address_failed", error=str(exc.orig))
        raise ApiError(500, "Error al guardar dirección") from exc
    row = db.one(_ADDR_SELECT + " WHERE a.id = :i", {"i": new_id})
    assert row
    return created(_public_address(row), "Dirección guardada")


@router.put("/addresses/{address_id}", dependencies=RL)
def update_address(address_id: str, body: AddressIn, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    uid = int(user["id"])
    aid = _id(address_id)
    _own_address(db, aid, uid)
    try:
        with db.tx():
            if body.default_flag:
                db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = :u", {"u": uid})
            # El documento solo se reemplaza si se envía; omitirlo conserva el cifrado existente.
            doc_sql = ", id_doc_enc = :d" if "id_doc" in body.model_fields_set else ""
            db.execute(
                f"UPDATE addresses SET label=:l, recipient=:r, phone=:p, province=:pr, municipality=:m, street=:s, is_default=:df{doc_sql} "  # noqa: S608 (fragmento fijo)
                "WHERE id = :i AND user_id = :u",
                {
                    "l": body.label,
                    "r": body.recipient,
                    "p": body.phone,
                    "pr": (body.province or "").upper(),
                    "m": body.municipality,
                    "s": body.street,
                    "df": body.default_flag,
                    "d": _enc_doc(body.id_doc),
                    "i": aid,
                    "u": uid,
                },
            )
    except DBAPIError as exc:
        if (err := _province_or_error(exc)) is not None:
            raise err from exc
        raise ApiError(500, "Error al actualizar dirección") from exc
    return ok(None, "Dirección actualizada")


@router.delete("/addresses/{address_id}", dependencies=RL)
def delete_address(address_id: str, user: dict = Depends(current_user), db: Db = Depends(get_db)) -> ApiResponse:
    aid = _id(address_id)
    _own_address(db, aid, int(user["id"]))
    try:
        db.execute("DELETE FROM addresses WHERE id = :i AND user_id = :u", {"i": aid, "u": int(user["id"])})
    except DBAPIError as exc:  # RESTRICT: el destinatario ya está en una compra o envío
        raise ApiError(409, "El destinatario tiene compras o envíos asociados y no se puede eliminar") from exc
    log.audit("delete_address", int(user["id"]), address_id=aid)
    return ok(None, "Dirección eliminada")
