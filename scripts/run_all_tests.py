"""Ejecuta TODA la batería de pruebas y genera la matriz de casos con identificadores únicos (TEST-001…).

    python scripts/run_all_tests.py            # todo (requiere MariaDB de pruebas, PHP, Python con backend/.venv, Node/pnpm y un navegador)
    python scripts/run_all_tests.py --skip e2e # omite etapas (lint, unit, backend, contract, php-contract, db-rules, e2e, perf, audit)

Variables: DB_HOST, DB_PORT, DB_USER, DB_PASS (por defecto 127.0.0.1:3306 root sin clave). Las bases se llaman *_test y se
RECREAN: nunca apuntar a una base con datos reales. Salida: test-results/*.json|xml, test-results/summary.json y
docs/test-matrix.md. El código de salida es distinto de 0 si CUALQUIER etapa ejecutada falla (o si una etapa no pudo correr).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
IS_WIN = os.name == "nt"
PY = ROOT / "backend" / ".venv" / ("Scripts/python.exe" if IS_WIN else "bin/python")
PNPM = shutil.which("pnpm") or "pnpm"
PHP = shutil.which("php") or "php"
ENV = {
    **os.environ,
    "DB_HOST": os.environ.get("DB_HOST", "127.0.0.1"), "DB_PORT": os.environ.get("DB_PORT", "3306"),
    "DB_USER": os.environ.get("DB_USER", "root"), "DB_PASS": os.environ.get("DB_PASS", ""), "PYTHONIOENCODING": "utf-8",
}
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
STAGES: dict[str, dict] = {}
CASES: list[dict] = []


def run(cmd: list[str], *, cwd: Path = ROOT, env: dict | None = None, timeout: int = 900) -> tuple[int, str, float]:
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env or ENV, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)  # noqa: S603
        return p.returncode, ANSI.sub("", p.stdout + p.stderr), time.time() - t0
    except subprocess.TimeoutExpired as exc:
        return 124, f"TIMEOUT tras {timeout}s\n{exc.stdout or ''}", time.time() - t0
    except FileNotFoundError as exc:
        return 127, f"no se pudo ejecutar {cmd[0]}: {exc}", time.time() - t0


def recreate_db(name: str) -> None:
    assert name.endswith("_test"), "solo bases desechables *_test"
    code = (f"$p=new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT'),getenv('DB_USER'),getenv('DB_PASS'));"
            f"$p->exec('DROP DATABASE IF EXISTS `{name}`');$p->exec('CREATE DATABASE `{name}` CHARACTER SET utf8mb4');")
    rc, out, _ = run([PHP, "-r", code])
    if rc:
        raise RuntimeError(f"no se pudo recrear {name}: {out}")
    rc, out, _ = run([PHP, "database/migrate.php", "up"], env={**ENV, "DB_NAME": name})
    if rc:
        raise RuntimeError(f"migraciones fallidas en {name}: {out}")


def stage(name: str, level: str, rc: int, secs: float, note: str = "") -> None:
    STAGES[name] = {"level": level, "status": "aprobado" if rc == 0 else "fallido", "seconds": round(secs, 1), "note": note}
    print(f"[{STAGES[name]['status'].upper():8}] {name:<24} {secs:6.1f}s {note}")


def add(suite: str, level: str, name: str, status: str) -> None:
    CASES.append({"suite": suite, "level": level, "name": name, "status": status})


def parse_check_lines(suite: str, level: str, out: str) -> tuple[int, int]:
    ok = bad = 0
    for line in out.splitlines():
        s = line.strip()
        if s.startswith("✔ "):
            add(suite, level, s[2:].strip(), "aprobado"); ok += 1
        elif s.startswith("✘ FALLA:"):
            add(suite, level, s[len("✘ FALLA:"):].split("  [")[0].strip(), "fallido"); bad += 1
    return ok, bad


def want(name: str, skip: set[str]) -> bool:
    if name in skip:
        STAGES[name] = {"level": "-", "status": "no ejecutado", "seconds": 0, "note": "omitido por --skip"}
        print(f"[OMITIDO ] {name}")
        return False
    return True


def main() -> int:  # noqa: PLR0915
    skip = set(sys.argv[sys.argv.index("--skip") + 1:]) if "--skip" in sys.argv else set()
    OUT.mkdir(exist_ok=True)

    if want("lint-frontend", skip):
        rc, out, s = run([PNPM, "lint"])
        stage("lint-frontend", "estático", rc, s, "0 errores" if rc == 0 else out[-200:])
    if want("build-frontend", skip):
        rc, out, s = run([PNPM, "build"])
        stage("build-frontend", "estático", rc, s)
    if want("static-backend", skip):
        rc1, o1, s1 = run([str(PY), "-m", "ruff", "check", "."], cwd=ROOT / "backend")
        rc2, o2, s2 = run([str(PY), "-m", "ruff", "format", "--check", "."], cwd=ROOT / "backend")
        rc3, o3, s3 = run([str(PY), "-m", "mypy", "app"], cwd=ROOT / "backend")
        stage("static-backend", "estático", rc1 or rc2 or rc3, s1 + s2 + s3, "ruff + format + mypy")

    if want("unit-frontend", skip):
        rc, out, s = run([PNPM, "exec", "vitest", "run", "--coverage", "--reporter=json", f"--outputFile={OUT / 'vitest.json'}"])
        try:
            data = json.loads((OUT / "vitest.json").read_text(encoding="utf-8"))
            for f in data["testResults"]:
                for t in f["assertionResults"]:
                    add("vitest", "unitaria/componentes", f"{Path(f['name']).name} › {t['fullName']}", {"passed": "aprobado", "failed": "fallido"}.get(t["status"], "no ejecutado"))
        except (OSError, KeyError, ValueError):
            pass
        cov = re.search(r"All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)", out)
        stage("unit-frontend", "unitaria", rc, s, f"cobertura líneas {cov.group(4)}%, ramas {cov.group(2)}%, funciones {cov.group(3)}%" if cov else out[-200:])

    py_env = {**ENV}
    if want("backend", skip):
        recreate_db("optimus_test")
        rc, out, s = run([str(PY), "-m", "pytest", f"--junitxml={OUT / 'pytest.xml'}", "--cov=app", "--cov-branch", "--cov-report=term", "-q", "-m", "not perf"],
                         cwd=ROOT / "backend", env={**py_env, "DB_NAME": "optimus_test"})
        try:
            for tc in ET.parse(OUT / "pytest.xml").getroot().iter("testcase"):
                st = "fallido" if tc.find("failure") is not None or tc.find("error") is not None else "no ejecutado" if tc.find("skipped") is not None else "aprobado"
                add("pytest", "unitaria/integración/seguridad/concurrencia", f"{tc.get('classname', '').split('.')[-1]} › {tc.get('name')}", st)
        except (OSError, ET.ParseError):
            pass
        cov = re.search(r"TOTAL\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)%", out)
        stage("backend", "unitaria/integración", rc, s, f"cobertura app {cov.group(1)}% (líneas+ramas)" if cov else out[-200:])

    if want("db-rules", skip):
        recreate_db("optimus_rules_test")
        rc, out, s = run([PHP, "database/tests/db_rules_test.php"], env={**ENV, "DB_NAME": "optimus_rules_test"})
        ok, bad = parse_check_lines("reglas-bd", "integridad de base de datos", out)
        stage("db-rules", "integridad BD", rc, s, f"{ok} ok / {bad} fallos")

    for impl in ("php", "python"):
        name = f"contract-{impl}"
        if want(name, skip):
            recreate_db("optimus_contract_test")
            env = {**ENV, "DB_NAME": "optimus_contract_test"}
            if impl == "python":
                env["API_IMPL"] = "python"
            rc, out, s = run([PHP, "api/v1/tests/api_test.php"], env=env)
            ok, bad = parse_check_lines(f"contrato-{impl}", "contrato/seguridad API", out)
            stage(name, "contrato API", rc, s, f"{ok} ok / {bad} fallos")

    if want("compare-backends", skip):
        recreate_db("optimus_compare_test")
        rc, out, s = run([str(PY), "backend/tests/compare_backends.py"], env={**ENV, "DB_NAME": "optimus_compare_test"})
        m = re.search(r"idénticos: (\d+) · con diferencias: (\d+)", out)
        known = m is not None and int(m.group(2)) == 3  # las 3 conocidas (JSON_ARRAYAGG en MariaDB < 10.5)
        stage("compare-backends", "regresión PHP↔Python", 0 if (rc == 0 and known) else 1, s, f"{m.group(1)} idénticos, {m.group(2)} diferencias (esperadas: 3)" if m else out[-200:])

    if want("perf", skip):
        recreate_db("optimus_perf_test")
        rc, out, s = run([str(PY), "-m", "pytest", "-m", "perf", "-q", "tests/test_performance.py", f"--junitxml={OUT / 'perf.xml'}"],
                         cwd=ROOT / "backend", env={**ENV, "DB_NAME": "optimus_perf_test", "PERF_REPORT": "1"})
        try:
            for tc in ET.parse(OUT / "perf.xml").getroot().iter("testcase"):
                add("rendimiento", "rendimiento", f"{tc.get('name')}", "fallido" if tc.find("failure") is not None else "aprobado")
        except (OSError, ET.ParseError):
            pass
        stage("perf", "rendimiento", rc, s)

    if want("e2e", skip):
        rc, out, s = run([PNPM, "exec", "playwright", "test"], timeout=1800)
        try:
            data = json.loads((OUT / "e2e.json").read_text(encoding="utf-8"))

            def walk(suite: dict, trail: str = ""):
                for sub in suite.get("suites", []):
                    yield from walk(sub, f"{trail}{sub['title']} › ")
                for spec in suite.get("specs", []):
                    for t in spec["tests"]:
                        st = {"expected": "aprobado", "skipped": "no ejecutado", "flaky": "aprobado (inestable)", "unexpected": "fallido"}.get(t["status"], t["status"])
                        yield f"{trail}{spec['title']} [{t['projectName']}]", st

            for s_ in data["suites"]:
                for name, st in walk(s_):
                    add("playwright", "E2E/accesibilidad/responsive/seguridad UI", name, st)
        except (OSError, KeyError, ValueError):
            pass
        m = re.search(r"(\d+) passed", out), re.search(r"(\d+) failed", out), re.search(r"(\d+) skipped", out)
        stage("e2e", "E2E", rc, s, ", ".join(f"{x.group(1)} {w}" for x, w in zip(m, ("aprobadas", "fallidas", "omitidas"), strict=True) if x))

    if want("audit", skip):
        rc1, o1, s1 = run([PNPM, "audit"])
        rc2, o2, s2 = run([str(PY), "-m", "pip_audit", "-r", "backend/requirements.txt"])
        stage("audit", "seguridad dependencias", rc1 or rc2, s1 + s2, "pnpm audit + pip-audit")

    # ── matriz con identificadores únicos ─────────────────────────────────────────────────────────
    for i, c in enumerate(CASES, start=1):
        c["id"] = f"TEST-{i:03d}"
    (OUT / "summary.json").write_text(json.dumps({"stages": STAGES, "cases": CASES}, ensure_ascii=False, indent=1), encoding="utf-8")
    counts: dict[str, int] = {}
    for c in CASES:
        counts[c["status"]] = counts.get(c["status"], 0) + 1
    lines = ["# Matriz de casos de prueba (generada)", "", f"Generada por `scripts/run_all_tests.py` — {time.strftime('%Y-%m-%d %H:%M')}. Total: **{len(CASES)}** casos · "
             + " · ".join(f"{k}: {v}" for k, v in sorted(counts.items())), "", "| ID | Suite | Nivel | Caso | Resultado |", "|---|---|---|---|---|"]
    lines += [f"| {c['id']} | {c['suite']} | {c['level']} | {c['name'].replace('|', '/')} | {c['status']} |" for c in CASES]
    (ROOT / "docs" / "test-matrix.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    failed = [n for n, s in STAGES.items() if s["status"] == "fallido"]
    skipped = [n for n, s in STAGES.items() if s["status"] == "no ejecutado"]
    print(f"\nEtapas: {len(STAGES)} · fallidas: {failed or 'ninguna'} · no ejecutadas: {skipped or 'ninguna'} · casos: {len(CASES)} {counts}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
