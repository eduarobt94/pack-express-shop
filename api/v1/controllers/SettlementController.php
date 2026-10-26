<?php
declare(strict_types=1);

/** Liquidaciones: consulta del cliente (solo las suyas) y emisión/cobro por el personal. */
class SettlementController
{
    private const PUBLIC_COLS = 's.code, s.version, s.commission_rate, s.sell_rate_per_kg, s.product_base, s.commission,
                                 s.weight_billable_kg, s.shipping, s.extra_charges, s.extra_charges_note, s.total, s.status, s.issued_at';

    /** Traduce los errores deliberados de los triggers (SQLSTATE 45000) a respuestas claras. */
    public static function dbError(PDOException $e): never
    {
        $state = $e->errorInfo[0] ?? '';
        if ($state === '45000') Response::error((string) ($e->errorInfo[2] ?? 'Operación no permitida'), 409);
        if ($state === '23000') Response::error('La operación viola una restricción de integridad', 409);
        if ($state === '22003' || $state === '22007' || $state === '22001') Response::error('Valor fuera de rango', 422);
        Logger::error('db_error', ['sqlstate' => $state, 'msg' => $e->getMessage()]);
        Response::error('Error interno del servidor', 500);
    }

    // GET /settlements — el cliente nunca ve estimaciones internas ni las de otros
    public function index(): void
    {
        Response::ok(Database::query(
            "SELECT " . self::PUBLIC_COLS . " FROM settlements s WHERE s.user_id = ? AND s.status <> 'estimate' ORDER BY s.created_at DESC LIMIT 200",
            [authId()]
        ));
    }

    // GET /settlements/{code}
    public function show(string $code): void
    {
        $s = Database::queryOne("SELECT s.id, " . self::PUBLIC_COLS . " FROM settlements s WHERE s.code = ? AND s.user_id = ? AND s.status <> 'estimate'", [$code, authId()]);
        if (!$s) Response::notFound('Liquidación no encontrada');
        $id = (int) $s['id']; unset($s['id']);
        $s['purchases'] = Database::query(
            'SELECT p.code, l.product_base, l.weight_kg FROM settlement_lines l JOIN purchases p ON p.id = l.purchase_id WHERE l.settlement_id = ? ORDER BY p.code', [$id]);
        $s['paid'] = Money::fmt(Money::toCents((string) Database::queryOne('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE settlement_id = ?', [$id])['t']));
        Response::ok($s);
    }

