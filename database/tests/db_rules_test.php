<?php
declare(strict_types=1);

/**
 * Pruebas de las reglas de integridad y seguridad que viven EN la base de datos.
 *
 * Requiere una base VACÍA y desechable (se crea con datos de prueba que, por diseño, no se pueden borrar):
 *   mysql -e "DROP DATABASE IF EXISTS optimus_test; CREATE DATABASE optimus_test CHARACTER SET utf8mb4"
 *   DB_NAME=optimus_test php database/migrate.php up
 *   DB_NAME=optimus_test php database/tests/db_rules_test.php
 * Variables: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME. Se niega a correr si DB_NAME no termina en _test.
 */

$dbName = getenv('DB_NAME') ?: '';
if (!str_ends_with($dbName, '_test')) { fwrite(STDERR, "Se niega a correr: DB_NAME debe terminar en _test\n"); exit(2); }

function connect(): PDO
{
    return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', getenv('DB_HOST') ?: '127.0.0.1', getenv('DB_PORT') ?: '3306', getenv('DB_NAME')),
        getenv('DB_USER') ?: 'root', getenv('DB_PASS') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
}

if (($argv[1] ?? '') === '--worker-pay') {              // proceso concurrente: intenta registrar un pago
    $pdo = connect();
    $pdo->exec('SET SESSION innodb_lock_wait_timeout = 20');
    try {
        $pdo->prepare('INSERT INTO payments (settlement_id, amount, amount_original, method, branch, received_by, receipt_ref) VALUES (?,?,?,?,?,?,?)')
            ->execute([$argv[2], $argv[3], $argv[3], 'cash', 'Centro', $argv[4], 'CONC-B-' . getmypid()]);
        echo 'OK';
    } catch (PDOException $e) { echo 'FAIL:' . $e->getMessage(); }
    exit(0);
}

$pdo = connect();
$pass = 0; $fail = 0;
function check(string $label, bool $cond): void { global $pass, $fail; if ($cond) { $pass++; echo "  ✔ $label\n"; } else { $fail++; echo "  ✘ FALLA: $label\n"; } }
function expectFail(string $label, callable $fn, string $contains = ''): void
{
    try { $fn(); check($label . ' — debía ser rechazado', false); }
    catch (PDOException $e) {
        $ok = $contains === '' || stripos($e->getMessage(), $contains) !== false;
        check($label, $ok);
        if (!$ok) echo "     mensaje inesperado: " . $e->getMessage() . "\n";
    }
}
function q(PDO $p, string $sql, array $a = []): PDOStatement { $s = $p->prepare($sql); $s->execute($a); return $s; }
function id(PDO $p): int { return (int) $p->lastInsertId(); }
function section(string $t): void { echo "\n$t\n"; }

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────
function user(PDO $p, string $email, string $role): int {
    q($p, "INSERT INTO users (name,email,password_hash,status,role) VALUES (?,?,?,?,?)", ['Test ' . $role, $email, '$2y$12$x', 'active', $role]);
    return id($p);
}
$A = user($pdo, 'a@test.uy', 'customer'); $B = user($pdo, 'b@test.uy', 'customer');
$AG = user($pdo, 'agent@test.uy', 'agent'); $AD = user($pdo, 'admin@test.uy', 'admin'); $WH = user($pdo, 'wh@test.uy', 'warehouse');
function addr(PDO $p, int $u, string $prov = 'HAB', int $def = 0): int {
    q($p, "INSERT INTO addresses (user_id,recipient,province,street,is_default) VALUES (?,?,?,?,?)", [$u, 'Destinatario Prueba', $prov, 'Calle 1', $def]);
    return id($p);
}
$addrA = addr($pdo, $A, 'HAB', 1); $addrB = addr($pdo, $B, 'SCU', 1);
function purchase(PDO $p, int $u, int $addr, string $orderNo, string $code): int {
    q($p, "INSERT INTO purchases (code,user_id,recipient_id,store,store_order_number,purchased_on,receipt_path,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,CURDATE(),?,?,NOW())",
        [$code, $u, $addr, 'Amazon', $orderNo, 'r.pdf', 'v1']);
    return id($p);
}
function item(PDO $p, int $purchase, int $qty, string $price, string $disc = '0'): void {
    q($p, "INSERT INTO purchase_items (purchase_id,description,qty,unit_price,discount) VALUES (?,?,?,?,?)", [$purchase, 'Producto de prueba', $qty, $price, $disc]);
}

