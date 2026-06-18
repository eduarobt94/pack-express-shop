<?php
declare(strict_types=1);

class OrderController
{
    private function input(): array
    {
        return (array) json_decode(file_get_contents('php://input'), true);
    }

    // GET /orders
    public function index(): void
    {
        $orders = Database::query(
            'SELECT o.*,
                    JSON_ARRAYAGG(
                        JSON_OBJECT("product_id", oi.product_id, "name", oi.name, "qty", oi.qty, "unit_price", oi.unit_price)
                    ) AS items
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.user_id = ?
             GROUP BY o.id
             ORDER BY o.created_at DESC',
            [authId()]
        );

        foreach ($orders as &$order) {
            $order['items'] = json_decode($order['items'] ?? '[]', true);
        }

        Response::ok($orders);
    }

    // GET /orders/{id}
    public function show(string $id): void
    {
        $order = Database::queryOne(
            'SELECT o.* FROM orders o WHERE o.id = ? AND o.user_id = ?',
            [$id, authId()]
        );

        if (!$order) Response::notFound('Orden no encontrada');

        $order['items'] = Database::query(
            'SELECT * FROM order_items WHERE order_id = ?',
            [$id]
        );

        Response::ok($order);
    }

    // POST /orders
    public function create(): void
    {
        $v = Validator::make($this->input(), [
            'address_id' => 'required|numeric',
            'method'     => 'required|in:standard,express',
            'items'      => 'required',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $items = $v->get('items');
        if (!is_array($items) || empty($items)) {
            Response::error('La orden debe tener al menos un producto', 422);
        }

        // Verify address belongs to user
        $address = Database::queryOne(
            'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
            [$v->get('address_id'), authId()]
        );
        if (!$address) Response::error('Dirección no válida', 422);

        // Calculate totals (price comes from server-side, never trust client)
        $subtotal = 0;
        foreach ($items as $item) {
            if (!isset($item['product_id'], $item['name'], $item['qty'], $item['unit_price'])) {
                Response::error('Formato de ítem inválido', 422);
            }
            $subtotal += (float) $item['unit_price'] * (int) $item['qty'];
        }

        $shipping = $v->get('method') === 'express' ? round($subtotal * 0.11, 2) : round($subtotal * 0.0237, 2);
        $customs  = round($subtotal * 0.12, 2);
        $total    = $subtotal + $shipping + $customs;

        // Generate order ID
        $province = Database::queryOne('SELECT province FROM addresses WHERE id = ?', [$v->get('address_id')]);
        $year     = date('Y');
        $last     = Database::queryOne("SELECT id FROM orders WHERE id LIKE 'PKX-{$province['province']}-$year-%' ORDER BY id DESC LIMIT 1");
        $seq      = $last ? (int) substr($last['id'], -5) + 1 : 1;
        $orderId  = sprintf('PKX-%s-%s-%05d', $province['province'], $year, $seq);

        Database::beginTransaction();
        try {
            Database::execute(
                'INSERT INTO orders (id, user_id, address_id, method, status, subtotal, shipping, customs, total, paid_at)
                 VALUES (?,?,?,?,?,?,?,?,?,"pending",NOW())',
                [$orderId, authId(), (int) $v->get('address_id'), $v->get('method'),
                 'pending', $subtotal, $shipping, $customs, $total]
            );

            foreach ($items as $item) {
                Database::execute(
                    'INSERT INTO order_items (order_id, product_id, name, qty, unit_price) VALUES (?,?,?,?,?)',
                    [$orderId, $item['product_id'], $item['name'], (int) $item['qty'], (float) $item['unit_price']]
                );
            }

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Logger::error('Order create failed', ['error' => $e->getMessage()]);
            Response::error('Error al crear la orden', 500);
        }

        Logger::audit('order_create', authId(), ['order_id' => $orderId, 'total' => $total]);
        $order = Database::queryOne('SELECT * FROM orders WHERE id = ?', [$orderId]);
        $order['items'] = Database::query('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);

        Response::created($order, 'Orden creada');
    }
}
