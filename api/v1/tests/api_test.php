<?php
declare(strict_types=1);

/**
 * Pruebas de integración y de seguridad de la API contra un servidor PHP real y una base de PRUEBA.
 *
 *   mysql -e "DROP DATABASE IF EXISTS optimus_test; CREATE DATABASE optimus_test CHARACTER SET utf8mb4"
 *   DB_NAME=optimus_test php database/migrate.php up
 *   DB_NAME=optimus_test php api/v1/tests/api_test.php
 *
 * Variables: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME (debe terminar en _test).
 * Levanta dos servidores con `php -S`: uno permisivo en frecuencia (flujos) y otro en modo
 * PRODUCCIÓN con límites reales (HTTPS, HSTS, CORS estricto, rate limiting).
 */

$dbName = getenv('DB_NAME') ?: '';
if (!str_ends_with($dbName, '_test')) { fwrite(STDERR, "Se niega a correr: DB_NAME debe terminar en _test\n"); exit(2); }

$root   = dirname(__DIR__);
$tmp    = sys_get_temp_dir() . '/optimus_api_test_' . bin2hex(random_bytes(4));
mkdir($tmp . '/uploads', 0777, true);
$secret = bin2hex(random_bytes(32));
$encKey = base64_encode(random_bytes(32));

function startServer(int $port, array $extra, string $root): array
{
    $env = array_merge(getenv(), [
        'DB_HOST' => getenv('DB_HOST') ?: '127.0.0.1', 'DB_PORT' => getenv('DB_PORT') ?: '3306',
        'DB_NAME' => getenv('DB_NAME'),
        // API_DB_USER/API_DB_PASS: el servidor puede correr con el usuario de mínimo privilegio (optimus_app)
        'DB_USER' => getenv('API_DB_USER') ?: (getenv('DB_USER') ?: 'root'), 'DB_PASS' => getenv('API_DB_USER') ? (getenv('API_DB_PASS') ?: '') : (getenv('DB_PASS') ?: ''),
    ], $extra);
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root, $root . '/index.php'], [1 => ['file', 'php://stderr', 'w'], 2 => ['file', 'NUL', 'w']], $pipes, $root, $env);
    for ($i = 0; $i < 50; $i++) { $s = @fsockopen('127.0.0.1', $port, $e, $m, 0.2); if ($s) { fclose($s); break; } usleep(100000); }
    return [$proc, "http://127.0.0.1:$port"];
}

$common = ['JWT_SECRET' => $secret, 'DATA_ENC_KEY' => $encKey, 'UPLOAD_DIR' => $tmp . '/uploads', 'UPLOAD_MAX_MB' => '1',
           'CORS_ORIGIN' => 'https://shop.example', 'TERMS_VERSION' => 'v1-test', 'JWT_EXPIRY' => '900'];
[$p1, $BASE] = startServer(8098, $common + ['APP_ENV' => 'testing', 'AUTH_RATE_LIMIT' => '100000', 'RATE_LIMIT_REQUESTS' => '100000'], $root);
[$p2, $PROD] = startServer(8097, $common + ['APP_ENV' => 'production', 'TRUSTED_PROXIES' => '127.0.0.1', 'AUTH_RATE_LIMIT' => '10', 'RATE_LIMIT_REQUESTS' => '1000'], $root);
register_shutdown_function(function () use ($p1, $p2, $tmp) {
    foreach ([$p1, $p2] as $p) { if (is_resource($p)) { proc_terminate($p); proc_close($p); } }
});

$pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', getenv('DB_HOST') ?: '127.0.0.1', getenv('DB_PORT') ?: '3306', $dbName),
    getenv('DB_USER') ?: 'root', getenv('DB_PASS') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$pass = 0; $fail = 0;
function check(string $label, bool $cond, string $extra = ''): void
{
    global $pass, $fail;
    if ($cond) { $pass++; echo "  ✔ $label\n"; } else { $fail++; echo "  ✘ FALLA: $label" . ($extra ? "  [$extra]" : '') . "\n"; }
}
function section(string $t): void { echo "\n$t\n"; }

/** @return array{0:int,1:array,2:mixed,3:string} status, headers(minúsculas), json, raw */
function http(string $base, string $method, string $path, array $o = []): array
{
    $ch = curl_init($base . $path);
    $h  = $o['headers'] ?? [];
    if (!empty($o['token'])) $h[] = 'Authorization: Bearer ' . $o['token'];
    $body = null;
    if (isset($o['json'])) { $body = json_encode($o['json']); $h[] = 'Content-Type: application/json'; }
    if (isset($o['multipart'])) $body = $o['multipart'];
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 30]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $hs = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    $headers = [];
    foreach (explode("\r\n", substr($raw, 0, $hs)) as $line) if (str_contains($line, ':')) { [$k, $v] = explode(':', $line, 2); $headers[strtolower(trim($k))] = trim($v); }
    $b = substr($raw, $hs);
    return [$status, $headers, json_decode($b, true), $b];
}
function q(PDO $p, string $sql, array $a = []): PDOStatement { $s = $p->prepare($sql); $s->execute($a); return $s; }

