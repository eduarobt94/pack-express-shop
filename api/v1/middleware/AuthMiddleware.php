<?php
declare(strict_types=1);

class AuthMiddleware
{
    public function handle(): void
    {
        $token = JWT::fromHeader();

        if (!$token) {
            Response::unauthorized('Token de acceso requerido');
        }

        $payload = JWT::decode($token, env('JWT_SECRET'));

        if (!$payload) {
            Response::unauthorized('Token inválido o expirado');
        }

        // Inject user context for controllers
        $_REQUEST['_auth'] = $payload;
    }
}

/** Shortcut used inside controllers */
function authUser(): array
{
    return $_REQUEST['_auth'] ?? [];
}

function authId(): int
{
    return (int) ($_REQUEST['_auth']['sub'] ?? 0);
}
