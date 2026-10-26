"""Logging estructurado en JSON (una línea por evento), sin credenciales ni PII directa.

Dos archivos por día: app-AAAA-MM-DD.log (técnico) y audit-AAAA-MM-DD.log (acciones de usuarios).
Las claves sensibles se enmascaran por nombre (pass, secret, token, authorization, cookie, email, id_doc).
"""

from __future__ import annotations

import json
import re
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

_SENSITIVE = re.compile(r"pass|secret|token|authorization|cookie|email|id_doc", re.IGNORECASE)
_lock = threading.Lock()


def scrub(ctx: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in ctx.items():
        if _SENSITIVE.search(str(key)):
            out[key] = "[omitido]"
        elif isinstance(value, dict):
            out[key] = scrub(value)
        else:
            out[key] = value
    return out


class _Logger:
    def __init__(self) -> None:
        self._dir: Path | None = None
        self.client_ip_getter = lambda: "cli"

    def configure(self, log_dir: str) -> None:
        self._dir = Path(log_dir)
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            self._dir = None  # sin disco: solo stderr

    def _write(self, level: str, message: str, ctx: dict[str, Any], stream: str = "app") -> None:
        entry = {
            "ts": datetime.now().astimezone().isoformat(timespec="seconds"),
            "level": level,
            "message": message,
            "ip": self.client_ip_getter(),
            "context": scrub(ctx),
        }
        line = json.dumps(entry, ensure_ascii=False, default=str)
        with _lock:
            if self._dir is not None:
                path = self._dir / f"{stream}-{datetime.now():%Y-%m-%d}.log"
                with path.open("a", encoding="utf-8") as fh:
                    fh.write(line + "\n")
            if level in ("ERROR", "WARNING"):
                print(line, file=sys.stderr)

    def info(self, message: str, **ctx: Any) -> None:
        self._write("INFO", message, ctx)

    def warning(self, message: str, **ctx: Any) -> None:
        self._write("WARNING", message, ctx)

    def error(self, message: str, **ctx: Any) -> None:
        self._write("ERROR", message, ctx)

    def audit(self, action: str, user_id: int, **ctx: Any) -> None:
        self._write("AUDIT", action, {"user_id": user_id, **ctx}, stream="audit")


log = _Logger()