$run = bin2hex(random_bytes(3));
function newUser(string $base, string $tag, string $role = 'customer'): array
{
    global $run, $pdo;
    $email = "$tag.$run@test.uy";
    [$st, , $j] = http($base, 'POST', '/auth/register', ['json' => ['name' => "Usuario $tag", 'email' => $email, 'password' => 'Clave-Segura-123']]);
    if ($st !== 201) { echo "No se pudo registrar $tag: $st\n"; exit(3); }
    if ($role !== 'customer') q($pdo, 'UPDATE users SET role = ? WHERE email = ?', [$role, $email]);   // el DBA promueve; no existe API para esto
    return ['email' => $email, 'id' => $j['data']['user']['id'], 'token' => $j['data']['token'], 'refresh' => $j['data']['refresh_token'], 'suite' => $j['data']['user']['suite_id'], 'pass' => 'Clave-Segura-123'];
}

$PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
$PNG = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
function upload(string $content, string $name, string $mime): CURLFile
{
    $f = tempnam(sys_get_temp_dir(), 'up'); file_put_contents($f, $content);
    return new CURLFile($f, $mime, $name);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
section('A. Autenticación obligatoria y sesiones (SEC-06, SEC-09, SEC-10)');
$private = [['GET','/user'],['PUT','/user'],['GET','/user/addresses'],['POST','/user/addresses'],['GET','/purchases'],['POST','/purchases'],
            ['GET','/purchases/OPT-HAB-2026-00001'],['GET','/purchases/OPT-HAB-2026-00001/receipt'],['GET','/settlements'],['GET','/locker'],
            ['GET','/locker/packages'],['GET','/locker/shipments'],['GET','/pre-alerts'],['GET','/orders'],['POST','/staff/packages'],
            ['POST','/staff/settlements'],['POST','/admin/tariffs'],['PUT','/user/password']];
$anonOk = true; $leak = [];
foreach ($private as [$m, $path]) { [$st] = http($BASE, $m, $path); if ($st !== 401) { $anonOk = false; $leak[] = "$m $path=$st"; } }
check('todas las rutas privadas responden 401 sin token', $anonOk, implode(', ', $leak));
[$st] = http($BASE, 'GET', '/user?_auth[sub]=1&_auth[id]=1');
check('inyección de contexto de autenticación por query (?_auth[sub]=1) no sirve', $st === 401);

$alice = newUser($BASE, 'alice'); $bob = newUser($BASE, 'bob');
[$st, , $j] = http($BASE, 'POST', '/auth/register', ['json' => ['name' => 'Mal Actor', 'email' => "evil.$run@test.uy", 'password' => 'Clave-Segura-123', 'role' => 'admin', 'status' => 'active', 'token_version' => 99]]);
$evilRole = q($pdo, 'SELECT role FROM users WHERE email = ?', ["evil.$run@test.uy"])->fetchColumn();
check('mass assignment en registro: role=admin enviado por el cliente se ignora (queda customer)', $evilRole === 'customer');
check('el hash de contraseña usa Argon2id/bcrypt (nunca texto plano)', (bool) preg_match('/^\$(argon2id|2y)\$/', (string) q($pdo, 'SELECT password_hash FROM users WHERE id = ?', [$alice['id']])->fetchColumn()));
check('la respuesta de registro no incluye password_hash ni token_version', !str_contains(json_encode($j), 'password_hash') && !str_contains(json_encode($j), 'token_version'));

[$st, , $jw] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => $alice['email'], 'password' => 'incorrecta-123']]);
[$st2, , $jn] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => "noexiste.$run@test.uy", 'password' => 'incorrecta-123']]);
check('login con clave errónea y con usuario inexistente dan EXACTAMENTE la misma respuesta (sin enumeración)', $st === 401 && $st2 === 401 && $jw === $jn);
[$st] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => ["a@b.com"], 'password' => ['x']]]);
check('tipos inválidos (arrays) en login → 422, no error 500', $st === 422);
[$st] = http($BASE, 'POST', '/auth/register', ['json' => ['name' => 'X Y', 'email' => "long.$run@test.uy", 'password' => str_repeat('a', 100)]]);
check('contraseña de más de 72 bytes rechazada (bcrypt la truncaría)', $st === 422);
[$st] = http($BASE, 'POST', '/auth/register', ['json' => ['name' => 'X Y', 'email' => "short.$run@test.uy", 'password' => '1234567']]);
check('contraseña de menos de 8 caracteres rechazada', $st === 422);
[$st] = http($BASE, 'POST', '/auth/register', ['json' => ['name' => 'Otro', 'email' => strtoupper($alice['email']), 'password' => 'Clave-Segura-123']]);
check('email repetido con otras mayúsculas rechazado (409)', $st === 409);

// bloqueo de cuenta tras fallos
$lock = newUser($BASE, 'lock');
for ($i = 0; $i < 5; $i++) http($BASE, 'POST', '/auth/login', ['json' => ['email' => $lock['email'], 'password' => 'mala-clave-1']]);
[$st] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => $lock['email'], 'password' => $lock['pass']]]);
check('tras 5 fallos la cuenta se bloquea: ni la clave correcta entra (401)', $st === 401);
q($pdo, 'UPDATE users SET locked_until = NULL, failed_logins = 0 WHERE id = ?', [$lock['id']]);
[$st] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => $lock['email'], 'password' => $lock['pass']]]);
check('desbloqueada, la clave correcta vuelve a funcionar', $st === 200);

