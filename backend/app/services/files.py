"""Almacén de comprobantes (mismas reglas que la API PHP).

- Tipo REAL por la firma del contenido; la extensión guardada sale del tipo detectado, nunca del nombre del cliente.
- Nombre aleatorio; se guarda una CLAVE relativa validada por regex (sin path traversal).
- Se lee como máximo UPLOAD_MAX_MB+1 bytes: un archivo enorme no llena la memoria.
- La descarga pasa por un endpoint autorizado. UPLOAD_DIR debería estar fuera del directorio web.
"""

from __future__ import annotations

import os
import re
import secrets
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile
from fastapi.responses import FileResponse

from app.config import get_settings
from app.core.errors import ApiError

_KEY = re.compile(r"^\d{4}/\d{2}/[a-f0-9]{32}\.(pdf|jpg|png|webp)$")
_EXT = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def sniff(head: bytes) -> str | None:
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n") and head[12:16] == b"IHDR":
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def save_upload(upload: UploadFile) -> str:
    s = get_settings()
    limit = s.upload_max_mb * 1024 * 1024
    data = upload.file.read(limit + 1)
    if not data or len(data) > limit:
        raise ApiError(413, f"El archivo debe pesar entre 1 byte y {s.upload_max_mb} MB")
    mime = sniff(data[:32])
    if mime is None:
        raise ApiError(415, "Solo se permiten PDF, JPG, PNG o WebP")

    sub = f"{datetime.now():%Y/%m}"
    key = f"{sub}/{secrets.token_hex(16)}.{_EXT[mime]}"
    target = s.upload_root / key
    try:
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
        target.write_bytes(data)
        os.chmod(target, 0o640)
    except OSError as exc:
        raise ApiError(500, "No se pudo guardar el archivo") from exc
    return key


def delete(key: str) -> None:
    if _KEY.match(key):
        Path(get_settings().upload_root / key).unlink(missing_ok=True)


def stream(key: str) -> FileResponse:
    """La autorización la decide el endpoint ANTES de llamar."""
    if not _KEY.match(key):
        raise ApiError.not_found("Archivo no encontrado")
    path = get_settings().upload_root / key
    if not path.is_file():
        raise ApiError.not_found("Archivo no encontrado")
    ext = path.suffix.lstrip(".")
    mime = next(m for m, e in _EXT.items() if e == ext)
    return FileResponse(
        path,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="comprobante.{ext}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
