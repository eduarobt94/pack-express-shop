<?php
declare(strict_types=1);

class JWT
{
    private static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64decode(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, string $secret, int $expiry): string
    {
        $now = time();
        $payload = array_merge($payload, ['iat' => $now, 'exp' => $now + $expiry]);

        $header    = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body      = self::b64url(json_encode($payload));
        $signature = self::b64url(hash_hmac('sha256', "$header.$body", $secret, true));

        return "$header.$body.$signature";
    }

    /**
     * Returns decoded payload or null on invalid/expired token.
     * Uses hash_equals to prevent timing attacks.
     */
    public static function decode(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $body, $signature] = $parts;

        $expected = self::b64url(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $signature)) return null;

        $data = json_decode(self::b64decode($body), true);
        if (!is_array($data)) return null;
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return $data;
    }

    public static function fromHeader(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($auth, 'Bearer ')) {
            return substr($auth, 7);
        }
        return null;
    }
}
