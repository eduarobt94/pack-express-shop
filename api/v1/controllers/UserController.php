<?php
declare(strict_types=1);

class UserController
{
    private function input(): array
    {
        $d = json_decode(file_get_contents('php://input'), true);
        return is_array($d) ? $d : [];
    }

    /** Respuesta mínima de un destinatario: el documento se devuelve enmascarado, nunca cifrado ni en claro. */
    private function publicAddress(array $a): array
    {
        $doc = null;
        if (!empty($a['id_doc_enc'])) {
            $plain = Crypto::decrypt($a['id_doc_enc']);
            $doc   = $plain !== null ? str_repeat('•', max(0, strlen($plain) - 3)) . substr($plain, -3) : '••••';
        }
        return [
            'id' => (int) $a['id'], 'label' => $a['label'], 'recipient' => $a['recipient'], 'id_doc' => $doc,
            'phone' => $a['phone'], 'province' => $a['province'], 'province_name' => $a['province_name'] ?? null,
            'municipality' => $a['municipality'], 'street' => $a['street'], 'is_default' => (bool) $a['is_default'],
        ];
    }

    private const ADDR_SELECT = 'SELECT a.id, a.label, a.recipient, a.id_doc_enc, a.phone, a.province, p.name AS province_name,
                                        a.municipality, a.street, a.is_default
                                   FROM addresses a JOIN provinces p ON p.code = a.province';

    // GET /user
    public function profile(): void
    {
        $user = Database::queryOne(
            'SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, s.suite_id, s.country, s.member_since
               FROM users u LEFT JOIN suites s ON s.user_id = u.id WHERE u.id = ?',
            [authId()]
        );
        if (!$user) Response::notFound('Usuario no encontrado');
        Response::ok($user);
    }

    // PUT /user — lista blanca de campos: name y phone (no se acepta role, status, email, etc.)
    public function update(): void
    {
        $v = Validator::make($this->input(), ['name' => 'required|min:2|max:120', 'phone' => 'max:30']);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        Database::execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [$v->get('name'), $v->get('phone'), authId()]);
        Logger::audit('profile_update', authId());
        Response::ok(null, 'Perfil actualizado');
    }

    // PUT /user/password — cierra todas las demás sesiones
    public function changePassword(): void
    {
        $v = Validator::make($this->input(), [
            'current_password' => 'required|bytes_max:72',
            'new_password'     => 'required|min:8|bytes_max:72',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $user = Database::queryOne('SELECT password_hash FROM users WHERE id = ?', [authId()]);
        if (!password_verify((string) $v->get('current_password'), $user['password_hash'])) {
            Response::error('La contraseña actual es incorrecta', 401);
        }

        Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [Passwords::hash((string) $v->get('new_password')), authId()]);
        Sessions::revokeAll(authId());
        Logger::audit('password_change', authId());
        Response::ok(null, 'Contraseña actualizada. Volvé a iniciar sesión.');
    }

    // GET /user/addresses
    public function addresses(): void
    {
        $rows = Database::query(self::ADDR_SELECT . ' WHERE a.user_id = ? ORDER BY a.is_default DESC, a.id ASC', [authId()]);
        Response::ok(array_map([$this, 'publicAddress'], $rows));
    }

    private function addressRules(): array
    {
        return [
            'label'        => 'max:100',
            'recipient'    => 'required|min:2|max:120',
            'id_doc'       => 'max:30|regex:/^[A-Za-z0-9\-\.]*$/',
            'phone'        => 'max:30',
            'province'     => 'required|regex:/^[A-Za-z]{3}$/',
            'municipality' => 'max:80',
            'street'       => 'required|min:3|max:300',
        ];
    }

    private function encDoc(?string $doc): ?string
    {
        return ($doc === null || $doc === '') ? null : Crypto::encrypt($doc);
    }

    // POST /user/addresses
    public function createAddress(): void
    {
        $input = $this->input();
        $v = Validator::make($input, $this->addressRules());
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $isDefault = !empty($input['is_default']) ? 1 : 0;

        Database::beginTransaction();
        try {
            if ($isDefault) Database::execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [authId()]);
            $id = Database::insert(
                'INSERT INTO addresses (user_id, label, recipient, id_doc_enc, phone, province, municipality, street, is_default)
                 VALUES (?,?,?,?,?,?,?,?,?)',
                [authId(), $v->get('label'), $v->get('recipient'), $this->encDoc($v->get('id_doc')), $v->get('phone'),
                 strtoupper((string) $v->get('province')), $v->get('municipality'), $v->get('street'), $isDefault]
            );
            Database::commit();
        } catch (PDOException $e) {
            Database::rollback();
            if (str_contains($e->getMessage(), 'fk_addresses_province')) Response::error('Provincia inválida', 422);
            Logger::error('Create address failed', ['error' => $e->getMessage()]);
            Response::error('Error al guardar dirección', 500);
        }

        Response::created($this->publicAddress(Database::queryOne(self::ADDR_SELECT . ' WHERE a.id = ?', [$id])), 'Dirección guardada');
    }

    // PUT /user/addresses/{id}
    public function updateAddress(string $id): void
    {
        $this->ensureOwnsAddress((int) $id);
        $input = $this->input();
        $v = Validator::make($input, $this->addressRules());
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $isDefault = !empty($input['is_default']) ? 1 : 0;

        Database::beginTransaction();
        try {
            if ($isDefault) Database::execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [authId()]);
            // El documento solo se reemplaza si se envía; omitirlo conserva el cifrado existente.
            $docSql = array_key_exists('id_doc', $input) ? ', id_doc_enc = ?' : '';
            $params = [$v->get('label'), $v->get('recipient'), $v->get('phone'), strtoupper((string) $v->get('province')),
                       $v->get('municipality'), $v->get('street'), $isDefault];
            if ($docSql) $params[] = $this->encDoc($v->get('id_doc'));
            $params[] = (int) $id; $params[] = authId();
            Database::execute(
                "UPDATE addresses SET label=?, recipient=?, phone=?, province=?, municipality=?, street=?, is_default=? $docSql
                  WHERE id = ? AND user_id = ?",
                $params
            );
            Database::commit();
        } catch (PDOException $e) {
            Database::rollback();
            if (str_contains($e->getMessage(), 'fk_addresses_province')) Response::error('Provincia inválida', 422);
            Response::error('Error al actualizar dirección', 500);
        }
        Response::ok(null, 'Dirección actualizada');
    }

    // DELETE /user/addresses/{id}
    public function deleteAddress(string $id): void
    {
        $this->ensureOwnsAddress((int) $id);
        try {
            Database::execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [(int) $id, authId()]);
        } catch (PDOException $e) {
            // RESTRICT: el destinatario ya está en una compra o envío y no puede borrarse.
            Response::error('El destinatario tiene compras o envíos asociados y no se puede eliminar', 409);
        }
        Logger::audit('delete_address', authId(), ['address_id' => (int) $id]);
        Response::ok(null, 'Dirección eliminada');
    }

    private function ensureOwnsAddress(int $id): void
    {
        if (!Database::queryOne('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [$id, authId()])) {
            Response::notFound('Dirección no encontrada');
        }
    }
}
