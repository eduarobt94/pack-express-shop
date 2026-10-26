<?php
declare(strict_types=1);

/**
 * Runner de migraciones versionadas — Optimus Envíos.
 *
 *   php database/migrate.php status
 *   php database/migrate.php up            # aplica las pendientes, en orden
 *   php database/migrate.php up --yes-i-have-a-backup   # obligatorio si APP_ENV=production
 *
 * Conexión: variables de entorno DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
 * (o api/v1/.env). Usar un usuario con permisos DDL (optimus_migrator), nunca el de la app.
 *
 * Formato de migración: database/migrations/NNN_nombre.sql
 *  - Los bloques se separan con una línea exacta  `-- @@`
 *  - Un bloque que empieza con `-- @@assert <mensaje>` seguido de un SELECT de un solo valor
 *    ABORTA la migración si el valor no es 0 (precondición de datos).
 *
 * El DDL de MariaDB/MySQL hace commit implícito: una migración NO es atómica. Por eso cada
 * migración es idempotente (IF NOT EXISTS / OR REPLACE) y solo se registra en
 * schema_migrations cuando termina completa. Ante un fallo: corregir la causa y volver a ejecutar.
 */

function loadEnv(string $file): void
{
    if (!is_file($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        if (getenv(trim($k)) === false) putenv(trim($k) . '=' . trim($v));
    }
}

loadEnv(__DIR__ . '/../api/v1/.env');

$cmd   = $argv[1] ?? 'status';
$flags = array_slice($argv, 2);
$prod  = getenv('APP_ENV') === 'production';

if ($cmd === 'up' && $prod && !in_array('--yes-i-have-a-backup', $flags, true)) {
    fwrite(STDERR, "APP_ENV=production: confirmá que existe un respaldo verificado y agregá --yes-i-have-a-backup\n");
    exit(2);
}

$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    getenv('DB_HOST') ?: '127.0.0.1', getenv('DB_PORT') ?: '3306', getenv('DB_NAME') ?: 'optimus');
$pdo = new PDO($dsn, getenv('DB_USER') ?: 'root', getenv('DB_PASS') ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => true,
    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
]);

$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(10)  NOT NULL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    checksum    CHAR(64)     NOT NULL,
    applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

$applied = [];
foreach ($pdo->query('SELECT version, checksum FROM schema_migrations') as $r) {
    $applied[$r['version']] = $r['checksum'];
}

$files = glob(__DIR__ . '/migrations/*.sql');
sort($files, SORT_STRING);

$pending = [];
foreach ($files as $file) {
    $name = basename($file, '.sql');
    [$version] = explode('_', $name, 2);
    $sum = hash('sha256', (string) file_get_contents($file));
    if (isset($applied[$version])) {
        if ($applied[$version] !== $sum) {
            fwrite(STDERR, "ERROR: la migración $name ya aplicada fue modificada (checksum distinto). Crear una migración nueva.\n");
            exit(3);
        }
        continue;
    }
    $pending[] = [$version, $name, $file, $sum];
}

if ($cmd === 'status') {
    foreach ($files as $f) {
        $n = basename($f, '.sql');
        printf("%-45s %s\n", $n, isset($applied[explode('_', $n, 2)[0]]) ? 'aplicada' : 'PENDIENTE');
    }
    exit(0);
}

if ($cmd !== 'up') { fwrite(STDERR, "Comando desconocido: $cmd\n"); exit(1); }

foreach ($pending as [$version, $name, $file, $sum]) {
    echo "→ $name\n";
    $blocks = preg_split('/^-- @@/m', (string) file_get_contents($file));
    foreach ($blocks as $i => $block) {
        $block = trim($block);
        if ($block === '' || preg_match('/\A(?:--[^\n]*(?:\n|\z)|\s)*\z/', $block)) continue; // vacío o solo comentarios
        if (str_starts_with($block, 'assert')) {
            [$first, $sql] = array_pad(explode("\n", $block, 2), 2, '');
            $st = $pdo->query(rtrim(trim($sql), ';'));
            $rows = $st->fetchAll(PDO::FETCH_COLUMN);
            $st->closeCursor();
            $value = $rows[0] ?? null;
            if ((string) $value !== '0') {
                fwrite(STDERR, "ABORTADO — precondición no cumplida en $name: " . trim(substr($first, 6)) . " (valor=$value)\n");
                exit(4);
            }
            continue;
        }
        try {
            $pdo->exec($block);
        } catch (Throwable $e) {
            fwrite(STDERR, "ERROR en $name, bloque #$i: " . $e->getMessage() . "\n--- bloque ---\n" . substr($block, 0, 400) . "\n");
            fwrite(STDERR, "La migración NO se registró. Corregí y volvé a ejecutar (es idempotente).\n");
            exit(5);
        }
    }
    $st = $pdo->prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?,?,?)');
    $st->execute([$version, $name, $sum]);
    echo "  ok\n";
}
echo $pending ? "Migraciones aplicadas: " . count($pending) . "\n" : "Nada pendiente.\n";
