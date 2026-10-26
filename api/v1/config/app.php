<?php
declare(strict_types=1);

// Carga api/v1/.env (si existe). Las variables reales del entorno del servidor tienen prioridad.
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        if (getenv($key) === false) $_ENV[$key] = trim($value);
    }
}

function env(string $key, mixed $default = null): mixed
{
    if (isset($_ENV[$key])) return $_ENV[$key];
    $v = getenv($key);
    return $v === false ? $default : $v;
}

/**
 * Falla CERRADO: cualquier valor distinto de "development"/"testing" (incluida la ausencia
 * de APP_ENV) se trata como producción. Evita CORS abierto y errores detallados por omisión.
 */
function isProduction(): bool
{
    return !in_array(env('APP_ENV', 'production'), ['development', 'testing'], true);
}

/** Aborta el arranque si la configuración de seguridad es insegura. */
function assertSecureConfig(): void
{
    $secret = (string) env('JWT_SECRET', '');
    $weak   = strlen($secret) < 32 || str_contains(strtolower($secret), 'change-this');
    if ($weak) {
        http_response_code(500);
        header('Content-Type: application/json');
        error_log('JWT_SECRET ausente, corto (<32) o de ejemplo: configuración insegura, arranque abortado');
        echo json_encode(['success' => false, 'message' => 'Configuración del servidor inválida']);
        exit;
    }
}

/**
 * IP del cliente. X-Forwarded-For solo se respeta si la conexión directa viene de un
 * proxy declarado en TRUSTED_PROXIES (lista separada por comas); si no, es falsificable.
 */
function clientIp(): string
{
    $remote  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $trusted = array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))));
    if ($trusted && in_array($remote, $trusted, true) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
        $ip    = end($parts); // el último salto es el que añadió nuestro proxy de confianza
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    return $remote;
}

/** ¿La petición llegó por HTTPS (directo o vía proxy de confianza)? */
function isHttps(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    $remote  = $_SERVER['REMOTE_ADDR'] ?? '';
    $trusted = array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))));
    return $trusted && in_array($remote, $trusted, true)
        && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
