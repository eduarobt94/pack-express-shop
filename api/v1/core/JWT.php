<?php
declare(strict_types=1);

/** JWT HS256 mínimo. El token de acceso lleva `typ=access`; el de refresco es opaco (ver Sessions). */
class JWT
{
    private static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64decode(string $data): string|false
    {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    public static function encode(array $payload, string $secret, int $expiry): string
    {
        $now     = time();
        $payload = array_merge($payload, ['iat' => $now, 'exp' => $now + $expiry]);

        $header    = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body      = self::b64url(json_encode($payload));
        $signature = self::b64url(hash_hmac('sha256', "$header.$body", $secret, true));

        return "$header.$body.$signature";
    }

    /** Payload decodificado, o null si es inválido/expirado. Fija el algoritmo (sin `alg` configurable). */
    public static function decode(string $token, string $secret, string $expectedType = 'access'): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $body, $signature] = $parts;

        $h = json_decode((string) self::b64decode($header), true);
        if (!is_array($h) || ($h['alg'] ?? null) !== 'HS256') return null;   // rechaza alg=none y otros

        $expected = self::b64url(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $signature)) return null;

        $raw  = self::b64decode($body);
        $data = $raw === false ? null : json_decode($raw, true);
        if (!is_array($data)) return null;
        if (!isset($data['exp']) || !is_int($data['exp']) || $data['exp'] < time()) return null;
        if (($data['typ'] ?? null) !== $expectedType) return null;           // un token de otro tipo no sirve
        if (!isset($data['sub']) || !ctype_digit((string) $data['sub'])) return null;

        return $data;
    }

    public static function fromHeader(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+([A-Za-z0-9_\-\.]{20,2048})$/', $auth, $m)) return $m[1];
        return null;
    }
}
