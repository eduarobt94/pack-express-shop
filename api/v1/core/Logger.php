<?php
declare(strict_types=1);

class Logger
{
    private static string $logDir = __DIR__ . '/../logs';

    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('WARNING', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }

    public static function audit(string $action, int $userId, array $context = []): void
    {
        self::write('AUDIT', $action, array_merge(['user_id' => $userId], $context), 'audit');
    }

    /** Nunca registrar credenciales ni PII directa: se enmascaran por nombre de clave. */
    private static function scrub(array $ctx): array
    {
        foreach ($ctx as $k => $v) {
            if (preg_match('/pass|secret|token|authorization|cookie|email|id_doc/i', (string) $k)) $ctx[$k] = '[omitido]';
            elseif (is_array($v)) $ctx[$k] = self::scrub($v);
        }
        return $ctx;
    }

    private static function write(string $level, string $message, array $context, string $file = 'app'): void
    {
        $entry = json_encode([
            'ts'      => date('c'),
            'level'   => $level,
            'message' => $message,
            'ip'      => function_exists('clientIp') ? clientIp() : 'cli',
            'context' => self::scrub($context),
        ], JSON_UNESCAPED_UNICODE);

        $path = self::$logDir . '/' . $file . '-' . date('Y-m-d') . '.log';
        file_put_contents($path, $entry . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}
