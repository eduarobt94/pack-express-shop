<?php
declare(strict_types=1);

/** Tarifas públicas (solo lo que debe ver el cliente) y alta de nuevas versiones (administración). */
class TariffController
{
    public static function current(): array
    {
        $t = Database::queryOne('SELECT id, commission_rate, sell_rate_per_kg, effective_from, is_reference FROM tariff_versions WHERE effective_from <= NOW() ORDER BY effective_from DESC, id DESC LIMIT 1');
        if (!$t) Response::error('No hay tarifa vigente configurada', 503);
        return $t;
    }

    // GET /tariffs/current — sin costos internos ni márgenes
    public function show(): void
    {
        $t = self::current();
        unset($t['id']);
        Response::ok($t);
    }

    // POST /quote {value, weight_kg?} — estimación; sin peso NO inventa un total
    public function quote(): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $v  = Validator::make(is_array($in) ? $in : [], [
            'value'     => 'required|regex:/^\d{1,7}(\.\d{1,2})?$/',
            'weight_kg' => 'regex:/^\d{1,4}(\.\d{1,3})?$/',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $t    = self::current();
        $base = Money::toCents((string) $v->get('value'));
        $comm = Money::commission($base, $t['commission_rate']);
        $out  = [
            'estimate' => true, 'product_value' => Money::fmt($base), 'commission' => Money::fmt($comm),
            'shipping' => null, 'optimus_total' => null, 'needs_quote' => true,
            'customs_included' => false, 'tariff_is_reference' => (bool) $t['is_reference'],
        ];
        $kg = $v->get('weight_kg');
        if ($kg !== null && (float) $kg > 0) {
            $ship = Money::shipping((string) $kg, $t['sell_rate_per_kg']);
            $out['shipping'] = Money::fmt($ship);
            $out['optimus_total'] = Money::fmt($comm + $ship);
            $out['needs_quote'] = false;
        }
        Response::ok($out);
    }

    // POST /admin/tariffs {commission_rate, sell_rate_per_kg, notes?}  — solo administrador
    public function create(): void
    {
        $in = json_decode(file_get_contents('php://input'), true);
        $v  = Validator::make(is_array($in) ? $in : [], [
            'commission_rate'  => 'required|regex:/^0(\.\d{1,4})?$/|between:0,0.5',
            'sell_rate_per_kg' => 'required|regex:/^\d{1,4}(\.\d{1,2})?$/|between:0.01,1000',
            'notes'            => 'max:255',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $id = Database::insert(
            'INSERT INTO tariff_versions (commission_rate, sell_rate_per_kg, effective_from, is_reference, notes, created_by) VALUES (?,?,NOW(),0,?,?)',
            [$v->get('commission_rate'), $v->get('sell_rate_per_kg'), $v->get('notes'), authId()]
        );
        Logger::audit('tariff_create', authId(), ['tariff_id' => (int) $id]);
        Response::created(['id' => (int) $id], 'Nueva versión de tarifa creada (las liquidaciones ya emitidas no cambian)');
    }
}
