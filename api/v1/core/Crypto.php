<?php
declare(strict_types=1);

/**
 * Cifrado en reposo de datos personales sensibles (AES-256-GCM, autenticado).
 * Clave: DATA_ENC_KEY = 32 bytes aleatorios en base64 (`openssl rand -base64 32`), solo en el
 * entorno del servidor. Formato guardado: 0x01 | iv(12) | tag(16) | ciphertext.
 * Rotación: el byte de versión permite introducir una clave nueva sin romper datos viejos.
 */
final class Crypto
{
    private static function key(): string
    {
        $k = base64_decode((string) env('DATA_ENC_KEY', ''), true);
        if ($k === false || strlen($k) !== 32) throw new RuntimeException('DATA_ENC_KEY no configurada (32 bytes en base64)');
        return $k;
    }

    public static function encrypt(string $plain): string
    {
        $iv  = random_bytes(12);
        $tag = '';
        $ct  = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        if ($ct === false) throw new RuntimeException('Fallo al cifrar');
        return "\x01" . $iv . $tag . $ct;
    }

    public static function decrypt(string $blob): ?string
    {
        if (strlen($blob) < 30 || $blob[0] !== "\x01") return null;
        $plain = openssl_decrypt(substr($blob, 29), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($blob, 1, 12), substr($blob, 13, 16));
        return $plain === false ? null : $plain;
    }
}
