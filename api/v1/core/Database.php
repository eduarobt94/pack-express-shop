<?php
declare(strict_types=1);

class Database
{
    private static ?PDO $instance = null;

    public static function get(): PDO
    {
        if (self::$instance !== null) return self::$instance;

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            env('DB_HOST', '127.0.0.1'),
            env('DB_PORT', '3306'),
            env('DB_NAME', 'optimus')
        );

        self::$instance = new PDO($dsn, env('DB_USER'), env('DB_PASS'), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        return self::$instance;
    }

    /** Execute a query returning all rows. */
    public static function query(string $sql, array $params = []): array
    {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Execute a query returning one row or null. */
    public static function queryOne(string $sql, array $params = []): ?array
    {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** Execute INSERT/UPDATE/DELETE, returns affected row count. */
    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** Execute INSERT and return last insert id. */
    public static function insert(string $sql, array $params = []): string
    {
        self::execute($sql, $params);
        return self::get()->lastInsertId();
    }

    /** Códigos públicos sin carreras: contador atómico por (nombre, año). */
    public static function nextSeq(string $name, int $year): int
    {
        self::execute('INSERT INTO counters (name, year, seq) VALUES (?, ?, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1)', [$name, $year]);
        return (int) self::get()->lastInsertId();
    }

    public static function inTransaction(): bool     { return self::get()->inTransaction(); }
    public static function beginTransaction(): void  { self::get()->beginTransaction(); }
    public static function commit(): void            { self::get()->commit(); }
    public static function rollback(): void          { if (self::get()->inTransaction()) self::get()->rollBack(); }
}
