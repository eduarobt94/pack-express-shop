<?php
declare(strict_types=1);

/**
 * Compras: pedidos hechos por el cliente en tiendas de EE.UU. El producto se paga en la tienda;
 * aquí solo se registra (con comprobante) para gestionarlo. Todo acceso se filtra por user_id.
 */
class PurchaseController
{
    private const COLS = 'p.id, p.code, p.store, p.store_order_number, p.purchased_on, p.currency, p.store_taxes,
                          p.store_shipping, p.status, p.notes, p.created_at, a.label AS recipient_label,
                          a.recipient AS recipient_name, a.province AS recipient_province';

    // GET /purchases
    public function index(): void
    {
        $rows = Database::query(
            'SELECT ' . self::COLS . ',
                    (SELECT COALESCE(SUM(line_amount),0) FROM purchase_items i WHERE i.purchase_id = p.id) AS products_amount
               FROM purchases p JOIN addresses a ON a.id = p.recipient_id
              WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 200',
            [authId()]
        );
        Response::ok($rows);
    }

    // GET /purchases/{code}
    public function show(string $code): void
    {
        Response::ok($this->load($code));
    }

    /** Carga una compra del usuario autenticado (404 si no existe o es de otro cliente). */
    private function load(string $code): array
    {
        $p = Database::queryOne(
            'SELECT ' . self::COLS . ' FROM purchases p JOIN addresses a ON a.id = p.recipient_id WHERE p.code = ? AND p.user_id = ?',
            [$code, authId()]
        );
        if (!$p) Response::notFound('Compra no encontrada');          // 404 también si es de otro cliente: no se revela existencia

        $items = Database::query(
            'SELECT description, url, model, qty, unit_price, discount, line_amount FROM purchase_items WHERE purchase_id = ? ORDER BY id',
            [(int) $p['id']]
        );
        $p['items'] = $items;
        $p['packages'] = Database::query(
            'SELECT id, tracking_number, weight_kg, status, received_at FROM packages WHERE purchase_id = ? AND user_id = ?',
            [(int) $p['id'], authId()]
        );
        unset($p['id']);
        return $p;
    }

    // POST /purchases  (multipart/form-data: campos + items(JSON) + receipt)
    public function create(): void
    {
        $in = $_POST;
        $v = Validator::make($in, [
            'recipient_id'       => 'required|int',
            'store'              => 'required|min:2|max:100',
            'store_order_number' => 'required|min:3|max:100',
            'purchased_on'       => 'required|date',
            'store_taxes'        => 'between:0,100000|regex:/^\d+(\.\d{1,2})?$/',
            'store_shipping'     => 'between:0,100000|regex:/^\d+(\.\d{1,2})?$/',
            'notes'              => 'max:500',
        ]);
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        if (!in_array(strtolower((string) ($in['accept_terms'] ?? '')), ['1', 'true', 'on', 'yes'], true)) {
            Response::error('Tenés que aceptar las condiciones del servicio', 422);
        }
        if (strtotime((string) $v->get('purchased_on')) > time() + 86400) Response::error('La fecha de compra no puede ser futura', 422);

        // Productos
        $items = json_decode((string) ($in['items'] ?? ''), true);
        if (!is_array($items) || !$items || count($items) > 50) Response::error('Agregá entre 1 y 50 productos', 422);
        $clean = [];
        foreach ($items as $i => $it) {
            if (!is_array($it)) Response::error("Producto #" . ($i + 1) . " inválido", 422);
            $iv = Validator::make($it, [
                'description' => 'required|min:2|max:300',
                'url'         => 'max:1000|url',
                'model'       => 'max:100',
                'qty'         => 'required|int|between:1,1000',
                'unit_price'  => 'required|regex:/^\d{1,6}(\.\d{1,2})?$/|between:0,100000',
                'discount'    => 'regex:/^\d{1,6}(\.\d{1,2})?$/',
            ]);
            if ($iv->fails()) Response::error('Producto #' . ($i + 1) . ' inválido', 422, $iv->errors());
            $gross = Money::toCents((string) $iv->get('unit_price')) * (int) $iv->get('qty');
            $disc  = Money::toCents((string) ($iv->get('discount') ?? '0'));
            if ($disc > $gross) Response::error('Producto #' . ($i + 1) . ': el descuento supera el importe', 422);
            $clean[] = $iv;
        }

        // El destinatario debe ser del cliente (además lo exige la FK compuesta de la base)
        $addr = Database::queryOne('SELECT id, province FROM addresses WHERE id = ? AND user_id = ?', [(int) $v->get('recipient_id'), authId()]);
        if (!$addr) Response::error('Destinatario inválido', 422);

        if (empty($_FILES['receipt'])) Response::error('El comprobante de la compra es obligatorio', 422);
        $receiptKey = FileStore::saveUpload($_FILES['receipt']);

        $year = (int) date('Y');
        Database::beginTransaction();
        try {
            $code = sprintf('OPT-%s-%d-%05d', $addr['province'], $year, Database::nextSeq('purchase', $year));
            $pid = (int) Database::insert(
                'INSERT INTO purchases (code, user_id, recipient_id, store, store_order_number, purchased_on, store_taxes,
                                        store_shipping, receipt_path, terms_version, terms_accepted_at, notes)
                 VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?)',
                [$code, authId(), (int) $addr['id'], $v->get('store'), $v->get('store_order_number'), $v->get('purchased_on'),
                 $v->get('store_taxes') ?? '0', $v->get('store_shipping') ?? '0', $receiptKey, (string) env('TERMS_VERSION', 'v0-pendiente'), $v->get('notes')]
            );
            foreach ($clean as $iv) {
                Database::execute(
                    'INSERT INTO purchase_items (purchase_id, description, url, model, qty, unit_price, discount) VALUES (?,?,?,?,?,?,?)',
                    [$pid, $iv->get('description'), $iv->get('url'), $iv->get('model'), (int) $iv->get('qty'), $iv->get('unit_price'), $iv->get('discount') ?? '0']
                );
            }
            Database::commit();
        } catch (PDOException $e) {
            Database::rollback();
            FileStore::delete($receiptKey);
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uq_purchases_store_order')) {
                Response::error('Ya registraste esa compra de la tienda', 409);
            }
            Logger::error('Purchase create failed', ['error' => $e->getMessage()]);
            Response::error('No se pudo registrar la compra', 500);
        }

        Logger::audit('purchase_create', authId(), ['purchase' => $code]);
        Response::created($this->load($code), 'Compra registrada');
    }

    // GET /purchases/{code}/receipt — solo el dueño (o el personal) descarga el comprobante
    public function receipt(string $code): void
    {
        $p = in_array(Auth::role(), ['agent', 'admin'], true)
            ? Database::queryOne('SELECT receipt_path FROM purchases WHERE code = ?', [$code])
            : Database::queryOne('SELECT receipt_path FROM purchases WHERE code = ? AND user_id = ?', [$code, authId()]);
        if (!$p) Response::notFound('Compra no encontrada');
        FileStore::stream($p['receipt_path']);
    }
}
