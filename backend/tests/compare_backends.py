"""Comparación diferencial PHP ↔ Python: mismas peticiones a ambos backends sobre la misma base de PRUEBA.

    DB_NAME=optimus_test python backend/tests/compare_backends.py

Compara código de estado, `success`, `message`, estructura (claves y tipos) de `data` y cabeceras de seguridad.
Excluye valores variables (ids, tokens, fechas, códigos generados). Las diferencias se listan al final y están
documentadas en docs/python-migration.md. Se niega a correr si DB_NAME no termina en _test.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
import pymysql

ROOT = Path(__file__).resolve().parents[2]
DB_NAME = os.environ.get("DB_NAME", "")
if not DB_NAME.endswith("_test"):
    sys.exit("Se niega a correr: DB_NAME debe terminar en _test")

PHP = shutil.which("php") or "php"
PY = ROOT / "backend" / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
TMP = Path(tempfile.mkdtemp(prefix="optimus_cmp_"))
ENV = {
    **os.environ,
    "APP_ENV": "testing",
    "JWT_SECRET": uuid.uuid4().hex + uuid.uuid4().hex,
    "DATA_ENC_KEY": "A" * 43 + "=",
    "DB_HOST": "127.0.0.1",
    "DB_PORT": os.environ.get("DB_PORT", "3306"),
    "DB_NAME": DB_NAME,
    "DB_USER": os.environ.get("DB_USER", "root"),
    "DB_PASS": os.environ.get("DB_PASS", ""),
    "AUTH_RATE_LIMIT": "100000",
    "RATE_LIMIT_REQUESTS": "100000",
    "UPLOAD_MAX_MB": "1",
    "TERMS_VERSION": "v1-test",
    "CORS_ORIGIN": "https://shop.example",
    "LOG_DIR": str(TMP / "logs"),
}
PORTS = {"php": 8101, "py": 8102}
PROCS: list[subprocess.Popen[bytes]] = []


def start() -> None:
    api = ROOT / "api" / "v1"
    PROCS.append(
        subprocess.Popen(
            [PHP, "-S", f"127.0.0.1:{PORTS['php']}", "-t", str(api), str(api / "index.php")],
            cwd=api,
            env={**ENV, "UPLOAD_DIR": str(TMP / "up_php")},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    )
    PROCS.append(
        subprocess.Popen(
            [
                str(PY),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(PORTS["py"]),
                "--log-level",
                "warning",
                "--no-proxy-headers",
            ],
            cwd=ROOT / "backend",
            env={**ENV, "UPLOAD_DIR": str(TMP / "up_py")},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    )
    for port in PORTS.values():
        for _ in range(100):
            try:
                httpx.get(f"http://127.0.0.1:{port}/tariffs/current", timeout=1)
                break
            except httpx.HTTPError:
                time.sleep(0.2)


def stop() -> None:
    for p in PROCS:
        p.terminate()


def shape(value: Any) -> Any:
    """Estructura sin valores: claves ordenadas y tipos. Listas: forma del primer elemento."""
    if isinstance(value, dict):
        return {k: shape(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [shape(value[0])] if value else []
    return type(value).__name__ if value is not None else "null"


_VOLATILE = re.compile(r"OPT-[A-Z]{2,3}-(\d{4}-)?\d{5,6}|LQ-\d{4}-\d{5}|WR-\d{4}-\d{5}|\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?")


class Case:
    def __init__(self, name: str) -> None:
        self.name = name
        self.results: dict[str, dict[str, Any]] = {}


CASES: list[Case] = []
DIFFS: list[str] = []
SEC_HEADERS = ["x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy", "cache-control"]


def call(case: str, impl: str, client: httpx.Client, method: str, path: str, **kw: Any) -> httpx.Response:
    r = client.request(method, path, **kw)
    try:
        body = r.json()
    except ValueError:
        body = None
    entry = {
        "status": r.status_code,
        "ok": body.get("success") if isinstance(body, dict) else None,
        "message": _VOLATILE.sub("<id>", str(body.get("message"))) if isinstance(body, dict) else None,
        "shape": shape(body.get("data")) if isinstance(body, dict) else None,
        "errors": sorted((body or {}).get("errors", {}).keys())
        if isinstance(body, dict) and isinstance(body.get("errors"), dict)
        else None,
        "headers": {h: r.headers.get(h) for h in SEC_HEADERS},
    }
    for c in CASES:
        if c.name == case:
            c.results[impl] = entry
            break
    else:
        c = Case(case)
        c.results[impl] = entry
        CASES.append(c)
    return r


def db() -> pymysql.Connection:
    return pymysql.connect(
        host="127.0.0.1", port=int(ENV["DB_PORT"]), user=ENV["DB_USER"], password=ENV["DB_PASS"], database=DB_NAME, autocommit=True
    )


PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


def scenario(impl: str, run: str) -> None:
    c = httpx.Client(base_url=f"http://127.0.0.1:{PORTS[impl]}", timeout=30)
    k = lambda n: f"{n}.{impl}.{run}@cmp.uy"  # noqa: E731
    pw = "Clave-Segura-123"

    def reg(tag: str, role: str = "customer") -> dict[str, str]:
        r = call(f"register {tag}", impl, c, "POST", "/auth/register", json={"name": f"U {tag}", "email": k(tag), "password": pw})
        d = r.json()["data"]
        if role != "customer":
            with db().cursor() as cur:
                cur.execute("UPDATE users SET role=%s WHERE email=%s", (role, k(tag)))
        return {"t": d["token"], "r": d["refresh_token"], "suite": d["user"]["suite_id"], "id": str(d["user"]["id"])}

    a, b = reg("a"), reg("b")
    ag, wh, ad = reg("ag", "agent"), reg("wh", "warehouse"), reg("ad", "admin")
    H = lambda u: {"Authorization": f"Bearer {u['t']}"}  # noqa: E731

    # públicas y errores de contrato
    call("GET tariffs/current", impl, c, "GET", "/tariffs/current")
    call("POST quote ok", impl, c, "POST", "/quote", json={"value": "100", "weight_kg": "5"})
    call("POST quote sin peso", impl, c, "POST", "/quote", json={"value": "100"})
    call("POST quote peso negativo", impl, c, "POST", "/quote", json={"value": "100", "weight_kg": "-1"})
    call("ruta inexistente", impl, c, "GET", "/nope")
    call("método no permitido", impl, c, "DELETE", "/tariffs/current")
    call("login mal", impl, c, "POST", "/auth/login", json={"email": k("a"), "password": "incorrecta-1"})
    call("login usuario inexistente", impl, c, "POST", "/auth/login", json={"email": k("zz"), "password": "incorrecta-1"})
    call("login ok", impl, c, "POST", "/auth/login", json={"email": k("b"), "password": pw})
    call("login tipos inválidos", impl, c, "POST", "/auth/login", json={"email": ["a@b.com"], "password": ["x"]})
    call("login sin cuerpo", impl, c, "POST", "/auth/login")
    call("register clave corta", impl, c, "POST", "/auth/register", json={"name": "X Y", "email": k("s"), "password": "123"})
    call("register duplicado", impl, c, "POST", "/auth/register", json={"name": "X Y", "email": k("a"), "password": pw})
    call("forgot", impl, c, "POST", "/auth/forgot-password", json={"email": k("a")})
    call("reset token inválido", impl, c, "POST", "/auth/reset-password", json={"token": "0" * 64, "password": pw})
    call("refresh inválido", impl, c, "POST", "/auth/refresh", json={"refresh_token": "x"})
    call("logout", impl, c, "POST", "/auth/logout", json={})
    for path in ("/user", "/user/addresses", "/purchases", "/settlements", "/locker", "/orders", "/pre-alerts"):
        call(f"anónimo {path}", impl, c, "GET", path)

    # perfil y destinatarios
    call("GET user", impl, c, "GET", "/user", headers=H(a))
    call("PUT user", impl, c, "PUT", "/user", headers=H(a), json={"name": "Alice Nueva", "role": "admin"})
    call("PUT user inválido", impl, c, "PUT", "/user", headers=H(a), json={"name": "A"})
    addr = {
        "recipient": "Mercedes Pérez",
        "id_doc": "54091205832",
        "phone": "+53 5234",
        "province": "hab",
        "street": "Calle 23 #456",
        "is_default": True,
        "label": "Mamá",
    }
    r = call("POST address", impl, c, "POST", "/user/addresses", headers=H(a), json=addr)
    aid = r.json()["data"]["id"]
    call(
        "POST address provincia inválida",
        impl,
        c,
        "POST",
        "/user/addresses",
        headers=H(a),
        json={**addr, "province": "ZZZ", "is_default": False},
    )
    call("POST address provincia SQLi", impl, c, "POST", "/user/addresses", headers=H(a), json={**addr, "province": "'--"})
    call("GET addresses", impl, c, "GET", "/user/addresses", headers=H(a))
    call("PUT address", impl, c, "PUT", f"/user/addresses/{aid}", headers=H(a), json={**addr, "label": "Madre"})
    call("PUT address ajena", impl, c, "PUT", f"/user/addresses/{aid}", headers=H(b), json=addr)
    call("PUT address id no numérico", impl, c, "PUT", "/user/addresses/abc", headers=H(a), json=addr)
    call("DELETE address ajena", impl, c, "DELETE", f"/user/addresses/{aid}", headers=H(b))

    # compras
    items = json.dumps(
        [{"description": "Estación", "url": "https://amazon.com/dp/B0", "model": "D2", "qty": 2, "unit_price": "500.00", "discount": "50"}]
    )
    form = {
        "recipient_id": str(aid),
        "store": "Amazon",
        "store_order_number": f"112-{run}-{impl}",
        "purchased_on": time.strftime("%Y-%m-%d"),
        "accept_terms": "1",
        "items": items,
    }
    files = lambda: {"receipt": ("f.pdf", PDF, "application/pdf")}  # noqa: E731
    r = call("POST purchase", impl, c, "POST", "/purchases", headers=H(a), data=form, files=files())
    code = r.json()["data"]["code"]
    call("POST purchase duplicada", impl, c, "POST", "/purchases", headers=H(a), data=form, files=files())
    call(
        "POST purchase sin comprobante", impl, c, "POST", "/purchases", headers=H(a), data={**form, "store_order_number": "X-" + run + impl}
    )
    call(
        "POST purchase sin términos",
        impl,
        c,
        "POST",
        "/purchases",
        headers=H(a),
        data={**{k_: v for k_, v in form.items() if k_ != "accept_terms"}, "store_order_number": "T-" + run + impl},
        files=files(),
    )
    call(
        "POST purchase php disfrazado",
        impl,
        c,
        "POST",
        "/purchases",
        headers=H(a),
        data={**form, "store_order_number": "P-" + run + impl},
        files={"receipt": ("r.php", b"<?php system($_GET['c']); ?>", "application/pdf")},
    )
    call(
        "POST purchase destinatario ajeno",
        impl,
        c,
        "POST",
        "/purchases",
        headers=H(b),
        data={**form, "store_order_number": "I-" + run + impl},
        files=files(),
    )
    call(
        "POST purchase producto inválido",
        impl,
        c,
        "POST",
        "/purchases",
        headers=H(a),
        data={**form, "store_order_number": "V-" + run + impl, "items": json.dumps([{"description": "x y", "qty": 0, "unit_price": "1"}])},
        files=files(),
    )
    call("GET purchases", impl, c, "GET", "/purchases", headers=H(a))
    call("GET purchase", impl, c, "GET", f"/purchases/{code}", headers=H(a))
    call("GET purchase ajena", impl, c, "GET", f"/purchases/{code}", headers=H(b))
    call("GET purchase SQLi", impl, c, "GET", "/purchases/%27%20OR%20%271%27=%271", headers=H(a))
    rc = call("GET receipt", impl, c, "GET", f"/purchases/{code}/receipt", headers=H(a))
    DIFFS_BODY.setdefault(impl, rc.content[:5])
    call("GET receipt ajeno", impl, c, "GET", f"/purchases/{code}/receipt", headers=H(b))

    # personal: recepción → liquidación → pago
    call(
        "staff cliente 403",
        impl,
        c,
        "POST",
        "/staff/packages",
        headers=H(a),
        json={"tracking_number": "TRK12345", "weight": "2", "weight_unit": "kg"},
    )
    call(
        "staff paquete",
        impl,
        c,
        "POST",
        "/staff/packages",
        headers=H(wh),
        json={
            "tracking_number": f"TRK-{run}{impl}",
            "customer_code": a["suite"],
            "purchase_code": code,
            "weight": "11",
            "weight_unit": "lb",
        },
    )
    call(
        "staff paquete sin cliente",
        impl,
        c,
        "POST",
        "/staff/packages",
        headers=H(wh),
        json={"tracking_number": f"NOB-{run}{impl}", "weight": "3", "weight_unit": "kg"},
    )
    call(
        "staff paquete peso 0",
        impl,
        c,
        "POST",
        "/staff/packages",
        headers=H(wh),
        json={"tracking_number": "TRK00000", "weight": "0", "weight_unit": "kg"},
    )
    call("staff sin aceptar", impl, c, "POST", "/staff/settlements", headers=H(ag), json={"user_id": a["id"], "purchase_codes": [code]})
    call("staff transición inválida", impl, c, "POST", f"/staff/purchases/{code}/status", headers=H(ag), json={"status": "fully_received"})
    call("staff aceptar", impl, c, "POST", f"/staff/purchases/{code}/status", headers=H(ag), json={"status": "accepted"})
    r = call("staff liquidar", impl, c, "POST", "/staff/settlements", headers=H(ag), json={"user_id": a["id"], "purchase_codes": [code]})
    sc = r.json()["data"]["code"]
    call(
        "staff liquidar duplicada",
        impl,
        c,
        "POST",
        "/staff/settlements",
        headers=H(ag),
        json={"user_id": a["id"], "purchase_codes": [code]},
    )
    call("GET settlement", impl, c, "GET", f"/settlements/{sc}", headers=H(a))
    call("GET settlement ajena", impl, c, "GET", f"/settlements/{sc}", headers=H(b))
    call("GET settlements", impl, c, "GET", "/settlements", headers=H(a))
    pay = {"amount": "100.00", "currency_original": "USD", "method": "cash", "branch": "Centro"}
    call(
        "pago por cliente 403",
        impl,
        c,
        "POST",
        f"/staff/settlements/{sc}/payments",
        headers=H(a),
        json={**pay, "receipt_ref": "R1" + run + impl},
    )
    call(
        "pago parcial", impl, c, "POST", f"/staff/settlements/{sc}/payments", headers=H(ag), json={**pay, "receipt_ref": "R2" + run + impl}
    )
    call(
        "pago excedido",
        impl,
        c,
        "POST",
        f"/staff/settlements/{sc}/payments",
        headers=H(ag),
        json={**pay, "amount": "49.90", "receipt_ref": "R3" + run + impl},
    )
    call(
        "pago final",
        impl,
        c,
        "POST",
        f"/staff/settlements/{sc}/payments",
        headers=H(ag),
        json={**pay, "amount": "49.89", "receipt_ref": "R4" + run + impl},
    )
    call(
        "pago UYU incompleto",
        impl,
        c,
        "POST",
        f"/staff/settlements/{sc}/payments",
        headers=H(ag),
        json={**pay, "currency_original": "UYU", "receipt_ref": "R5" + run + impl},
    )
    call(
        "tarifa por agente 403", impl, c, "POST", "/admin/tariffs", headers=H(ag), json={"commission_rate": "0.05", "sell_rate_per_kg": "9"}
    )
    call(
        "tarifa fuera de rango", impl, c, "POST", "/admin/tariffs", headers=H(ad), json={"commission_rate": "0.9", "sell_rate_per_kg": "9"}
    )

    # casillero y modelo anterior
    for path in (
        "/locker",
        "/locker/packages",
        "/locker/packages?status=ready%27%20OR%20%271%27=%271",
        "/locker/packages/NOPE",
        "/locker/shipments",
        "/locker/shipments/NOPE",
        "/orders",
        "/orders/NOPE",
        "/pre-alerts",
    ):
        call(f"GET {path}", impl, c, "GET", path, headers=H(a))
    call("POST orders 410", impl, c, "POST", "/orders", headers=H(a), json={"items": []})
    call("POST pre-alerts 410", impl, c, "POST", "/pre-alerts", headers=H(a), json={})
    call("DELETE pre-alert inexistente", impl, c, "DELETE", "/pre-alerts/PA-0", headers=H(a))

    # sesión: rotación, reutilización y cambio de contraseña
    r1 = call("refresh ok", impl, c, "POST", "/auth/refresh", json={"refresh_token": b["r"]})
    call("refresh reutilizado", impl, c, "POST", "/auth/refresh", json={"refresh_token": b["r"]})
    call("refresh familia revocada", impl, c, "POST", "/auth/refresh", json={"refresh_token": r1.json()["data"]["refresh_token"]})
    call(
        "cambio de clave mal",
        impl,
        c,
        "PUT",
        "/user/password",
        headers=H(a),
        json={"current_password": "mala-clave-1", "new_password": "Nueva-Clave-456"},
    )
    call(
        "cambio de clave ok",
        impl,
        c,
        "PUT",
        "/user/password",
        headers=H(a),
        json={"current_password": pw, "new_password": "Nueva-Clave-456"},
    )
    call("token tras cambio de clave", impl, c, "GET", "/user", headers=H(a))
    call("CORS preflight", impl, c, "OPTIONS", "/user", headers={"Origin": "http://localhost:5173"})


DIFFS_BODY: dict[str, bytes] = {}


def main() -> int:
    start()
    try:
        run = uuid.uuid4().hex[:6]
        for impl in ("php", "py"):
            scenario(impl, run)
    finally:
        stop()
    same = 0
    for case in CASES:
        php, py = case.results.get("php"), case.results.get("py")
        if php == py:
            same += 1
            continue
        parts = [f"· {case.name}"]
        for key in ("status", "ok", "message", "errors", "shape", "headers"):
            if php and py and php[key] != py[key]:
                parts.append(f"    {key}: PHP={php[key]!r}  PY={py[key]!r}")
        DIFFS.append("\n".join(parts))
    print(f"Casos comparados: {len(CASES)} · idénticos: {same} · con diferencias: {len(DIFFS)}\n")
    print("\n".join(DIFFS))
    print(f"\ncomprobante descargado: PHP={DIFFS_BODY.get('php')!r} PY={DIFFS_BODY.get('py')!r}")
    shutil.rmtree(TMP, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
