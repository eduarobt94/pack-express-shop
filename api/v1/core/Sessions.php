<?php
declare(strict_types=1);

/**
 * Sesiones: access token JWT corto + refresh token OPACO con rotación.
 * - El refresh token se guarda como SHA-256; la base nunca contiene el valor utilizable.
 * - Cada uso lo rota. Si se presenta uno ya usado (robo/replay), se revoca TODA la familia.
 * - Cambiar/restablecer la contraseña incrementa users.token_version (invalida los access tokens)
 *   y revoca los refresh tokens.
 */
final class Sessions
{
    public static function issue(array $user, ?string $familyId = null): array
    {
        $access  = JWT::encode(
            ['sub' => (int) $user['id'], 'ver' => (int) $user['token_version'], 'typ' => 'access'],
            (string) env('JWT_SECRET'),
            (int) env('JWT_EXPIRY', 900)
        );
        $refresh = bin2hex(random_bytes(32));
        $family  = $familyId ?? bin2hex(random_bytes(16));
        $ttl     = (int) env('JWT_REFRESH_EXPIRY', 604800);

        Database::execute(
            'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, created_ip)
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)',
            [(int) $user['id'], hash('sha256', $refresh), $family, $ttl, clientIp()]
        );

        return [
            'token'         => $access,
            'refresh_token' => $refresh,
            'expires_in'    => (int) env('JWT_EXPIRY', 900),
        ];
    }

    /** Valida y rota un refresh token. Devuelve ['user'=>…, 'tokens'=>…] o null. */
    public static function rotate(string $refresh): ?array
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $refresh)) return null;
        $hash = hash('sha256', $refresh);

        Database::beginTransaction();
        try {
            $row = Database::queryOne('SELECT id, user_id, family_id, (expires_at > NOW()) AS still_valid, revoked_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE', [$hash]);
            if (!$row) { Database::rollback(); return null; }

            if ($row['revoked_at'] !== null) {                // reutilización: revoca la familia completa
                Database::execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL', [$row['family_id']]);
                Database::commit();
                Logger::warning('refresh_reuse_detected', ['user_id' => (int) $row['user_id']]);
                return null;
            }
            if ((int) $row['still_valid'] !== 1) { Database::rollback(); return null; }

            $user = Database::queryOne('SELECT id, name, email, role, status, token_version FROM users WHERE id = ?', [(int) $row['user_id']]);
            if (!$user || $user['status'] !== 'active') { Database::rollback(); return null; }

            Database::execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [(int) $row['id']]);
            $tokens = self::issue($user, $row['family_id']);
            Database::commit();
            return ['user' => $user, 'tokens' => $tokens];
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
    }

    public static function revokeFamilyOf(string $refresh): void
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $refresh)) return;
        $row = Database::queryOne('SELECT family_id FROM refresh_tokens WHERE token_hash = ?', [hash('sha256', $refresh)]);
        if ($row) Database::execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL', [$row['family_id']]);
    }

    /** Cierra TODAS las sesiones del usuario (cambio/reseteo de contraseña). */
    public static function revokeAll(int $userId): void
    {
        Database::execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [$userId]);
        Database::execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [$userId]);
    }
}
