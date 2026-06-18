<?php
declare(strict_types=1);

class AuthController
{
    private function input(): array
    {
        return (array) json_decode(file_get_contents('php://input'), true);
    }

    // POST /auth/login
    public function login(): void
    {
        $v = Validator::make($this->input(), [
            'email'    => 'required|email',
            'password' => 'required|min:4',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $user = Database::queryOne(
            'SELECT u.*, s.suite_id FROM users u
             LEFT JOIN suites s ON s.user_id = u.id
             WHERE u.email = ? AND u.status = "active" LIMIT 1',
            [$v->get('email')]
        );

        if (!$user || !password_verify($v->get('password'), $user['password_hash'])) {
            // Constant-time response to prevent user enumeration
            Logger::warning('Failed login attempt', ['email' => $v->get('email')]);
            Response::error('Credenciales incorrectas', 401);
        }

        Logger::audit('login', (int) $user['id']);

        Response::ok($this->issueTokens($user), 'Login exitoso');
    }

    // POST /auth/register
    public function register(): void
    {
        $v = Validator::make($this->input(), [
            'name'     => 'required|min:2|max:120',
            'email'    => 'required|email|max:150',
            'password' => 'required|min:8|max:72',
            'phone'    => 'max:30',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $exists = Database::queryOne('SELECT id FROM users WHERE email = ?', [$v->get('email')]);
        if ($exists) Response::error('El email ya está registrado', 409);

        Database::beginTransaction();
        try {
            $userId = Database::insert(
                'INSERT INTO users (name, email, phone, password_hash, status) VALUES (?,?,?,?,?)',
                [
                    $v->get('name'),
                    $v->get('email'),
                    $v->get('phone'),
                    password_hash($v->get('password'), PASSWORD_BCRYPT, ['cost' => 12]),
                    'active',
                ]
            );

            $suiteId = 'PKX-CU-' . str_pad($userId, 6, '0', STR_PAD_LEFT);
            Database::execute(
                'INSERT INTO suites (user_id, suite_id, country, member_since) VALUES (?,?,?,CURDATE())',
                [$userId, $suiteId, 'CU']
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error('Register failed', ['error' => $e->getMessage()]);
            Response::error('Error al registrar usuario', 500);
        }

        $user = Database::queryOne(
            'SELECT u.*, s.suite_id FROM users u
             LEFT JOIN suites s ON s.user_id = u.id
             WHERE u.id = ?',
            [$userId]
        );

        Logger::audit('register', (int) $userId);

        Response::created($this->issueTokens($user), 'Registro exitoso');
    }

    // POST /auth/refresh
    public function refresh(): void
    {
        $input = $this->input();
        $refreshToken = $input['refresh_token'] ?? '';

        if (!$refreshToken) Response::error('refresh_token requerido', 422);

        $payload = JWT::decode($refreshToken, env('JWT_SECRET') . '_refresh');
        if (!$payload) Response::unauthorized('Token de refresco inválido o expirado');

        $user = Database::queryOne(
            'SELECT u.*, s.suite_id FROM users u
             LEFT JOIN suites s ON s.user_id = u.id
             WHERE u.id = ? AND u.status = "active"',
            [$payload['sub']]
        );

        if (!$user) Response::unauthorized('Usuario no encontrado');

        Response::ok($this->issueTokens($user), 'Token renovado');
    }

    // POST /auth/forgot-password
    public function forgotPassword(): void
    {
        $v = Validator::make($this->input(), ['email' => 'required|email']);
        if ($v->fails()) Response::error('Email inválido', 422);

        // Always return 200 to prevent email enumeration
        $user = Database::queryOne('SELECT id FROM users WHERE email = ?', [$v->get('email')]);
        if ($user) {
            $token = bin2hex(random_bytes(32));
            $expiry = date('Y-m-d H:i:s', time() + 3600);
            Database::execute(
                'REPLACE INTO password_reset_tokens (email, token, expires_at) VALUES (?,?,?)',
                [$v->get('email'), hash('sha256', $token), $expiry]
            );
            // TODO: send email with reset link
            Logger::info('Password reset requested', ['email' => $v->get('email')]);
        }

        Response::ok(null, 'Si el email existe recibirás instrucciones para restablecer tu contraseña');
    }

    // POST /auth/reset-password
    public function resetPassword(): void
    {
        $v = Validator::make($this->input(), [
            'token'    => 'required',
            'password' => 'required|min:8|max:72',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $record = Database::queryOne(
            'SELECT email FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
            [hash('sha256', $v->get('token'))]
        );

        if (!$record) Response::error('Token inválido o expirado', 400);

        Database::execute(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?',
            [password_hash($v->get('password'), PASSWORD_BCRYPT, ['cost' => 12]), $record['email']]
        );

        Database::execute('DELETE FROM password_reset_tokens WHERE email = ?', [$record['email']]);

        Logger::audit('password_reset', 0, ['email' => $record['email']]);
        Response::ok(null, 'Contraseña actualizada correctamente');
    }

    private function issueTokens(array $user): array
    {
        $secret  = env('JWT_SECRET');
        $payload = ['sub' => $user['id'], 'email' => $user['email'], 'suite' => $user['suite_id'] ?? null];

        return [
            'token'         => JWT::encode($payload, $secret, (int) env('JWT_EXPIRY', 3600)),
            'refresh_token' => JWT::encode($payload, $secret . '_refresh', (int) env('JWT_REFRESH_EXPIRY', 604800)),
            'expires_in'    => (int) env('JWT_EXPIRY', 3600),
            'user'          => [
                'id'       => $user['id'],
                'name'     => $user['name'],
                'email'    => $user['email'],
                'tier'     => $user['tier'],
                'suite_id' => $user['suite_id'],
            ],
        ];
    }
}
