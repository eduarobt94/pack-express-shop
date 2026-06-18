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
require_once __DIR__ . '/middleware/RateLimiter.php';
require_once __DIR__ . '/middleware/AuthMiddleware.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/LockerController.php';
require_once __DIR__ . '/controllers/PreAlertController.php';
require_once __DIR__ . '/controllers/OrderController.php';

// ─── Error handling ───────────────────────────────────────────────────────────

set_exception_handler(function (Throwable $e) {
    Logger::error($e->getMessage(), ['file' => $e->getFile(), 'line' => $e->getLine()]);
    $message = isProduction() ? 'Error interno del servidor' : $e->getMessage();
    Response::error($message, 500);
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = env('CORS_ORIGIN', 'http://localhost:5173');

if ($origin === $allowed || !isProduction()) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Security headers ─────────────────────────────────────────────────────────

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Content-Type: application/json; charset=utf-8');

// ─── Routes ───────────────────────────────────────────────────────────────────

$router = new Router();

// Auth (rate-limited, no JWT required)
$router->post('/auth/login',          [AuthController::class, 'login'],          [RateLimiter::class]);
$router->post('/auth/register',       [AuthController::class, 'register'],       [RateLimiter::class]);
$router->post('/auth/refresh',        [AuthController::class, 'refresh'],        [RateLimiter::class]);
$router->post('/auth/forgot-password',[AuthController::class, 'forgotPassword'], [RateLimiter::class]);
$router->post('/auth/reset-password', [AuthController::class, 'resetPassword'],  [RateLimiter::class]);

// User (JWT required)
$router->get   ('/user',                  [UserController::class, 'profile'],       [RateLimiter::class, AuthMiddleware::class]);
$router->put   ('/user',                  [UserController::class, 'update'],        [RateLimiter::class, AuthMiddleware::class]);
$router->put   ('/user/password',         [UserController::class, 'changePassword'],[RateLimiter::class, AuthMiddleware::class]);
$router->get   ('/user/addresses',        [UserController::class, 'addresses'],     [RateLimiter::class, AuthMiddleware::class]);
$router->post  ('/user/addresses',        [UserController::class, 'createAddress'], [RateLimiter::class, AuthMiddleware::class]);
$router->put   ('/user/addresses/{id}',   [UserController::class, 'updateAddress'], [RateLimiter::class, AuthMiddleware::class]);
$router->delete('/user/addresses/{id}',   [UserController::class, 'deleteAddress'], [RateLimiter::class, AuthMiddleware::class]);

// Locker (JWT required)
$router->get('/locker',                   [LockerController::class, 'index'],         [RateLimiter::class, AuthMiddleware::class]);
$router->get('/locker/packages',          [LockerController::class, 'packages'],      [RateLimiter::class, AuthMiddleware::class]);
$router->get('/locker/packages/{id}',     [LockerController::class, 'packageDetail'], [RateLimiter::class, AuthMiddleware::class]);
$router->get('/locker/shipments',         [LockerController::class, 'shipments'],     [RateLimiter::class, AuthMiddleware::class]);
$router->get('/locker/shipments/{id}',    [LockerController::class, 'shipmentDetail'],[RateLimiter::class, AuthMiddleware::class]);

// Pre-alerts (JWT required)
$router->get   ('/pre-alerts',     [PreAlertController::class, 'index'],  [RateLimiter::class, AuthMiddleware::class]);
$router->post  ('/pre-alerts',     [PreAlertController::class, 'create'], [RateLimiter::class, AuthMiddleware::class]);
$router->delete('/pre-alerts/{id}',[PreAlertController::class, 'cancel'], [RateLimiter::class, AuthMiddleware::class]);

// Orders (JWT required)
$router->get ('/orders',     [OrderController::class, 'index'],  [RateLimiter::class, AuthMiddleware::class]);
$router->get ('/orders/{id}',[OrderController::class, 'show'],   [RateLimiter::class, AuthMiddleware::class]);
$router->post('/orders',     [OrderController::class, 'create'], [RateLimiter::class, AuthMiddleware::class]);

// ─── Dispatch ─────────────────────────────────────────────────────────────────

$router->dispatch();
