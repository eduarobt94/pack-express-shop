<?php
declare(strict_types=1);

// ─── Bootstrap ───────────────────────────────────────────────────────────────

require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/JWT.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Validator.php';
require_once __DIR__ . '/core/Logger.php';
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Crypto.php';
require_once __DIR__ . '/core/Money.php';
require_once __DIR__ . '/core/Passwords.php';
require_once __DIR__ . '/core/Sessions.php';
require_once __DIR__ . '/core/FileStore.php';
require_once __DIR__ . '/middleware/AuthMiddleware.php';
require_once __DIR__ . '/middleware/RateLimiter.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/LockerController.php';
require_once __DIR__ . '/controllers/PreAlertController.php';
require_once __DIR__ . '/controllers/OrderController.php';
require_once __DIR__ . '/controllers/PurchaseController.php';
require_once __DIR__ . '/controllers/TariffController.php';
require_once __DIR__ . '/controllers/SettlementController.php';
require_once __DIR__ . '/controllers/StaffController.php';

// ─── Cabeceras de seguridad (toda respuesta de la API) ─────────────────────────

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Resource-Policy: same-site');
header('Permissions-Policy: geolocation=(), camera=(), microphone=()');
header('Content-Type: application/json; charset=utf-8');
header_remove('X-Powered-By');

// ─── Errores: nunca se filtran detalles internos fuera de desarrollo ────────────

set_exception_handler(function (Throwable $e) {
    Logger::error($e->getMessage(), ['file' => basename($e->getFile()), 'line' => $e->getLine()]);
    Response::error(isProduction() ? 'Error interno del servidor' : $e->getMessage(), 500);
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

assertSecureConfig();

// ─── HTTPS obligatorio en producción ─────────────────────────────────────────────

if (isProduction()) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    if (!isHttps()) {
        Response::error('HTTPS requerido', 426);
    }
}

// ─── CORS: coincidencia EXACTA de origen; sin comodines ni reflejo ──────────────

$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_filter(array_map('trim', explode(',', (string) env('CORS_ORIGIN', ''))));
// En desarrollo se admite además localhost (cualquier puerto) — nunca en producción.
$devOk   = !isProduction() && (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);

if ($origin !== '' && (in_array($origin, $allowed, true) || $devOk)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 600');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Rutas ─────────────────────────────────────────────────────────────────────────

$router = new Router();

$AUTH  = [AuthRateLimiter::class];
$USER  = [RateLimiter::class, AuthMiddleware::class];
$SENS  = [AuthMiddleware::class, SensitiveRateLimiter::class];
$STAFF = [AuthMiddleware::class, StaffMiddleware::class, SensitiveRateLimiter::class];
$WH    = [AuthMiddleware::class, WarehouseMiddleware::class, SensitiveRateLimiter::class];
$ADMIN = [AuthMiddleware::class, AdminMiddleware::class, SensitiveRateLimiter::class];

// Públicas (con límite de frecuencia)
$router->post('/auth/login',           [AuthController::class, 'login'],          $AUTH);
$router->post('/auth/register',        [AuthController::class, 'register'],       $AUTH);
$router->post('/auth/refresh',         [AuthController::class, 'refresh'],        $AUTH);
$router->post('/auth/logout',          [AuthController::class, 'logout'],         $AUTH);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword'], $AUTH);
$router->post('/auth/reset-password',  [AuthController::class, 'resetPassword'],  $AUTH);
$router->get ('/tariffs/current',      [TariffController::class, 'show'],         [RateLimiter::class]);
$router->post('/quote',                [TariffController::class, 'quote'],        [RateLimiter::class]);

// Cliente (JWT)
$router->get   ('/user',                [UserController::class, 'profile'],        $USER);
$router->put   ('/user',                [UserController::class, 'update'],         $USER);
$router->put   ('/user/password',       [UserController::class, 'changePassword'], $SENS);
$router->get   ('/user/addresses',      [UserController::class, 'addresses'],      $USER);
$router->post  ('/user/addresses',      [UserController::class, 'createAddress'],  $USER);
$router->put   ('/user/addresses/{id}', [UserController::class, 'updateAddress'],  $USER);
$router->delete('/user/addresses/{id}', [UserController::class, 'deleteAddress'],  $USER);

$router->get ('/purchases',                [PurchaseController::class, 'index'],   $USER);
$router->post('/purchases',                [PurchaseController::class, 'create'],  $SENS);
$router->get ('/purchases/{code}',         [PurchaseController::class, 'show'],    $USER);
$router->get ('/purchases/{code}/receipt', [PurchaseController::class, 'receipt'], $USER);
$router->get ('/settlements',              [SettlementController::class, 'index'], $USER);
$router->get ('/settlements/{code}',       [SettlementController::class, 'show'],  $USER);

$router->get('/locker',                [LockerController::class, 'index'],          $USER);
$router->get('/locker/packages',       [LockerController::class, 'packages'],       $USER);
$router->get('/locker/packages/{id}',  [LockerController::class, 'packageDetail'],  $USER);
$router->get('/locker/shipments',      [LockerController::class, 'shipments'],      $USER);
$router->get('/locker/shipments/{id}', [LockerController::class, 'shipmentDetail'], $USER);

// Modelo anterior (obsoleto)
$router->get   ('/pre-alerts',      [PreAlertController::class, 'index'],  $USER);
$router->post  ('/pre-alerts',      [PreAlertController::class, 'create'], $USER);
$router->delete('/pre-alerts/{id}', [PreAlertController::class, 'cancel'], $USER);
$router->get   ('/orders',          [OrderController::class, 'index'],     $USER);
$router->get   ('/orders/{id}',     [OrderController::class, 'show'],      $USER);
$router->post  ('/orders',          [OrderController::class, 'create'],    $USER);

// Personal (rol verificado en la base en cada petición)
$router->post('/staff/packages',                  [StaffController::class, 'receivePackage'],  $WH);
$router->get ('/staff/packages/unidentified',     [StaffController::class, 'unidentified'],    $WH);
$router->post('/staff/settlements',               [SettlementController::class, 'create'],     $STAFF);
$router->post('/staff/settlements/{code}/payments', [SettlementController::class, 'pay'],      $STAFF);
$router->post('/staff/purchases/{code}/status',  [StaffController::class, 'setPurchaseStatus'], $STAFF);
$router->post('/admin/tariffs',                   [TariffController::class, 'create'],         $ADMIN);

// ─── Dispatch ─────────────────────────────────────────────────────────────────────

$router->dispatch();
