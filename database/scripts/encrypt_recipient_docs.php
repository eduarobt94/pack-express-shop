<?php
declare(strict_types=1);

/**
 * Migra addresses.ci (texto plano, obsoleto) → addresses.id_doc_enc (AES-256-GCM).
 *
 *   php database/scripts/encrypt_recipient_docs.php              # simulacro: no escribe nada
 *   php database/scripts/encrypt_recipient_docs.php --apply      # cifra y VERIFICA cada fila (descifra y compara)
 *   php database/scripts/encrypt_recipient_docs.php --apply --blank-legacy
 *        # además vacía `ci` SOLO en las filas verificadas. Es irreversible: exige respaldo previo.
 *
 * Requiere DATA_ENC_KEY y las variables DB_* (o api/v1/.env). Reconciliación al final:
 * filas con ci, cifradas, verificadas y pendientes.
 */

require_once __DIR__ . '/../../api/v1/config/app.php';
require_once __DIR__ . '/../../api/v1/core/Crypto.php';

$apply = in_array('--apply', $argv, true);
$blank = in_array('--blank-legacy', $argv, true);
if ($blank && !$apply) { fwrite(STDERR, "--blank-legacy requiere --apply\n"); exit(2); }

$pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', env('DB_HOST', '127.0.0.1'), env('DB_PORT', '3306'), env('DB_NAME', 'optimus')),
    (string) env('DB_USER'), (string) env('DB_PASS', ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$rows = $pdo->query("SELECT id, ci FROM addresses WHERE ci IS NOT NULL AND ci <> '' AND id_doc_enc IS NULL")->fetchAll(PDO::FETCH_ASSOC);
printf("Filas con documento en texto plano pendientes de cifrar: %d%s\n", count($rows), $apply ? '' : '  (simulacro)');

$ok = 0; $bad = 0;
foreach ($rows as $r) {
    if (!$apply) continue;
    $blob = Crypto::encrypt($r['ci']);
    if (Crypto::decrypt($blob) !== $r['ci']) { $bad++; fprintf(STDERR, "Verificación fallida en address %d: NO se modifica\n", $r['id']); continue; }
    $pdo->prepare('UPDATE addresses SET id_doc_enc = ? WHERE id = ? AND id_doc_enc IS NULL')->execute([$blob, $r['id']]);
    if ($blank) $pdo->prepare('UPDATE addresses SET ci = NULL WHERE id = ?')->execute([$r['id']]);
    $ok++;
}

$left = (int) $pdo->query("SELECT COUNT(*) FROM addresses WHERE ci IS NOT NULL AND ci <> ''")->fetchColumn();
$enc  = (int) $pdo->query('SELECT COUNT(*) FROM addresses WHERE id_doc_enc IS NOT NULL')->fetchColumn();
printf("Cifradas y verificadas ahora: %d · fallidas: %d · con id_doc_enc en total: %d · con ci en texto plano restante: %d\n", $ok, $bad, $enc, $left);
exit($bad > 0 ? 1 : 0);
