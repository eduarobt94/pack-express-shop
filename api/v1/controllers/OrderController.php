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
            'SELECT o.id, o.method, o.status, o.subtotal, o.shipping, o.customs, o.total, o.eta, o.paid_at, o.created_at,
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
            'SELECT o.id, o.method, o.status, o.subtotal, o.shipping, o.customs, o.total, o.eta, o.paid_at, o.created_at FROM orders o WHERE o.id = ? AND o.user_id = ?',
            [$id, authId()]
        );

        if (!$order) Response::notFound('Orden no encontrada');

        $order['items'] = Database::query(
            'SELECT product_id, name, qty, unit_price FROM order_items WHERE order_id = ?',
            [$id]
        );

        Response::ok($order);
    }

    // POST /orders — DESHABILITADO. El modelo de negocio vigente no cobra el producto dentro de la
    // plataforma (ver POST /purchases). Además el handler anterior confiaba en precios enviados por el
    // cliente (manipulación de precios) y tenía un INSERT inválido.
    public function create(): void
    {
        Response::error('Este endpoint fue reemplazado por POST /purchases', 410);
    }
}