// tokens
[$st, , $j] = http($BASE, 'GET', '/user', ['token' => $alice['token']]);
check('token válido accede a /user', $st === 200 && $j['data']['email'] === $alice['email']);
check('/user no expone password_hash, status ni token_version (minimización)', !array_intersect(['password_hash', 'token_version', 'status', 'failed_logins'], array_keys($j['data'])));
[$h, $pl, $sg] = explode('.', $alice['token']);
$none = rtrim(strtr(base64_encode('{"alg":"none","typ":"JWT"}'), '+/', '-_'), '=') . '.' . $pl . '.';
[$st] = http($BASE, 'GET', '/user', ['token' => $none]);
check('JWT con alg=none rechazado', $st === 401);
[$st] = http($BASE, 'GET', '/user', ['token' => "$h.$pl." . strrev($sg)]);
check('JWT con firma alterada rechazado', $st === 401);
$payload = json_decode(base64_decode(strtr($pl, '-_', '+/')), true); $payload['sub'] = $bob['id'];
$forged = $h . '.' . rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=') . '.' . $sg;
[$st] = http($BASE, 'GET', '/user', ['token' => $forged]);
check('JWT con "sub" cambiado a otro usuario (firma vieja) rechazado', $st === 401);
[$st] = http($BASE, 'GET', '/user', ['token' => $alice['refresh']]);
check('un refresh token no sirve como access token', $st === 401);

// rotación y reutilización de refresh
[$st, , $r1] = http($BASE, 'POST', '/auth/refresh', ['json' => ['refresh_token' => $alice['refresh']]]);
check('refresh rota: devuelve tokens nuevos distintos', $st === 200 && $r1['data']['refresh_token'] !== $alice['refresh']);
[$st] = http($BASE, 'POST', '/auth/refresh', ['json' => ['refresh_token' => $alice['refresh']]]);
check('reutilizar un refresh ya usado es rechazado (401)', $st === 401);
[$st] = http($BASE, 'POST', '/auth/refresh', ['json' => ['refresh_token' => $r1['data']['refresh_token']]]);
check('detectada la reutilización, TODA la familia de sesión queda revocada', $st === 401);
check('en la base solo existe el SHA-256 del refresh token, no el token', q($pdo, 'SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = ?', [$alice['refresh']])->fetchColumn() == 0);
[$st, , $re] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => $alice['email'], 'password' => $alice['pass']]]);
$alice['token'] = $re['data']['token']; $alice['refresh'] = $re['data']['refresh_token'];

// cambio de contraseña invalida sesiones
$cp = newUser($BASE, 'chpass');
[$st] = http($BASE, 'PUT', '/user/password', ['token' => $cp['token'], 'json' => ['current_password' => 'incorrecta-1', 'new_password' => 'Nueva-Clave-456']]);
check('cambio de contraseña con la actual errónea → 401', $st === 401);
[$st] = http($BASE, 'PUT', '/user/password', ['token' => $cp['token'], 'json' => ['current_password' => $cp['pass'], 'new_password' => 'Nueva-Clave-456']]);
check('cambio de contraseña correcto → 200', $st === 200);
[$st] = http($BASE, 'GET', '/user', ['token' => $cp['token']]);
check('el access token anterior al cambio de contraseña queda invalidado de inmediato', $st === 401);
[$st] = http($BASE, 'POST', '/auth/refresh', ['json' => ['refresh_token' => $cp['refresh']]]);
check('el refresh token anterior al cambio de contraseña queda revocado', $st === 401);
$sus = newUser($BASE, 'susp');
q($pdo, "UPDATE users SET status = 'suspended' WHERE id = ?", [$sus['id']]);
[$st] = http($BASE, 'GET', '/user', ['token' => $sus['token']]);
check('un usuario suspendido pierde el acceso en la siguiente petición (token aún vigente)', $st === 401);

