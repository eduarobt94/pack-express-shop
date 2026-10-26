<?php
declare(strict_types=1);

class AuthController
{
    private const MAX_FAILED   = 5;      // intentos fallidos antes de bloquear la cuenta
    private const LOCK_MINUTES = 15;

    private function input(): array
    {
        $d = json_decode(file_get_contents('php://input'), true);
        return is_array($d) ? $d : [];
    }

    private function publicUser(array $u): array
    {
        return ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'suite_id' => $u['suite_id'] ?? null];
    }

    // POST /auth/login
    public function login(): void
    {
        $v = Validator::make($this->input(), [
            'email'    => 'required|email|max:150',
            'password' => 'required|bytes_max:72',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422);

        $email = strtolower((string) $v->get('email'));

        // Límite por cuenta (además del límite por IP del middleware): frena el relleno de credenciales.
        if (!RateLimiter::hit('login-account', $email, 8, 900)) {
            header('Retry-After: 900');
            Response::error('Demasiados intentos. Intentá más tarde.', 429);
        }

        $user = Database::queryOne(
            'SELECT u.id, u.name, u.email, u.role, u.status, u.password_hash, u.token_version,
                    u.failed_logins, (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked, s.suite_id
               FROM users u LEFT JOIN suites s ON s.user_id = u.id
              WHERE u.email = ? LIMIT 1',
            [$email]
        );

        // Se verifica SIEMPRE un hash (real o ficticio): el tiempo no revela si el email existe.
        $hash    = $user['password_hash'] ?? Passwords::dummy();
        $matches = password_verify((string) $v->get('password'), $hash);
        $locked  = $user && (int) $user['is_locked'] === 1;

        if (!$user || !$matches || $user['status'] !== 'active' || $locked) {
            if ($user && !$locked) {
                Database::execute(
                    'UPDATE users SET locked_until = IF(failed_logins + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until),
                            failed_logins = failed_logins + 1
                      WHERE id = ?',
                    [self::MAX_FAILED, self::LOCK_MINUTES, (int) $user['id']]
                );
            }
            Logger::warning('login_failed', ['user_id' => $user['id'] ?? null, 'locked' => (bool) $locked]);
            Response::error('Credenciales incorrectas', 401);     // mismo mensaje en todos los casos
        }

        Database::execute('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [(int) $user['id']]);
        if (Passwords::needsRehash($user['password_hash'])) {
            Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [Passwords::hash((string) $v->get('password')), (int) $user['id']]);
        }

        Logger::audit('login', (int) $user['id']);
        Response::ok(array_merge(Sessions::issue($user), ['user' => $this->publicUser($user)]), 'Login exitoso');
    }

    // POST /auth/register — siempre crea rol "customer": el rol nunca viene del cliente (anti mass-assignment)
    public function register(): void
    {
        $v = Validator::make($this->input(), [
            'name'     => 'required|min:2|max:120',
            'email'    => 'required|email|max:150',
            'password' => 'required|min:8|bytes_max:72',
            'phone'    => 'max:30',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $email = strtolower((string) $v->get('email'));
        if (Database::queryOne('SELECT id FROM users WHERE email = ?', [$email])) {
            Response::error('No se pudo completar el registro con esos datos', 409);
        }

        Database::beginTransaction();
        try {
            $userId = (int) Database::insert(
                'INSERT INTO users (name, email, phone, password_hash, status, role) VALUES (?,?,?,?,?,?)',
                [$v->get('name'), $email, $v->get('phone'), Passwords::hash((string) $v->get('password')), 'active', 'customer']
            );
            // Código personal del cliente (formato definitivo pendiente de Optimus)
            Database::execute(
                'INSERT INTO suites (user_id, suite_id, country, member_since) VALUES (?,?,?,CURDATE())',
                [$userId, 'OPT-UY-' . str_pad((string) $userId, 6, '0', STR_PAD_LEFT), 'UY']
            );
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error('Register failed', ['error' => $e->getMessage()]);
            Response::error('Error al registrar usuario', 500);
        }

        $user = Database::queryOne(
            'SELECT u.id, u.name, u.email, u.role, u.token_version, s.suite_id FROM users u LEFT JOIN suites s ON s.user_id = u.id WHERE u.id = ?',
            [$userId]
        );
        Logger::audit('register', $userId);
        Response::created(array_merge(Sessions::issue($user), ['user' => $this->publicUser($user)]), 'Registro exitoso');
    }

    // POST /auth/refresh — rota el refresh token (el anterior queda inutilizable)
    public function refresh(): void
    {
        $token = (string) ($this->input()['refresh_token'] ?? '');
        if ($token === '') Response::error('refresh_token requerido', 422);

        $res = Sessions::rotate($token);
        if (!$res) Response::unauthorized('Token de refresco inválido o expirado');

        $suite = Database::queryOne('SELECT suite_id FROM suites WHERE user_id = ?', [(int) $res['user']['id']]);
        $user  = array_merge($res['user'], ['suite_id' => $suite['suite_id'] ?? null]);
        Response::ok(array_merge($res['tokens'], ['user' => $this->publicUser($user)]), 'Token renovado');
    }

    // POST /auth/logout — revoca la familia de refresh tokens
    public function logout(): void
    {
        $token = (string) ($this->input()['refresh_token'] ?? '');
        if ($token !== '') Sessions::revokeFamilyOf($token);
        Response::ok(null, 'Sesión cerrada');
    }

    // POST /auth/forgot-password — siempre 200 (sin enumeración de emails)
    public function forgotPassword(): void
    {
        $v = Validator::make($this->input(), ['email' => 'required|email|max:150']);
        if ($v->fails()) Response::error('Datos inválidos', 422);

        $email = strtolower((string) $v->get('email'));
        if (!RateLimiter::hit('forgot-account', $email, 3, 3600)) {
            Response::ok(null, 'Si el email existe recibirás instrucciones para restablecer tu contraseña');
        }

        $user = Database::queryOne('SELECT id FROM users WHERE email = ? AND status = "active"', [$email]);
        if ($user) {
            $token = bin2hex(random_bytes(32));
            Database::execute(
                'REPLACE INTO password_reset_tokens (email, token, expires_at, user_id) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 1 HOUR),?)',
                [$email, hash('sha256', $token), (int) $user['id']]
            );
            // PENDIENTE: enviar el enlace por correo. El token en claro jamás se registra en logs.
            Logger::info('password_reset_requested', ['user_id' => (int) $user['id']]);
        }
        Response::ok(null, 'Si el email existe recibirás instrucciones para restablecer tu contraseña');
    }

    // POST /auth/reset-password
    public function resetPassword(): void
    {
        $v = Validator::make($this->input(), [
            'token'    => 'required|regex:/^[a-f0-9]{64}$/',
            'password' => 'required|min:8|bytes_max:72',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422);

        Database::beginTransaction();
        try {
            $record = Database::queryOne(
                'SELECT email, user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() FOR UPDATE',
                [hash('sha256', (string) $v->get('token'))]
            );
            if (!$record || !$record['user_id']) { Database::rollback(); Response::error('Token inválido o expirado', 400); }

            Database::execute(
                'UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?',
                [Passwords::hash((string) $v->get('password')), (int) $record['user_id']]
            );
            Database::execute('DELETE FROM password_reset_tokens WHERE email = ?', [$record['email']]);
            Sessions::revokeAll((int) $record['user_id']);          // cierra todas las sesiones abiertas
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }

        Logger::audit('password_reset', (int) $record['user_id']);
        Response::ok(null, 'Contraseña actualizada correctamente');
    }
}
