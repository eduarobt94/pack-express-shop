<?php
declare(strict_types=1);

/**
 * Rate limiting en base de datos (compartido entre procesos, atómico).
 * Cada llamada incrementa un contador por (ámbito, identificador, ventana) con un único
 * INSERT ... ON DUPLICATE KEY UPDATE, sin carreras de lectura-modificación-escritura.
 */
class RateLimiter
{
    protected string $scope  = 'global';
    protected int $limit     = 0;   // 0 = usar RATE_LIMIT_REQUESTS
    protected int $window    = 0;   // 0 = usar RATE_LIMIT_WINDOW

    /** Cuenta un golpe y devuelve true si todavía está dentro del límite. */
    public static function hit(string $scope, string $identifier, int $limit, int $window): bool
    {
        $slot = intdiv(time(), $window);
        $key  = hash('sha256', "$scope|$identifier|$slot");
        Database::execute(
            'INSERT INTO rate_limits (bucket_key, hits, window_start) VALUES (?, 1, ?)
             ON DUPLICATE KEY UPDATE hits = hits + 1',
            [$key, $slot * $window]
        );
        $hits = (int) Database::queryOne('SELECT hits FROM rate_limits WHERE bucket_key = ?', [$key])['hits'];

        if (random_int(1, 200) === 1) {   // limpieza ocasional de ventanas viejas
            Database::execute('DELETE FROM rate_limits WHERE window_start < ?', [time() - 86400]);
        }
        return $hits <= $limit;
    }

    public function handle(): void
    {
        $limit  = $this->limit  ?: (int) env('RATE_LIMIT_REQUESTS', 60);
        $window = $this->window ?: (int) env('RATE_LIMIT_WINDOW', 60);
        $route  = ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . strtok($_SERVER['REQUEST_URI'] ?? '/', '?');

        // Por IP y por endpoint: una ráfaga contra /auth/login no agota el cupo de los demás.
        $ok = self::hit($this->scope, clientIp() . '|' . $route, $limit, $window);
        if (!$ok) {
            header('Retry-After: ' . $window);
            Logger::warning('rate_limited', ['route' => $route, 'scope' => $this->scope]);
            Response::error('Demasiadas solicitudes. Intentá nuevamente en breve.', 429);
        }
    }
}

/** Autenticación: 10 intentos por minuto y por IP+endpoint. */
class AuthRateLimiter extends RateLimiter
{
    protected string $scope = 'auth';
    protected int $limit    = 0;
    protected int $window   = 60;

    public function handle(): void
    {
        $this->limit = (int) env('AUTH_RATE_LIMIT', 10);   // configurable; por defecto 10/min por IP y endpoint
        parent::handle();
    }
}

/** Operaciones sensibles (cargas de archivos, pagos, emisión): 20 por minuto y POR USUARIO. Va después de AuthMiddleware. */
class SensitiveRateLimiter extends RateLimiter
{
    protected string $scope = 'sensitive';
    protected int $limit    = 20;
    protected int $window   = 60;

    public function handle(): void
    {
        $route = ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
        if (!self::hit($this->scope, 'u' . Auth::id() . '|' . $route, $this->limit, $this->window)) {
            header('Retry-After: ' . $this->window);
            Logger::warning('rate_limited', ['route' => $route, 'scope' => $this->scope, 'user_id' => Auth::id()]);
            Response::error('Demasiadas solicitudes. Intentá nuevamente en breve.', 429);
        }
    }
}