    // POST /staff/settlements {user_id, purchase_codes[], shipment_id?, extra_charges?, extra_charges_note?}
    public function create(): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $in = is_array($in) ? $in : [];
        $v = Validator::make($in, [
            'user_id'            => 'required|int',
            'shipment_id'        => 'max:20|regex:/^[A-Za-z0-9\-]+$/',
            'extra_charges'      => 'regex:/^\d{1,5}(\.\d{1,2})?$/',
            'extra_charges_note' => 'max:255',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $codes = $in['purchase_codes'] ?? null;
        if (!is_array($codes) || !$codes || count($codes) > 50) Response::error('Indicá entre 1 y 50 compras', 422);
        foreach ($codes as $c) if (!is_string($c) || !preg_match('/^OPT-[A-Z]{3}-\d{4}-\d{5}$/', $c)) Response::error('Código de compra inválido', 422);
        $extra = Money::toCents((string) ($v->get('extra_charges') ?? '0'));
        if ($extra > 0 && mb_strlen((string) $v->get('extra_charges_note')) < 5) Response::error('Un cargo extra necesita justificación', 422);

        $tariff = TariffController::current();
        $uid    = (int) $v->get('user_id');
        $year   = (int) date('Y');

        Database::beginTransaction();
        try {
            $ph = implode(',', array_fill(0, count($codes), '?'));
            $purchases = Database::query("SELECT id, code, status FROM purchases WHERE user_id = ? AND code IN ($ph) FOR UPDATE", array_merge([$uid], $codes));
            if (count($purchases) !== count(array_unique($codes))) { Database::rollback(); Response::error('Alguna compra no existe o no pertenece a ese cliente', 422); }

            $lines = []; $baseSum = 0; $kgSum = 0;
            foreach ($purchases as $p) {
                if (!in_array($p['status'], ['accepted', 'partially_received', 'fully_received'], true)) {
                    Database::rollback(); Response::error("La compra {$p['code']} todavía no fue aceptada", 409);
                }
                $base = (int) round((float) Database::queryOne('SELECT COALESCE(SUM(line_amount),0) AS t FROM purchase_items WHERE purchase_id = ?', [(int) $p['id']])['t'] * 100);
                $w    = Database::queryOne('SELECT COALESCE(SUM(weight_kg),0) AS kg, SUM(weight_kg IS NULL) AS missing, COUNT(*) AS n FROM packages WHERE purchase_id = ? AND user_id = ?', [(int) $p['id'], $uid]);
                if ((int) $w['n'] === 0 || (int) $w['missing'] > 0 || (float) $w['kg'] <= 0) {
                    Database::rollback(); Response::error("La compra {$p['code']} no tiene todos sus paquetes recibidos y pesados", 409);
                }
                $kg = Money::scaled((string) $w['kg'], 3);
                $lines[] = [(int) $p['id'], $base, $kg]; $baseSum += $base; $kgSum += $kg;
            }

            $kgStr = intdiv($kgSum, 1000) . '.' . str_pad((string) ($kgSum % 1000), 3, '0', STR_PAD_LEFT);
            $comm  = Money::commission($baseSum, $tariff['commission_rate']);
            $ship  = Money::shipping($kgStr, $tariff['sell_rate_per_kg']);
            $code  = sprintf('LQ-%d-%05d', $year, Database::nextSeq('settlement', $year));

            $sid = (int) Database::insert(
                'INSERT INTO settlements (code, user_id, shipment_id, tariff_version_id, commission_rate, sell_rate_per_kg, product_base,
                                          commission, weight_billable_kg, shipping, extra_charges, extra_charges_note, total)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$code, $uid, $v->get('shipment_id'), (int) $tariff['id'], $tariff['commission_rate'], $tariff['sell_rate_per_kg'],
                 Money::fmt($baseSum), Money::fmt($comm), $kgStr, Money::fmt($ship), Money::fmt($extra), $v->get('extra_charges_note'),
                 Money::fmt($comm + $ship + $extra)]
            );
            foreach ($lines as [$pid, $base, $kg]) {
                Database::execute('INSERT INTO settlement_lines (settlement_id, purchase_id, product_base, weight_kg) VALUES (?,?,?,?)',
                    [$sid, $pid, Money::fmt($base), intdiv($kg, 1000) . '.' . str_pad((string) ($kg % 1000), 3, '0', STR_PAD_LEFT)]);
            }
            // El trigger valida roles, sumas y pesos antes de permitir la emisión
            Database::execute("UPDATE settlements SET status = 'issued', issued_by = ?, issued_at = NOW() WHERE id = ?", [authId(), $sid]);
            Database::commit();
        } catch (PDOException $e) {
            Database::rollback();
            self::dbError($e);
        }

        Logger::audit('settlement_issue', authId(), ['settlement' => $code]);
        Response::created(['code' => $code, 'total' => Money::fmt($comm + $ship + $extra)], 'Liquidación emitida');
    }

    // POST /staff/settlements/{code}/payments
    public function pay(string $code): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $v = Validator::make(is_array($in) ? $in : [], [
            'amount'            => 'required|regex:/^\d{1,7}(\.\d{1,2})?$/',
            'currency_original' => 'required|in:USD,UYU',
            'amount_original'   => 'regex:/^\d{1,9}(\.\d{1,2})?$/',
            'fx_rate'           => 'regex:/^\d{1,6}(\.\d{1,4})?$/',
            'method'            => 'required|in:cash,transfer,card_pos,other',
            'branch'            => 'required|min:2|max:80',
            'receipt_ref'       => 'required|min:3|max:80',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $s = Database::queryOne('SELECT id FROM settlements WHERE code = ?', [$code]);
        if (!$s) Response::notFound('Liquidación no encontrada');
        $usd = $v->get('currency_original') === 'USD';
        if (!$usd && (!$v->get('amount_original') || !$v->get('fx_rate'))) Response::error('Pagos en UYU requieren importe original y cotización', 422);

        try {
            Database::beginTransaction();
            $id = Database::insert(
                'INSERT INTO payments (settlement_id, amount, currency_original, amount_original, fx_rate, method, branch, received_by, receipt_ref)
                 VALUES (?,?,?,?,?,?,?,?,?)',
                [(int) $s['id'], $v->get('amount'), $v->get('currency_original'), $usd ? $v->get('amount') : ($v->get('amount_original') ?? '0'),
                 $usd ? null : $v->get('fx_rate'), $v->get('method'), $v->get('branch'), authId(), $v->get('receipt_ref')]
            );
            Database::commit();
        } catch (PDOException $e) {
            Database::rollback();
            self::dbError($e);
        }

        Logger::audit('payment_register', authId(), ['settlement' => $code, 'payment_id' => (int) $id]);
        $st = Database::queryOne('SELECT status FROM settlements WHERE id = ?', [(int) $s['id']]);
        Response::created(['payment_id' => (int) $id, 'settlement_status' => $st['status']], 'Pago registrado');
    }
}