section('1. Relaciones, pertenencia y duplicados');
$P1 = purchase($pdo, $A, $addrA, '111-0000001', 'OPT-HAB-2026-00001');
check('compra válida del cliente A con su propio destinatario', $P1 > 0);
expectFail('compra de A con destinatario de B (IDOR a nivel de datos) rechazada', fn() => purchase($pdo, $A, $addrB, '111-0000002', 'OPT-SCU-2026-00001'), 'foreign key');
expectFail('pedido de tienda duplicado del mismo cliente rechazado', fn() => purchase($pdo, $A, $addrA, '111-0000001', 'OPT-HAB-2026-00002'), 'Duplicate');
expectFail('código de compra duplicado rechazado', fn() => purchase($pdo, $A, $addrA, '111-0000003', 'OPT-HAB-2026-00001'), 'Duplicate');
expectFail('provincia inexistente rechazada (FK a provinces)', fn() => addr($pdo, $A, 'ZZZ'), 'foreign key');
expectFail('segundo destinatario predeterminado del mismo cliente rechazado', fn() => addr($pdo, $A, 'MTZ', 1), 'Duplicate');
check('dos clientes pueden tener cada uno su predeterminado', $addrB > 0);
expectFail('moneda distinta de USD rechazada', fn() => q($pdo, "UPDATE purchases SET currency='EUR' WHERE id=?", [$P1]));

section('2. Validación de productos (CHECK)');
item($pdo, $P1, 2, '50.00', '10.00');
check('producto válido; importe de línea = 2×50−10 = 90', (float) q($pdo, 'SELECT SUM(line_amount) FROM purchase_items WHERE purchase_id=?', [$P1])->fetchColumn() === 90.0);
expectFail('cantidad 0 rechazada', fn() => item($pdo, $P1, 0, '10'));
expectFail('precio negativo rechazado', fn() => item($pdo, $P1, 1, '-5'));
expectFail('descuento mayor al importe rechazado', fn() => item($pdo, $P1, 1, '10', '11'));
expectFail('URL con esquema javascript: rechazada', fn() => q($pdo, "INSERT INTO purchase_items (purchase_id,description,url,qty,unit_price) VALUES (?,?,?,?,?)", [$P1, 'x producto', 'javascript:alert(1)', 1, 5]));

section('3. Estados de la compra');
expectFail('transición registered → fully_received no permitida', fn() => q($pdo, "UPDATE purchases SET status='fully_received' WHERE id=?", [$P1]), 'no permitida');
q($pdo, "UPDATE purchases SET status='accepted' WHERE id=?", [$P1]);
check('registered → accepted permitido', q($pdo, 'SELECT status FROM purchases WHERE id=?', [$P1])->fetchColumn() === 'accepted');
expectFail('agregar productos a una compra aceptada rechazado', fn() => item($pdo, $P1, 1, '10'), 'aceptada');
expectFail('cambiar el propietario de la compra rechazado', fn() => q($pdo, 'UPDATE purchases SET user_id=? WHERE id=?', [$B, $P1]), 'propietario');
expectFail('borrar una compra rechazado', fn() => q($pdo, 'DELETE FROM purchases WHERE id=?', [$P1]), 'no se eliminan');
check('el cambio de estado quedó en status_log', (int) q($pdo, "SELECT COUNT(*) FROM status_log WHERE entity='purchase' AND to_status='accepted'")->fetchColumn() === 1);

