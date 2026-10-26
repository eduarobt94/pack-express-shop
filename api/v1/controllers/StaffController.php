<?php
declare(strict_types=1);

/** Operaciones del personal de almacén/atención. Las rutas exigen WarehouseMiddleware (warehouse, agent, admin). */
class StaffController
{
    private const LB_PER_KG = '2.20462262';

    // POST /staff/packages {tracking_number, customer_code?, purchase_code?, weight, weight_unit, condition?}
    // Sin customer_code el paquete queda NO IDENTIFICADO (bandeja de revisión): nunca se asigna por suposición.
    public function receivePackage(): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $v = Validator::make(is_array($in) ? $in : [], [
            'tracking_number' => 'required|min:5|max:100',
            'customer_code'   => 'max:25|regex:/^OPT-[A-Z]{2}-\d{6}$/',
            'purchase_code'   => 'max:25|regex:/^OPT-[A-Z]{3}-\d{4}-\d{5}$/',
            'weight'          => 'required|regex:/^\d{1,4}(\.\d{1,3})?$/|between:0.001,5000',
            'weight_unit'     => 'required|in:kg,lb',
            'condition'       => 'max:255',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $userId = null; $suite = null; $purchaseId = null;
        if ($v->get('customer_code')) {
            $s = Database::queryOne('SELECT user_id, suite_id FROM suites WHERE suite_id = ?', [$v->get('customer_code')]);
            if (!$s) Response::error('Código de cliente inexistente', 422);
            $userId = (int) $s['user_id']; $suite = $s['suite_id'];
        }
        if ($v->get('purchase_code')) {
            if ($userId === null) Response::error('Para vincular una compra hay que identificar al cliente', 422);
            $p = Database::queryOne('SELECT id FROM purchases WHERE code = ? AND user_id = ?', [$v->get('purchase_code'), $userId]);
            if (!$p) Response::error('La compra no existe o no pertenece a ese cliente', 422);
            $purchaseId = (int) $p['id'];
        }

        // Conversión sin perder el dato original: se guarda el peso cargado y la unidad.
        $original = (string) $v->get('weight');
        $kg = $v->get('weight_unit') === 'kg'
            ? $original
            : number_format(round((float) $original / (float) self::LB_PER_KG, 3), 3, '.', '');
        if ((float) $kg <= 0) Response::error('Peso inválido', 422);

        $year = (int) date('Y');
        try {
            $id = sprintf('WR-%d-%05d', $year, Database::nextSeq('package', $year));
            Database::execute(
                'INSERT INTO packages (id, user_id, suite_id, purchase_id, tracking_number, weight_kg, weight_original, weight_unit, observed_condition, status, received_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
                [$id, $userId, $suite, $purchaseId, $v->get('tracking_number'), $kg, $original, $v->get('weight_unit'),
                 $v->get('condition'), $userId === null ? 'unidentified' : 'received_us']
            );
        } catch (PDOException $e) {
            SettlementController::dbError($e);
        }

        Logger::audit('package_receive', authId(), ['package' => $id, 'identified' => $userId !== null]);
        Response::created(['id' => $id, 'weight_kg' => $kg, 'status' => $userId === null ? 'unidentified' : 'received_us'], 'Paquete registrado');
    }

    // GET /staff/packages/unidentified
    public function unidentified(): void
    {
        Response::ok(Database::query(
            "SELECT id, tracking_number, weight_kg, observed_condition, received_at FROM packages WHERE user_id IS NULL ORDER BY received_at DESC LIMIT 200"
        ));
    }

    // POST /staff/purchases/{code}/status {status} — la máquina de estados la hace cumplir la base de datos
    public function setPurchaseStatus(string $code): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $v = Validator::make(is_array($in) ? $in : [], ['status' => 'required|in:in_review,accepted,partially_received,fully_received,cancelled']);
        if ($v->fails()) Response::error('Estado inválido', 422);
        try {
            $n = Database::execute('UPDATE purchases SET status = ? WHERE code = ?', [$v->get('status'), $code]);
        } catch (PDOException $e) {
            SettlementController::dbError($e);
        }
        if (!Database::queryOne('SELECT id FROM purchases WHERE code = ?', [$code])) Response::notFound('Compra no encontrada');
        Logger::audit('purchase_status', authId(), ['purchase' => $code, 'status' => $v->get('status')]);
        Response::ok(null, 'Estado actualizado');
    }
}
