"""Dinero en centavos enteros (nunca float). Redondeo half-up, idéntico al ROUND() de la base para positivos."""

from __future__ import annotations

import re

_CENTS = re.compile(r"^\d{1,9}(\.\d{1,2})?$")


def to_cents(amount: str | int | float) -> int:
    s = str(amount).strip()
    if not _CENTS.match(s):
        raise ValueError("Importe inválido")
    whole, _, frac = s.partition(".")
    return int(whole) * 100 + int(frac.ljust(2, "0") or 0)


def fmt(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def scaled(number: str, scale: int) -> int:
    """'5.250' con escala 3 → 5250."""
    if not re.match(rf"^\d{{1,9}}(\.\d{{1,{scale}}})?$", number):
        raise ValueError("Número inválido")
    whole, _, frac = number.partition(".")
    return int(whole) * 10**scale + int(frac.ljust(scale, "0") or 0)


def commission(base_cents: int, rate: str) -> int:
    """ROUND(base × tasa, 2) con la tasa en 4 decimales ('0.1000')."""
    return (base_cents * scaled(rate, 4) + 5000) // 10000


def shipping(kg: str, rate_per_kg: str) -> int:
    """ROUND(kg × tarifa/kg, 2): kg con 3 decimales, tarifa con 2."""
    return (scaled(kg, 3) * to_cents(rate_per_kg) + 500) // 1000


def kg_str(milli: int) -> str:
    return f"{milli // 1000}.{milli % 1000:03d}"