// ════════════════════════════════════════════════════════════════════════════════════════════
section('B. Autorización: IDOR/BOLA, roles y manipulación de campos (SEC-07, SEC-08)');
$addrPayload = ['recipient' => 'Mercedes Pérez', 'id_doc' => '54091205832', 'phone' => '+53 5234 5678', 'province' => 'hab', 'street' => 'Calle 23 #456, Vedado', 'is_default' => true, 'label' => 'Mamá'];
[$st, , $a1] = http($BASE, 'POST', '/user/addresses', ['token' => $alice['token'], 'json' => $addrPayload + ['user_id' => $bob['id']]]);
check('alice crea un destinatario (province normalizada a HAB)', $st === 201 && $a1['data']['province'] === 'HAB');
$aliceAddr = $a1['data']['id'];
check('un user_id enviado en el cuerpo se ignora: el destinatario es de alice', (int) q($pdo, 'SELECT user_id FROM addresses WHERE id = ?', [$aliceAddr])->fetchColumn() === $alice['id']);
$raw = (string) q($pdo, 'SELECT id_doc_enc FROM addresses WHERE id = ?', [$aliceAddr])->fetchColumn();
check('el documento de identidad se guarda CIFRADO (AES-GCM): el texto plano no está en la base', $raw !== '' && !str_contains($raw, '54091205832'));
check('la API devuelve el documento enmascarado y nunca el cifrado', $a1['data']['id_doc'] === '••••••••832' && !isset($a1['data']['id_doc_enc']) && !isset($a1['data']['ci']));
[, , $lb] = http($BASE, 'GET', '/user/addresses', ['token' => $bob['token']]);
check('bob no ve los destinatarios de alice', $lb['data'] === []);
[$st] = http($BASE, 'PUT', "/user/addresses/$aliceAddr", ['token' => $bob['token'], 'json' => $addrPayload]);
check('bob no puede modificar el destinatario de alice (404)', $st === 404);
[$st] = http($BASE, 'DELETE', "/user/addresses/$aliceAddr", ['token' => $bob['token']]);
check('bob no puede borrar el destinatario de alice (404)', $st === 404);
[$st] = http($BASE, 'POST', '/user/addresses', ['token' => $alice['token'], 'json' => ['recipient' => 'X Y', 'province' => "'--", 'street' => 'abc def']]);
check('provincia con inyección SQL rechazada (422)', $st === 422);
[$st] = http($BASE, 'POST', '/user/addresses', ['token' => $alice['token'], 'json' => ['recipient' => 'X Y', 'province' => 'ZZZ', 'street' => 'abc def']]);
check('provincia inexistente rechazada por la FK (422)', $st === 422);
[$st, , $x] = http($BASE, 'PUT', '/user', ['token' => $alice['token'], 'json' => ['name' => 'Alice Nueva', 'role' => 'admin', 'email' => 'otro@x.com', 'status' => 'suspended', 'token_version' => 7]]);
$row = q($pdo, 'SELECT role, email, status, token_version FROM users WHERE id = ?', [$alice['id']])->fetch(PDO::FETCH_ASSOC);
check('mass assignment en PUT /user: role/email/status/token_version no cambian', $st === 200 && $row['role'] === 'customer' && $row['email'] === $alice['email'] && $row['status'] === 'active' && (int) $row['token_version'] === 0);
[$st] = http($BASE, 'POST', '/staff/packages', ['token' => $alice['token'], 'json' => ['tracking_number' => 'ABCDE12345', 'weight' => '2', 'weight_unit' => 'kg']]);
check('un cliente no puede usar rutas de personal (403)', $st === 403);
[$st] = http($BASE, 'POST', '/admin/tariffs', ['token' => $alice['token'], 'json' => ['commission_rate' => '0.05', 'sell_rate_per_kg' => '1']]);
check('un cliente no puede crear tarifas (403)', $st === 403);

