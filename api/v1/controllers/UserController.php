<?php
declare(strict_types=1);

class UserController
{
    private function input(): array
    {
        return (array) json_decode(file_get_contents('php://input'), true);
    }

    // GET /user
    public function profile(): void
    {
        $user = Database::queryOne(
            'SELECT u.id, u.name, u.email, u.phone, u.tier, u.status, u.created_at,
                    s.suite_id, s.country, s.member_since
             FROM users u
             LEFT JOIN suites s ON s.user_id = u.id
             WHERE u.id = ?',
            [authId()]
        );

        if (!$user) Response::notFound('Usuario no encontrado');

        Response::ok($user);
    }

    // PUT /user
    public function update(): void
    {
        $v = Validator::make($this->input(), [
            'name'  => 'required|min:2|max:120',
            'phone' => 'max:30',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        Database::execute(
            'UPDATE users SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
            [$v->get('name'), $v->get('phone'), authId()]
        );

        Logger::audit('profile_update', authId());
        Response::ok(null, 'Perfil actualizado');
    }

    // PUT /user/password
    public function changePassword(): void
    {
        $v = Validator::make($this->input(), [
            'current_password' => 'required',
            'new_password'     => 'required|min:8|max:72',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $user = Database::queryOne('SELECT password_hash FROM users WHERE id = ?', [authId()]);
        if (!password_verify($v->get('current_password'), $user['password_hash'])) {
            Response::error('La contraseña actual es incorrecta', 401);
        }

        Database::execute(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
            [password_hash($v->get('new_password'), PASSWORD_BCRYPT, ['cost' => 12]), authId()]
        );

        Logger::audit('password_change', authId());
        Response::ok(null, 'Contraseña actualizada');
    }

    // GET /user/addresses
    public function addresses(): void
    {
        $addresses = Database::query(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC',
            [authId()]
        );
        Response::ok($addresses);
    }

    // POST /user/addresses
    public function createAddress(): void
    {
        $v = Validator::make($this->input(), [
            'label'        => 'max:100',
            'recipient'    => 'required|min:2|max:120',
            'ci'           => 'max:20',
            'phone'        => 'max:30',
            'province'     => 'required|max:3',
            'municipality' => 'max:80',
            'street'       => 'required',
            'is_default'   => '',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        Database::beginTransaction();
        try {
            if ($v->get('is_default')) {
                Database::execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [authId()]);
            }

            $id = Database::insert(
                'INSERT INTO addresses (user_id, label, recipient, ci, phone, province, municipality, street, is_default)
                 VALUES (?,?,?,?,?,?,?,?,?)',
                [
                    authId(),
                    $v->get('label'),
                    $v->get('recipient'),
                    $v->get('ci'),
                    $v->get('phone'),
                    strtoupper($v->get('province')),
                    $v->get('municipality'),
                    $v->get('street'),
                    $v->get('is_default') ? 1 : 0,
                ]
            );

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error('Create address failed', ['error' => $e->getMessage()]);
            Response::error('Error al guardar dirección', 500);
        }

        $address = Database::queryOne('SELECT * FROM addresses WHERE id = ?', [$id]);
        Response::created($address, 'Dirección guardada');
    }

    // PUT /user/addresses/{id}
    public function updateAddress(string $id): void
    {
        $this->ensureOwnsAddress((int) $id);

        $v = Validator::make($this->input(), [
            'label'        => 'max:100',
            'recipient'    => 'required|min:2|max:120',
            'ci'           => 'max:20',
            'phone'        => 'max:30',
            'province'     => 'required|max:3',
            'municipality' => 'max:80',
            'street'       => 'required',
            'is_default'   => '',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        Database::beginTransaction();
        try {
            if ($v->get('is_default')) {
                Database::execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [authId()]);
            }
            Database::execute(
                'UPDATE addresses SET label=?, recipient=?, ci=?, phone=?, province=?, municipality=?, street=?, is_default=?
                 WHERE id = ? AND user_id = ?',
                [
                    $v->get('label'), $v->get('recipient'), $v->get('ci'), $v->get('phone'),
                    strtoupper($v->get('province')), $v->get('municipality'), $v->get('street'),
                    $v->get('is_default') ? 1 : 0,
                    (int) $id, authId(),
                ]
            );
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::error('Error al actualizar dirección', 500);
        }

        Response::ok(null, 'Dirección actualizada');
    }

    // DELETE /user/addresses/{id}
    public function deleteAddress(string $id): void
    {
        $this->ensureOwnsAddress((int) $id);
        Database::execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [(int) $id, authId()]);
        Logger::audit('delete_address', authId(), ['address_id' => $id]);
        Response::ok(null, 'Dirección eliminada');
    }

    private function ensureOwnsAddress(int $id): void
    {
        $a = Database::queryOne('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [$id, authId()]);
        if (!$a) Response::notFound('Dirección no encontrada');
    }
}
