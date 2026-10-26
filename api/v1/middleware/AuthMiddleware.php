<?php
declare(strict_types=1);

/**
 * Usuario autenticado de la petición. Se guarda en un estado estático (NO en $_REQUEST,
 * que el cliente puede poblar con ?_auth[...]) y siempre se recarga desde la base:
 * rol, estado y token_version reflejan el valor ACTUAL, así que suspender a un usuario
 * o cambiarle el rol/contraseña surte efecto de inmediato.
 */
final class Auth
{
    private static ?array $user = null;

    public static function set(array $user): void { self::$user = $user; }
    public static function user(): array          { return self::$user ?? []; }
    public static function id(): int              { return (int) (self::$user['id'] ?? 0); }
    public static function role(): string         { return (string) (self::$user['role'] ?? ''); }
    public static function reset(): void          { self::$user = null; }
}

class AuthMiddleware
{
    public function handle(): void
    {
        $token = JWT::fromHeader();
        if (!$token) Response::unauthorized('Token de acceso requerido');

        $payload = JWT::decode($token, (string) env('JWT_SECRET'), 'access');
        if (!$payload) Response::unauthorized('Token inválido o expirado');

        $user = Database::queryOne(
            'SELECT id, name, email, role, status, token_version FROM users WHERE id = ?',
            [(int) $payload['sub']]
        );

        if (!$user || $user['status'] !== 'active' || (int) $user['token_version'] !== (int) ($payload['ver'] ?? -1)) {
            Response::unauthorized('Sesión inválida o revocada');
        }

        Auth::set($user);
        // El trigger de historial de estados atribuye los cambios a este usuario.
        Database::get()->exec('SET @app_user_id = ' . (int) $user['id']);
    }
}

/** Exige uno de los roles indicados. Uso en rutas: [RateLimiter::class, AuthMiddleware::class, StaffMiddleware::class] */
class StaffMiddleware
{
    public function handle(): void
    {
        if (!in_array(Auth::role(), ['agent', 'admin'], true)) Response::forbidden('Permisos insuficientes');
    }
}

class WarehouseMiddleware
{
    public function handle(): void
    {
        if (!in_array(Auth::role(), ['warehouse', 'agent', 'admin'], true)) Response::forbidden('Permisos insuficientes');
    }
}

class AdminMiddleware
{
    public function handle(): void
    {
        if (Auth::role() !== 'admin') Response::forbidden('Permisos insuficientes');
    }
}

/** Atajos usados en los controladores */
function authUser(): array { return Auth::user(); }
function authId(): int     { return Auth::id(); }
