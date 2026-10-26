<?php
declare(strict_types=1);

/**
 * Dinero en centavos enteros (nunca float). Redondeo half-up a 2 decimales al final,
 * igual que ROUND() de la base de datos para valores positivos.
 */
final class Money
{
    /** "12.34" → 1234. Rechaza más de 2 decimales y formatos no numéricos. */
    public static function toCents(string|int|float $amount): int
    {
        $s = trim((string) $amount);
        if (!preg_match('/^\d{1,9}(\.\d{1,2})?$/', $s)) throw new InvalidArgumentException('Importe inválido');
        [$i, $d] = array_pad(explode('.', $s), 2, '0');
        return (int) $i * 100 + (int) str_pad($d, 2, '0');
    }

    public static function fmt(int $cents): string
    {
        return intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    /** comisión = ROUND(base × tasa, 2). La tasa llega como "0.1000" (4 decimales). */
    public static function commission(int $baseCents, string $rate): int
    {
        return intdiv($baseCents * self::scaled($rate, 4) + 5000, 10000);
    }

    /** envío = ROUND(kg × tarifa/kg, 2). kg con 3 decimales ("5.000"), tarifa con 2. */
    public static function shipping(string $kg, string $ratePerKg): int
    {
        return intdiv(self::scaled($kg, 3) * self::toCents($ratePerKg) + 500, 1000);
    }

    /** "5.250" → 5250 (escala fija) */
    public static function scaled(string $n, int $scale): int
    {
        if (!preg_match('/^\d{1,9}(\.\d{1,' . $scale . '})?$/', $n)) throw new InvalidArgumentException('Número inválido');
        [$i, $d] = array_pad(explode('.', $n), 2, '');
        return (int) $i * (10 ** $scale) + (int) str_pad($d, $scale, '0');
    }
}