// ════════════════════════════════════════════════════════════════════════════════════════════
section('C. Compras y archivos (SEC-14, SEC-15, SEC-16)');
$items = json_encode([['description' => 'Estación de energía', 'url' => 'https://www.amazon.com/dp/B0B2RDFB2L', 'model' => 'DELTA 2', 'qty' => 2, 'unit_price' => '500.00', 'discount' => '50.00']]);
$base = ['recipient_id' => (string) $aliceAddr, 'store' => 'Amazon', 'store_order_number' => '112-' . $run, 'purchased_on' => date('Y-m-d'), 'accept_terms' => '1', 'items' => $items];
[$st, , $pj] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $base + ['receipt' => upload($PDF, 'factura.pdf', 'application/pdf')]]);
$code = $pj['data']['code'] ?? '';
check('compra válida con comprobante PDF → 201 y código OPT-HAB-AAAA-NNNNN', $st === 201 && (bool) preg_match('/^OPT-HAB-\d{4}-\d{5}$/', $code), "$st " . json_encode($pj));
check('el importe de productos lo calcula el servidor: 2×500−50 = 950', (float) ($pj['data']['items'][0]['line_amount'] ?? 0) === 950.0);
check('la respuesta no incluye la ruta interna del comprobante', !str_contains(json_encode($pj), 'receipt_path') && !str_contains(json_encode($pj), $tmp));
$stored = (string) q($pdo, 'SELECT receipt_path FROM purchases WHERE code = ?', [$code])->fetchColumn();
check('el archivo se guardó con nombre aleatorio y extensión derivada del contenido', (bool) preg_match('#^\d{4}/\d{2}/[a-f0-9]{32}\.pdf$#', $stored) && is_file("$tmp/uploads/$stored"));
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $base + ['receipt' => upload($PDF, 'factura.pdf', 'application/pdf')]]);
check('el mismo pedido de tienda registrado dos veces → 409', $st === 409);
$b2 = ['store_order_number' => 'PHP-' . $run] + $base;
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $b2 + ['receipt' => upload("<?php system(\$_GET['c']); ?>", 'recibo.php', 'application/pdf')]]);
check('archivo PHP disfrazado de PDF (MIME falso) rechazado por su contenido real (415)', $st === 415);
$b3 = ['store_order_number' => 'PNG-' . $run] + $base;
[$st, , $pn] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $b3 + ['receipt' => upload($PNG, 'shell.php', 'image/png')]]);
$pngKey = (string) q($pdo, 'SELECT receipt_path FROM purchases WHERE code = ?', [$pn['data']['code'] ?? ''])->fetchColumn();
check('imagen PNG real subida como "shell.php": se guarda como .png, jamás como .php', $st === 201 && str_ends_with($pngKey, '.png') && !glob("$tmp/uploads/*/*/*.php"));
$b4 = ['store_order_number' => 'BIG-' . $run] + $base;
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $b4 + ['receipt' => upload($PDF . str_repeat('A', 1500000), 'grande.pdf', 'application/pdf')]]);
check('archivo de más de 1 MB (límite configurado) rechazado (413)', $st === 413);
$b5 = ['store_order_number' => 'NOR-' . $run] + $base; unset($b5['items']);
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => $b5 + ['items' => '[]', 'receipt' => upload($PDF, 'f.pdf', 'application/pdf')]]);
check('compra sin productos → 422', $st === 422);
foreach ([['qty' => 0, 'unit_price' => '10'], ['qty' => 1, 'unit_price' => '-5'], ['qty' => 1, 'unit_price' => '10', 'discount' => '99'], ['qty' => 1, 'unit_price' => '10.999'], ['qty' => 1, 'unit_price' => '10', 'url' => 'javascript:alert(1)']] as $n => $bad) {
    $bi = json_encode([$bad + ['description' => 'Producto de prueba']]);
    [$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => ['store_order_number' => "BAD$n-$run"] + ['items' => $bi, 'receipt' => upload($PDF, 'f.pdf', 'application/pdf')] + $base]);
    check('producto inválido #' . ($n + 1) . ' (cantidad/precio/descuento/decimales/URL javascript:) → 422', $st === 422);
}
unset($base['accept_terms']);
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => ['store_order_number' => "NOACC2-$run"] + $base + ['receipt' => upload($PDF, 'f.pdf', 'application/pdf')]]);
check('sin aceptar las condiciones no se registra la compra (422)', $st === 422);
$base['accept_terms'] = '1';
[$st] = http($BASE, 'POST', '/purchases', ['token' => $bob['token'], 'multipart' => ['store_order_number' => "IDOR-$run"] + $base + ['receipt' => upload($PDF, 'f.pdf', 'application/pdf')]]);
check('bob no puede registrar una compra con el destinatario de alice (422)', $st === 422);
[$st] = http($BASE, 'POST', '/purchases', ['token' => $alice['token'], 'multipart' => ['store_order_number' => "TS-$run", 'purchased_on' => date('Y-m-d', time() + 10 * 86400)] + $base + ['receipt' => upload($PDF, 'f.pdf', 'application/pdf')]]);
check('fecha de compra futura → 422', $st === 422);
check('ninguna compra inválida dejó filas huérfanas ni archivos de más', (int) q($pdo, 'SELECT COUNT(*) FROM purchases WHERE user_id = ?', [$alice['id']])->fetchColumn() === 2);

check('el token de autenticación ahora es requerido en la ruta con el código', http($BASE, 'GET', "/purchases/$code")[0] === 401);
[$st, , $sj] = http($BASE, 'GET', "/purchases/$code", ['token' => $alice['token']]);
check('alice ve su compra', $st === 200 && $sj['data']['code'] === $code);
[$st] = http($BASE, 'GET', "/purchases/$code", ['token' => $bob['token']]);
check('bob NO puede ver la compra de alice (404, sin revelar que existe)', $st === 404);
[$st] = http($BASE, 'GET', "/purchases/$code/receipt", ['token' => $bob['token']]);
check('bob NO puede descargar el comprobante de alice', $st === 404);
[$st, $hd, , $body] = http($BASE, 'GET', "/purchases/$code/receipt", ['token' => $alice['token']]);
check('alice descarga su comprobante con nosniff y como adjunto', $st === 200 && str_starts_with($body, '%PDF-') && $hd['x-content-type-options'] === 'nosniff' && str_contains($hd['content-disposition'] ?? '', 'attachment'));
[, , $lst] = http($BASE, 'GET', '/purchases', ['token' => $bob['token']]);
check('el listado de bob no contiene compras de alice', $lst['data'] === []);
[$st] = http($BASE, 'GET', "/purchases/" . rawurlencode("' OR '1'='1"), ['token' => $alice['token']]);
check('inyección SQL en el parámetro de ruta → 404 (consulta parametrizada)', $st === 404);
[$st, , $lk] = http($BASE, 'GET', "/locker/packages?status=" . rawurlencode("ready' OR '1'='1"), ['token' => $alice['token']]);
check('inyección SQL en el filtro status se ignora (lista blanca)', $st === 200 && $lk['data'] === []);
http($BASE, 'POST', '/user/addresses', ['token' => $alice['token'], 'json' => ['recipient' => '<script>alert(1)</script>Juana', 'province' => 'SCU', 'street' => '<img src=x onerror=alert(1)>Calle 5 entre A y B']]);
[, , $la] = http($BASE, 'GET', '/user/addresses', ['token' => $alice['token']]);
check('XSS: las etiquetas HTML en datos de texto se eliminan al guardar', !str_contains(json_encode($la), '<script') && !str_contains(json_encode($la), 'onerror'));
[, $hd] = http($BASE, 'GET', '/user', ['token' => $alice['token']]);
check('respuestas JSON con nosniff, CSP restrictiva, sin X-Powered-By y sin caché', $hd['x-content-type-options'] === 'nosniff' && str_contains($hd['content-security-policy'], "default-src 'none'") && !isset($hd['x-powered-by']) && ($hd['cache-control'] ?? '') === 'no-store' && str_contains($hd['content-type'], 'application/json'));
check('X-Frame-Options DENY y frame-ancestors none', $hd['x-frame-options'] === 'DENY' && str_contains($hd['content-security-policy'], "frame-ancestors 'none'"));

