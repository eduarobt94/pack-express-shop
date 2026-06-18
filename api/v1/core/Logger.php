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

    private static function write(string $level, string $message, array $context, string $file = 'app'): void
    {
        $entry = json_encode([
            'ts'      => date('c'),
            'level'   => $level,
            'message' => $message,
            'ip'      => $_SERVER['REMOTE_ADDR'] ?? 'cli',
            'context' => $context,
        ], JSON_UNESCAPED_UNICODE);

        $path = self::$logDir . '/' . $file . '-' . date('Y-m-d') . '.log';
        file_put_contents($path, $entry . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}
