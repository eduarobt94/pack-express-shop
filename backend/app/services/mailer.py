"""Correo saliente mínimo (SMTP con STARTTLS). El contenido de los mensajes NO se registra en logs: puede traer
enlaces de un solo uso. Sin SMTP configurado, fuera de producción los mensajes se guardan en `outbox` (pruebas y
desarrollo); en producción no se envía nada y se deja constancia del hecho."""

from __future__ import annotations

import json
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import get_settings
from app.core.logging import log


@dataclass(frozen=True)
class Mail:
    to: str
    subject: str
    body: str


outbox: list[Mail] = []  # solo fuera de producción y sin SMTP
_OUTBOX_MAX = 200


def send(to: str, subject: str, body: str) -> bool:
    """Devuelve True si el mensaje salió (o quedó en el outbox de desarrollo). Nunca lanza excepciones."""
    s = get_settings()
    try:
        if s.smtp_host and s.mail_from:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = s.mail_from, to, subject
            msg.set_content(body)
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if s.smtp_user:
                    smtp.login(s.smtp_user, s.smtp_pass)
                smtp.send_message(msg)
            return True
        if not s.is_production:
            outbox.append(Mail(to, subject, body))
            del outbox[:-_OUTBOX_MAX]
            if s.mail_outbox_file:  # lo leen las pruebas E2E, que corren el servidor en otro proceso
                with open(s.mail_outbox_file, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps({"to": to, "subject": subject, "body": body}, ensure_ascii=False) + chr(10))
            return True
        log.warning("mail_not_configured")
        return False
    except Exception as exc:  # noqa: BLE001 (el envío no debe romper la respuesta ni revelar si la cuenta existe)
        log.error("mail_failed", error=type(exc).__name__)
        return False