// ════════════════════════════════════════════════════════════════════════════════════════════
section('D. Flujo de negocio: recepción → liquidación → pago (integración)');
$wh = newUser($BASE, 'wh', 'warehouse'); $ag = newUser($BASE, 'agent', 'agent'); $ad = newUser($BASE, 'admin', 'admin');
[$st] = http($BASE, 'POST', '/staff/settlements', ['token' => $wh['token'], 'json' => ['user_id' => $alice['id'], 'purchase_codes' => [$code]]]);
check('almacén no puede emitir liquidaciones (403)', $st === 403);
[$st] = http($BASE, 'POST', '/staff/packages', ['token' => $wh['token'], 'json' => ['tracking_number' => 'TRK-ALICE-1', 'customer_code' => $alice['suite'], 'purchase_code' => $code, 'weight' => '11', 'weight_unit' => 'lb', 'condition' => 'Caja en buen estado']]);
check('almacén registra un paquete identificado pesado en libras', $st === 201);
$kg = (string) q($pdo, 'SELECT weight_kg FROM packages WHERE tracking_number = ?', ['TRK-ALICE-1'])->fetchColumn();
$orig = q($pdo, 'SELECT weight_original, weight_unit FROM packages WHERE tracking_number = ?', ['TRK-ALICE-1'])->fetch(PDO::FETCH_ASSOC);
check('11 lb → 4.990 kg; el dato original (11 lb) se conserva', $kg === '4.990' && (float) $orig['weight_original'] === 11.0 && $orig['weight_unit'] === 'lb');
[$st] = http($BASE, 'POST', '/staff/packages', ['token' => $wh['token'], 'json' => ['tracking_number' => 'TRK-NOBODY-9', 'weight' => '3', 'weight_unit' => 'kg']]);
check('paquete sin cliente queda NO IDENTIFICADO (no se asigna por suposición)', $st === 201 && q($pdo, "SELECT status FROM packages WHERE tracking_number='TRK-NOBODY-9'")->fetchColumn() === 'unidentified');
[$st] = http($BASE, 'POST', '/staff/packages', ['token' => $wh['token'], 'json' => ['tracking_number' => 'TRK-ZERO-0', 'weight' => '0', 'weight_unit' => 'kg']]);
check('peso cero rechazado', $st === 422);
[$st] = http($BASE, 'POST', '/staff/packages', ['token' => $wh['token'], 'json' => ['tracking_number' => 'TRK-BOB-1', 'customer_code' => $bob['suite'], 'purchase_code' => $code, 'weight' => '2', 'weight_unit' => 'kg']]);
check('vincular un paquete de bob a la compra de alice → 422', $st === 422);
[$st] = http($BASE, 'POST', '/staff/settlements', ['token' => $ag['token'], 'json' => ['user_id' => $alice['id'], 'purchase_codes' => [$code]]]);
check('no se liquida una compra todavía no aceptada (409)', $st === 409);
[$st] = http($BASE, 'POST', "/staff/purchases/$code/status", ['token' => $ag['token'], 'json' => ['status' => 'fully_received']]);
check('transición de estado inválida registered → fully_received rechazada por la base (409)', $st === 409);
http($BASE, 'POST', "/staff/purchases/$code/status", ['token' => $ag['token'], 'json' => ['status' => 'accepted']]);
[$st, , $sl] = http($BASE, 'POST', '/staff/settlements', ['token' => $ag['token'], 'json' => ['user_id' => $alice['id'], 'purchase_codes' => [$code]]]);
// base 950.00 → comisión 95.00; 4.990 kg × 11 = 54.89 ; total 149.89
check('liquidación emitida: comisión 10% de 950 = 95.00 + 4.990 kg × 11 = 54.89 → USD 149.89', $st === 201 && $sl['data']['total'] === '149.89', json_encode($sl));
$sCode = $sl['data']['code'] ?? '';
[$st] = http($BASE, 'POST', '/staff/settlements', ['token' => $ag['token'], 'json' => ['user_id' => $alice['id'], 'purchase_codes' => [$code]]]);
check('la misma compra no entra en una segunda liquidación vigente (sin duplicar comisión)', $st === 409);
[$st, , $mine] = http($BASE, 'GET', "/settlements/$sCode", ['token' => $alice['token']]);
check('alice ve su liquidación; sin campos internos (issued_by, tariff_version_id, costos)', $st === 200 && !array_intersect(['issued_by', 'tariff_version_id', 'user_id', 'id'], array_keys($mine['data'])));
[$st] = http($BASE, 'GET', "/settlements/$sCode", ['token' => $bob['token']]);
check('bob NO ve la liquidación de alice (404)', $st === 404);
[, , $bl] = http($BASE, 'GET', '/settlements', ['token' => $bob['token']]);
check('el listado de liquidaciones de bob está vacío', $bl['data'] === []);
$pay = ['amount' => '100.00', 'currency_original' => 'USD', 'method' => 'cash', 'branch' => 'Centro', 'receipt_ref' => 'R-' . $run . '-1'];
[$st] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $alice['token'], 'json' => $pay]);
check('el CLIENTE no puede registrar/confirmar un pago (403)', $st === 403);
[$st] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $wh['token'], 'json' => $pay]);
check('personal de almacén no puede registrar pagos (403)', $st === 403);
[$st, , $pp] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $ag['token'], 'json' => $pay]);
check('pago parcial de USD 100 → liquidación "partial"', $st === 201 && $pp['data']['settlement_status'] === 'partial');
[$st] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $ag['token'], 'json' => ['receipt_ref' => 'R-' . $run . '-2'] + ['amount' => '49.90'] + $pay]);
check('pago que excede el saldo (49.90 > 49.89) rechazado (409)', $st === 409);
[$st, , $pp] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $ag['token'], 'json' => ['receipt_ref' => 'R-' . $run . '-3', 'amount' => '49.89'] + $pay]);
check('saldo exacto 49.89 → liquidación "paid"', $st === 201 && $pp['data']['settlement_status'] === 'paid');
[$st, , $fin] = http($BASE, 'GET', "/settlements/$sCode", ['token' => $alice['token']]);
check('el cliente ve la liquidación pagada: total 149.89, pagado 149.89', $fin['data']['status'] === 'paid' && $fin['data']['paid'] === '149.89');
[$st] = http($BASE, 'POST', "/staff/settlements/$sCode/payments", ['token' => $ag['token'], 'json' => ['currency_original' => 'UYU'] + $pay]);
check('pago en UYU sin cotización ni importe original → 422', $st === 422);