section('4. Paquetes y envíos');
function pkg(PDO $p, string $id, ?int $u, ?int $purchase, ?string $w, string $status = 'received_us'): void {
    q($p, "INSERT INTO packages (id,user_id,purchase_id,tracking_number,weight_kg,status) VALUES (?,?,?,?,?,?)", [$id, $u, $purchase, 'TRK' . $id, $w, $status]);
}
expectFail('paquete con peso 0 rechazado', fn() => pkg($pdo, 'W1', $A, $P1, '0'));
expectFail('paquete con peso negativo rechazado', fn() => pkg($pdo, 'W2', $A, $P1, '-3'));
pkg($pdo, 'U1', null, null, '4.2', 'unidentified');
check('paquete no identificado (sin cliente) admitido en la bandeja', true);
expectFail('paquete sin cliente pero ya asignado a compra rechazado', fn() => pkg($pdo, 'U2', null, $P1, '1', 'received_us'));
expectFail('paquete de B vinculado a compra de A rechazado (FK compuesta)', fn() => pkg($pdo, 'X1', $B, $P1, '1'), 'foreign key');
pkg($pdo, 'K1', $A, $P1, '5.000');
pkg($pdo, 'K2', $A, $P1, null);   // aún sin pesar
function shipment(PDO $p, string $id, int $u, ?int $addr): void {
    q($p, "INSERT INTO locker_shipments (id,user_id,suite_id,address_id) VALUES (?,?,?,?)", [$id, $u, 'S', $addr]);
}
expectFail('envío de A con destinatario de B rechazado', fn() => shipment($pdo, 'SH-T-0', $A, $addrB), 'foreign key');
shipment($pdo, 'SH-T-1', $A, $addrA);
q($pdo, "INSERT INTO locker_shipment_packages (shipment_id,package_id) VALUES ('SH-T-1','K1')");
check('paquete propio agregado al envío', true);
pkg($pdo, 'B1', $B, null, '2');
expectFail('paquete de otro cliente agregado al envío rechazado', fn() => q($pdo, "INSERT INTO locker_shipment_packages VALUES ('SH-T-1','B1')"), 'otro cliente');
expectFail('paquete no identificado agregado al envío rechazado', fn() => q($pdo, "INSERT INTO locker_shipment_packages VALUES ('SH-T-1','U1')"), 'identificado');
shipment($pdo, 'SH-T-2', $A, $addrA);
expectFail('el mismo paquete en dos envíos rechazado', fn() => q($pdo, "INSERT INTO locker_shipment_packages VALUES ('SH-T-2','K1')"), 'Duplicate');
expectFail('borrar un paquete rechazado', fn() => q($pdo, "DELETE FROM packages WHERE id='K1'"), 'no se eliminan');
expectFail('borrar un usuario con datos rechazado (sin cascada destructiva)', fn() => q($pdo, 'DELETE FROM users WHERE id=?', [$A]), 'foreign key');

