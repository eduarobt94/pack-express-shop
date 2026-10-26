<?php
declare(strict_types=1);

/** Hash de contraseñas: Argon2id si PHP lo soporta; si no, bcrypt cost 12. Con rehash transparente. */
final class Passwords
{
    private static function algo(): string|int
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    private static function opts(): array
    {
        return defined('PASSWORD_ARGON2ID') ? ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1] : ['cost' => 12];
    }

    public static function hash(string $plain): string        { return password_hash($plain, self::algo(), self::opts()); }
    public static function needsRehash(string $hash): bool    { return password_needs_rehash($hash, self::algo(), self::opts()); }

    /** Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe. */
    public static function dummy(): string
    {
        static $d = null;
        return $d ??= self::hash('dummy-' . bin2hex(random_bytes(8)));
    }
}