// tarifas
[$st, , $t] = http($BASE, 'GET', '/tariffs/current');
check('la tarifa vigente es pública y no expone costos internos', $st === 200 && !array_intersect(['transport_per_lb', 'packaging', 'delivery', 'margin'], array_keys($t['data'])));
[, , $qt] = http($BASE, 'POST', '/quote', ['json' => ['value' => '100', 'weight_kg' => '5']]);
check('calculadora: USD 100 y 5 kg → comisión 10.00 + envío 55.00 = 65.00 (caso de aceptación)', $qt['data']['optimus_total'] === '65.00' && $qt['data']['customs_included'] === false);
[, , $qn] = http($BASE, 'POST', '/quote', ['json' => ['value' => '100']]);
check('sin peso no se inventa un total: needs_quote=true y total nulo', $qn['data']['needs_quote'] === true && $qn['data']['optimus_total'] === null);
[$st] = http($BASE, 'POST', '/quote', ['json' => ['value' => '100', 'weight_kg' => '-1']]);
check('peso negativo en la calculadora → 422', $st === 422);
[$st] = http($BASE, 'POST', '/admin/tariffs', ['token' => $ag['token'], 'json' => ['commission_rate' => '0.0500', 'sell_rate_per_kg' => '99']]);
check('un agente no puede crear tarifas (solo administrador) → 403', $st === 403);
[$st] = http($BASE, 'POST', '/admin/tariffs', ['token' => $ad['token'], 'json' => ['commission_rate' => '0.9', 'sell_rate_per_kg' => '12']]);
check('comisión fuera de rango (90%) rechazada', $st === 422);
[$st] = http($BASE, 'POST', '/admin/tariffs', ['token' => $ad['token'], 'json' => ['commission_rate' => '0.1000', 'sell_rate_per_kg' => '12.00', 'notes' => 'prueba']]);
check('el administrador crea una nueva versión de tarifa', $st === 201);
[, , $fin2] = http($BASE, 'GET', "/settlements/$sCode", ['token' => $alice['token']]);
check('la liquidación ya emitida conserva su tarifa (USD 11/kg) tras el cambio', $fin2['data']['sell_rate_per_kg'] === '11.00' && $fin2['data']['total'] === '149.89');

// modelo anterior
[$st] = http($BASE, 'POST', '/orders', ['token' => $alice['token'], 'json' => ['address_id' => $aliceAddr, 'method' => 'standard', 'items' => [['product_id' => 'x', 'name' => 'x', 'qty' => 1, 'unit_price' => 0.01]]]]);
check('POST /orders (precio enviado por el cliente) deshabilitado → 410', $st === 410);
[$st] = http($BASE, 'POST', '/pre-alerts', ['token' => $alice['token'], 'json' => []]);
check('POST /pre-alerts (subida con extensión del cliente) deshabilitado → 410', $st === 410);

