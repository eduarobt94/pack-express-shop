<?php
declare(strict_types=1);

// Load .env from api/v1/.env
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
}

function env(string $key, mixed $default = null): mixed
{
    return $_ENV[$key] ?? $default;
}

function isProduction(): bool
{
    return env('APP_ENV') === 'production';
}
