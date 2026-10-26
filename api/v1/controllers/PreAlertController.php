<?php
declare(strict_types=1);

/**
 * Pre-alertas — OBSOLETO. En el modelo vigente el cliente registra sus compras (POST /purchases)
 * con comprobante. Se conserva la consulta y la cancelación de las pre-alertas históricas.
 * La creación quedó deshabilitada: su carga de archivos usaba la extensión enviada por el cliente
 * (riesgo de subir "x.php") y guardaba rutas del servidor en la base.
 */
class PreAlertController
{
    // GET /pre-alerts — sin factura_path (ruta interna del servidor)
    public function index(): void
    {
        Response::ok(Database::query(
            'SELECT id, tracking_number, store, description, declared_value, pieces, carrier, status, created_at
               FROM pre_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
            [authId()]
        ));
    }

    // POST /pre-alerts
    public function create(): void
    {
        Response::error('Las pre-alertas fueron reemplazadas por el registro de compras (POST /purchases)', 410);
    }

    // DELETE /pre-alerts/{id}
    public function cancel(string $id): void
    {
        $alert = Database::queryOne('SELECT id, status FROM pre_alerts WHERE id = ? AND user_id = ?', [$id, authId()]);
        if (!$alert) Response::notFound('Pre-alerta no encontrada');
        if ($alert['status'] === 'received') Response::error('No se puede cancelar una pre-alerta ya recibida', 409);

        Database::execute("UPDATE pre_alerts SET status = 'cancelled' WHERE id = ? AND user_id = ?", [$id, authId()]);
        Logger::audit('pre_alert_cancel', authId(), ['pre_alert_id' => $id]);
        Response::ok(null, 'Pre-alerta cancelada');
    }
}