section('5. Liquidaciones: cálculo, emisión e inmutabilidad');
function settlement(PDO $p, string $code, int $u, ?string $ship, string $base, string $comm, ?string $kg, ?string $shipping, ?string $total, string $extra = '0', ?string $note = null): int {
    q($p, "INSERT INTO settlements (code,user_id,shipment_id,tariff_version_id,commission_rate,sell_rate_per_kg,product_base,commission,weight_billable_kg,shipping,extra_charges,extra_charges_note,total)
           VALUES (?,?,?,1,0.1000,11.00,?,?,?,?,?,?,?)", [$code, $u, $ship, $base, $comm, $kg, $shipping, $extra, $note, $total]);
    return id($p);
}
expectFail('comisión que no es 10% de la base rechazada', fn() => settlement($pdo, 'LQ-T-0', $A, 'SH-T-1', '100', '12.00', '5', '55.00', '67.00'), 'chk_settle_comm');
expectFail('envío que no es kg × tarifa rechazado', fn() => settlement($pdo, 'LQ-T-0', $A, 'SH-T-1', '100', '10.00', '5', '54.00', '64.00'), 'chk_settle_ship');
expectFail('total que no suma comisión + envío rechazado', fn() => settlement($pdo, 'LQ-T-0', $A, 'SH-T-1', '100', '10.00', '5', '55.00', '70.00'), 'chk_settle_total');
expectFail('cargo extra sin justificación rechazado', fn() => settlement($pdo, 'LQ-T-0', $A, 'SH-T-1', '100', '10.00', '5', '55.00', '75.00', '10'), 'chk_settle_extra');
expectFail('peso 0 en liquidación rechazado', fn() => settlement($pdo, 'LQ-T-0', $A, 'SH-T-1', '100', '10.00', '0', '0.00', '10.00'));
// USD 100 de productos, 5 kg a 11 USD/kg => 10 + 55 = 65 (caso de aceptación del documento)
$S1 = settlement($pdo, 'LQ-T-1', $A, 'SH-T-1', '100.00', '10.00', '5.000', '55.00', '65.00');
check('liquidación de ejemplo: USD 100 + 5 kg × USD 11 = USD 65 aceptada', $S1 > 0);
expectFail('insertar una liquidación ya emitida directamente rechazado', fn() => q($pdo, "INSERT INTO settlements (code,user_id,tariff_version_id,commission_rate,sell_rate_per_kg,product_base,commission,weight_billable_kg,shipping,total,status,issued_by,issued_at) VALUES ('LQ-T-X',?,1,0.1,11,100,10,5,55,65,'issued',?,NOW())", [$A, $AG]), 'nace como estimación');
q($pdo, 'INSERT INTO settlement_lines (settlement_id,purchase_id,product_base,weight_kg) VALUES (?,?,?,?)', [$S1, $P1, '100.00', '5.000']);
check('línea de liquidación vinculada a la compra', true);
$S2 = settlement($pdo, 'LQ-T-2', $A, null, '100.00', '10.00', '5.000', '55.00', '65.00');
expectFail('la misma compra en dos liquidaciones vigentes (comisión duplicada) rechazado', fn() => q($pdo, 'INSERT INTO settlement_lines (settlement_id,purchase_id,product_base,weight_kg) VALUES (?,?,?,?)', [$S2, $P1, '100.00', '5.000']), 'Duplicate');
expectFail('línea con compra de otro cliente rechazada', fn() => q($pdo, 'INSERT INTO settlement_lines (settlement_id,purchase_id,product_base,weight_kg) VALUES (?,?,?,?)', [$S2, purchase($pdo, $B, $addrB, '222-1', 'OPT-SCU-2026-00009'), '1.00', '1.000']), 'otro cliente');
q($pdo, "UPDATE settlements SET status='void' WHERE id=?", [$S2]);
check('liquidación en estimación anulada (void)', true);
expectFail('emitir como CLIENTE rechazado', fn() => q($pdo, "UPDATE settlements SET status='issued', issued_by=?, issued_at=NOW() WHERE id=?", [$A, $S1]), 'Solo atención');
q($pdo, 'UPDATE settlement_lines SET weight_kg = 4 WHERE settlement_id=?', [$S1]);
expectFail('emitir con peso que no coincide con las líneas rechazado', fn() => q($pdo, "UPDATE settlements SET status='issued', issued_by=?, issued_at=NOW() WHERE id=?", [$AG, $S1]), 'peso facturable');
q($pdo, 'UPDATE settlement_lines SET weight_kg = 5 WHERE settlement_id=?', [$S1]);
q($pdo, "UPDATE settlements SET status='issued', issued_by=?, issued_at=NOW() WHERE id=?", [$AG, $S1]);
check('emisión por personal de atención con sumas coincidentes aceptada', q($pdo, 'SELECT status FROM settlements WHERE id=?', [$S1])->fetchColumn() === 'issued');
expectFail('modificar el total de una liquidación emitida rechazado', fn() => q($pdo, 'UPDATE settlements SET total=1, shipping=1, commission=0, product_base=0 WHERE id=?', [$S1]), 'inmodificable');
expectFail('modificar líneas de una liquidación emitida rechazado', fn() => q($pdo, 'UPDATE settlement_lines SET weight_kg=9 WHERE settlement_id=?', [$S1]), 'inmodificables');
expectFail('borrar una liquidación rechazado', fn() => q($pdo, 'DELETE FROM settlements WHERE id=?', [$S1]), 'no se eliminan');
expectFail('transición issued → estimate rechazada', fn() => q($pdo, "UPDATE settlements SET status='estimate' WHERE id=?", [$S1]), 'no permitida');
q($pdo, "UPDATE settlements SET shipment_id = shipment_id WHERE id=?", [$S1]);

section('6. Pagos: solo personal, sin sobrepago, inmutables');
function pay(PDO $p, int $settlement, string $amount, int $by, string $ref, string $cur = 'USD', ?string $fx = null, ?string $orig = null, ?int $rev = null): int {
    q($p, "INSERT INTO payments (settlement_id,amount,reversal_of_id,currency_original,amount_original,fx_rate,method,branch,received_by,receipt_ref) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [$settlement, $amount, $rev, $cur, $orig ?? $amount, $fx, 'cash', 'Centro', $by, $ref]);
    return id($p);
}
expectFail('un CLIENTE no puede registrar pagos', fn() => pay($pdo, $S1, '65.00', $A, 'R-CUST'), 'Solo atención');
expectFail('personal de almacén (warehouse) no puede registrar pagos', fn() => pay($pdo, $S1, '65.00', $WH, 'R-WH'), 'Solo atención');
expectFail('pago mayor al saldo rechazado', fn() => pay($pdo, $S1, '65.01', $AG, 'R-OVER'), 'excede');
expectFail('pago en UYU sin cotización rechazado', fn() => pay($pdo, $S1, '10.00', $AG, 'R-FX', 'UYU', null, '400.00'));
expectFail('pago en USD con cotización rechazado', fn() => pay($pdo, $S1, '10.00', $AG, 'R-FX2', 'USD', '40.00'));
$pay1 = pay($pdo, $S1, '25.00', $AG, 'R-001');
check('pago parcial de USD 25 → liquidación "partial"', q($pdo, 'SELECT status FROM settlements WHERE id=?', [$S1])->fetchColumn() === 'partial');
$pay2 = pay($pdo, $S1, '40.00', $AG, 'R-002', 'UYU', '40.0000', '1600.00');
check('pago en UYU guarda importe original y cotización', q($pdo, 'SELECT fx_rate FROM payments WHERE id=?', [$pay2])->fetchColumn() == 40);
check('pago completo → liquidación "paid"', q($pdo, 'SELECT status FROM settlements WHERE id=?', [$S1])->fetchColumn() === 'paid');
expectFail('pago sobre una liquidación ya pagada rechazado', fn() => pay($pdo, $S1, '1.00', $AG, 'R-001'), 'no admite pagos');
expectFail('modificar un pago rechazado', fn() => q($pdo, 'UPDATE payments SET amount=1 WHERE id=?', [$pay1]), 'inmutables');
expectFail('borrar un pago rechazado', fn() => q($pdo, 'DELETE FROM payments WHERE id=?', [$pay1]), 'no se eliminan');
expectFail('contrapartida parcial rechazada (debe anular el pago completo)', fn() => pay($pdo, $S1, '-10.00', $AG, 'R-REV0', 'USD', null, null, $pay1), 'anular por completo');
pay($pdo, $S1, '-25.00', $AG, 'R-REV1', 'USD', null, null, $pay1);
check('contrapartida del pago de 25 → vuelve a "partial"', q($pdo, 'SELECT status FROM settlements WHERE id=?', [$S1])->fetchColumn() === 'partial');
expectFail('anular dos veces el mismo pago rechazado', fn() => pay($pdo, $S1, '-25.00', $AG, 'R-REV2', 'USD', null, null, $pay1), 'Duplicate');
pay($pdo, $S1, '25.00', $AD, 'R-003');
check('el administrador puede registrar pagos; saldo cubierto → "paid"', q($pdo, 'SELECT status FROM settlements WHERE id=?', [$S1])->fetchColumn() === 'paid');

section('7. Condición de despacho');
q($pdo, "UPDATE locker_shipments SET status='ready' WHERE id='SH-T-1'");
// K2 (sin peso) pertenece a un envío aparte para no contaminar el caso feliz
expectFail('despachar sin guía del operador rechazado', fn() => q($pdo, "UPDATE locker_shipments SET status='dispatched' WHERE id='SH-T-1'"), 'guía');
shipment($pdo, 'SH-T-3', $A, $addrA);
q($pdo, "INSERT INTO locker_shipment_packages VALUES ('SH-T-3','K2')");
q($pdo, "UPDATE locker_shipments SET status='ready' WHERE id='SH-T-3'");
expectFail('despachar sin liquidación pagada rechazado', fn() => q($pdo, "UPDATE locker_shipments SET status='dispatched', operator_guide='GUIA-123' WHERE id='SH-T-3'"), 'no está pagada');
expectFail('excepción de despacho autorizada por no-administrador rechazada', fn() => q($pdo, "UPDATE locker_shipments SET status='dispatched', operator_guide='GUIA-123', dispatch_override_by=?, dispatch_override_reason='urgencia' WHERE id='SH-T-3'", [$AG]), 'administrador');
q($pdo, "UPDATE locker_shipments SET status='dispatched', operator_guide='GUIA-123' WHERE id='SH-T-1'");
check('envío con liquidación pagada, guía y pesos completos → despachado', q($pdo, "SELECT status FROM locker_shipments WHERE id='SH-T-1'")->fetchColumn() === 'dispatched');
expectFail('quitar paquetes de un envío despachado rechazado', fn() => q($pdo, "DELETE FROM locker_shipment_packages WHERE shipment_id='SH-T-1'"), 'despachado');
expectFail('saltar de despachado a entregado sin pasar por Cuba rechazado', fn() => q($pdo, "UPDATE locker_shipments SET status='delivered' WHERE id='SH-T-1'"), 'no permitida');
q($pdo, "UPDATE locker_shipments SET status='in_cuba' WHERE id='SH-T-1'");
q($pdo, "UPDATE locker_shipments SET status='delivered' WHERE id='SH-T-1'");
check('dispatched → in_cuba → delivered permitido', true);
q($pdo, "UPDATE locker_shipments SET status='dispatched', operator_guide='GUIA-OVR', dispatch_override_by=?, dispatch_override_reason='autorizado por gerencia' WHERE id='SH-T-3'", [$AD]) ;

section('8. Tarifas inmutables y roles');
check('existe una tarifa de referencia sembrada (10% y USD 11/kg)', q($pdo, 'SELECT COUNT(*) FROM tariff_versions WHERE commission_rate=0.1 AND sell_rate_per_kg=11')->fetchColumn() == 1);
expectFail('modificar una tarifa rechazado', fn() => q($pdo, 'UPDATE tariff_versions SET sell_rate_per_kg=1'), 'inmutables');
expectFail('borrar una tarifa rechazado', fn() => q($pdo, 'DELETE FROM tariff_versions'), 'no se eliminan');
expectFail('tarifa creada por un no-administrador rechazada', fn() => q($pdo, "INSERT INTO tariff_versions (commission_rate,sell_rate_per_kg,effective_from,created_by) VALUES (0.1,12,NOW(),?)", [$AG]), 'administrador');
expectFail('comisión fuera de rango rechazada', fn() => q($pdo, "INSERT INTO tariff_versions (commission_rate,sell_rate_per_kg,effective_from,created_by) VALUES (0.9,12,NOW(),?)", [$AD]));
q($pdo, "INSERT INTO tariff_versions (commission_rate,sell_rate_per_kg,effective_from,is_reference,created_by) VALUES (0.1,12,NOW(),0,?)", [$AD]);
check('un administrador crea una nueva versión de tarifa', true);
check('la liquidación emitida conserva la tarifa que se le aplicó (USD 11/kg)', (float) q($pdo, 'SELECT sell_rate_per_kg FROM settlements WHERE id=?', [$S1])->fetchColumn() === 11.0);
expectFail('el historial de estados no se puede borrar', fn() => q($pdo, 'DELETE FROM status_log'), 'no se elimina');
check('el historial registró los cambios de liquidación, envío y compra', (int) q($pdo, "SELECT COUNT(DISTINCT entity) FROM status_log WHERE entity IN ('purchase','settlement','shipment')")->fetchColumn() === 3);

section('9. Concurrencia: dos pagos simultáneos que juntos exceden el saldo');
$S3 = settlement($pdo, 'LQ-T-C', $A, null, '100.00', '10.00', '5.000', '55.00', '65.00');
$PC = purchase($pdo, $A, $addrA, '111-CONC', 'OPT-HAB-2026-00050');
q($pdo, 'INSERT INTO settlement_lines (settlement_id,purchase_id,product_base,weight_kg) VALUES (?,?,?,?)', [$S3, $PC, '100.00', '5.000']);
q($pdo, "UPDATE settlements SET status='issued', issued_by=?, issued_at=NOW() WHERE id=?", [$AG, $S3]);
$pdo->beginTransaction();
pay($pdo, $S3, '40.00', $AG, 'CONC-A');                       // A retiene el bloqueo de la liquidación sin confirmar
$cmd = [PHP_BINARY, __FILE__, '--worker-pay', (string) $S3, '40.00', (string) $AG];
$proc = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, null);
usleep(1500000);
$status = proc_get_status($proc);
check('el segundo pago queda ESPERANDO el bloqueo de la fila (no se cuela)', $status['running'] === true);
$pdo->commit();                                               // A confirma: B continúa y debe ver saldo 25
$out = stream_get_contents($pipes[1]); proc_close($proc);
check('tras confirmar A, el pago concurrente B es rechazado por exceder el saldo', str_starts_with($out, 'FAIL:') && stripos($out, 'excede') !== false);
expectFail('recibo duplicado en la misma sucursal rechazado', fn() => pay($pdo, $S3, '1.00', $AG, 'CONC-A'), 'Duplicate');
check('el total pagado nunca supera la liquidación (USD 40 de 65)', (float) q($pdo, 'SELECT SUM(amount) FROM payments WHERE settlement_id=?', [$S3])->fetchColumn() === 40.0);

section('10. Transacción atómica: un fallo revierte todo');
$before = (int) q($pdo, 'SELECT COUNT(*) FROM purchases')->fetchColumn();
$pdo->beginTransaction();
try {
    $px = purchase($pdo, $A, $addrA, '111-ATOM', 'OPT-HAB-2026-00099');
    item($pdo, $px, 1, '10');
    item($pdo, $px, 0, '10');          // viola CHECK
    $pdo->commit();
} catch (PDOException $e) { $pdo->rollBack(); }
check('compra + productos con un producto inválido: nada queda a medias', (int) q($pdo, 'SELECT COUNT(*) FROM purchases')->fetchColumn() === $before);

echo "\n──────────────────────────────\nPasaron: $pass · Fallaron: $fail\n";
exit($fail === 0 ? 0 : 1);