// ════════════════════════════════════════════════════════════════════════════════════════════
section('E. Producción: HTTPS, HSTS, CORS y rate limiting (SEC-11, SEC-12, SEC-18, SEC-19)');
[$st] = http($PROD, 'GET', '/tariffs/current');
check('en producción una petición HTTP directa se rechaza (426)', $st === 426);
[$st, $hd] = http($PROD, 'GET', '/tariffs/current', ['headers' => ['X-Forwarded-Proto: https']]);
check('detrás de un proxy de confianza con X-Forwarded-Proto: https → 200 y HSTS de 1 año', $st === 200 && str_contains($hd['strict-transport-security'] ?? '', 'max-age=31536000'));
[, $hd] = http($PROD, 'GET', '/tariffs/current', ['headers' => ['X-Forwarded-Proto: https', 'Origin: https://evil.example']]);
check('CORS: un origen no autorizado no recibe Access-Control-Allow-Origin', !isset($hd['access-control-allow-origin']));
[, $hd] = http($PROD, 'GET', '/tariffs/current', ['headers' => ['X-Forwarded-Proto: https', 'Origin: https://shop.example']]);
check('CORS: el origen configurado se admite con coincidencia exacta (sin comodín)', ($hd['access-control-allow-origin'] ?? '') === 'https://shop.example' && ($hd['access-control-allow-origin'] ?? '') !== '*');
[, $hd] = http($PROD, 'GET', '/tariffs/current', ['headers' => ['X-Forwarded-Proto: https', 'Origin: https://shop.example.evil.com']]);
check('CORS: un dominio que solo CONTIENE el origen permitido es rechazado', !isset($hd['access-control-allow-origin']));
[, $hd] = http($BASE, 'GET', '/tariffs/current', ['headers' => ['Origin: http://localhost:5173']]);
check('desarrollo/testing: localhost permitido; nunca se refleja un origen arbitrario', ($hd['access-control-allow-origin'] ?? '') === 'http://localhost:5173');
[, $hd] = http($BASE, 'GET', '/tariffs/current', ['headers' => ['Origin: https://evil.example']]);
check('desarrollo/testing: un origen ajeno tampoco se refleja', !isset($hd['access-control-allow-origin']));
[$st, , $ep] = http($PROD, 'POST', '/auth/login', ['headers' => ['X-Forwarded-Proto: https'], 'json' => ['email' => 'x']]);
check('producción: errores sin detalles internos', !str_contains((string) json_encode($ep), 'Stack') && !str_contains((string) json_encode($ep), '.php'));

$hdrs = ['X-Forwarded-Proto: https', 'X-Forwarded-For: 203.0.113.' . random_int(1, 200)];
$codes = [];
for ($i = 0; $i < 25; $i++) { [$st, $hd] = http($PROD, 'POST', '/auth/login', ['headers' => $hdrs, 'json' => ['email' => "nadie$i.$run@test.uy", 'password' => 'x-clave-123']]); $codes[] = $st; if ($st === 429) break; }   // ventana fija: puede cruzar el minuto, por eso hasta 25 intentos
check('rate limiting: tras 10 intentos/min a /auth/login llega el 429 con Retry-After', in_array(429, $codes, true) && $codes[0] === 401 && isset($hd['retry-after']), implode(',', $codes));
[$st] = http($PROD, 'GET', '/tariffs/current', ['headers' => $hdrs]);
check('el límite de /auth/login no bloquea otros endpoints de la misma IP (límite por endpoint)', $st === 200);
$hdrs2 = ['X-Forwarded-Proto: https', 'X-Forwarded-For: 198.51.100.' . random_int(1, 200)];
[$st] = http($PROD, 'POST', '/auth/login', ['headers' => $hdrs2, 'json' => ['email' => "nadie.$run@test.uy", 'password' => 'x-clave-123']]);
check('otra IP no hereda el bloqueo (el límite es por IP)', $st === 401);
$fresh = newUser($BASE, 'rl');
$cs = [];
for ($i = 0; $i < 10; $i++) { [$st] = http($BASE, 'POST', '/auth/login', ['json' => ['email' => $fresh['email'], 'password' => 'incorrecta-1' . $i]]); $cs[] = $st; }
check('límite por CUENTA: ráfaga contra una misma cuenta termina en 429 aunque cambie la IP/ventana global', in_array(429, $cs, true), implode(',', $cs));
// X-Forwarded-For falsificado por un cliente que NO es proxy de confianza no cambia la IP medida
[$p3, $OPEN] = startServer(8096, $common + ['APP_ENV' => 'testing', 'AUTH_RATE_LIMIT' => '5', 'RATE_LIMIT_REQUESTS' => '1000'], $root);
$spoof = [];
for ($i = 0; $i < 9; $i++) { [$st] = http($OPEN, 'POST', '/auth/login', ['headers' => ['X-Forwarded-For: 10.9.9.' . $i], 'json' => ['email' => "spoof$i.$run@test.uy", 'password' => 'x-clave-123']]); $spoof[] = $st; }
check('rotar X-Forwarded-For para evadir el límite NO funciona fuera de TRUSTED_PROXIES', in_array(429, $spoof, true), implode(',', $spoof));
if (is_resource($p3)) { proc_terminate($p3); proc_close($p3); }

echo "\n──────────────────────────────\nPasaron: $pass · Fallaron: $fail\n";
exit($fail === 0 ? 0 : 1);
