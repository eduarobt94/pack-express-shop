<?php
declare(strict_types=1);

class PreAlertController
{
    private const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    private const MAX_BYTES    = 5 * 1024 * 1024; // 5 MB

    private function input(): array
    {
        return (array) json_decode(file_get_contents('php://input'), true);
    }

    // GET /pre-alerts
    public function index(): void
    {
        $alerts = Database::query(
            'SELECT * FROM pre_alerts WHERE user_id = ? ORDER BY created_at DESC',
            [authId()]
        );
        Response::ok($alerts);
    }

    // POST /pre-alerts (multipart/form-data with optional file)
    public function create(): void
    {
        // Support both JSON and multipart
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?? $_POST;

        $v = Validator::make((array) $input, [
            'tracking_number' => 'required|min:5|max:100',
            'store'           => 'required|max:100',
            'description'     => 'required|min:3',
            'declared_value'  => 'required|numeric',
            'pieces'          => 'numeric',
            'carrier'         => 'required|in:DHL,FedEx Express,FedEx Ground,UPS,USPS,Amazon Logistics,Otros',
            'instructions'    => 'max:500',
        ]);

        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $facturaPath = null;

        if (!empty($_FILES['factura'])) {
            $facturaPath = $this->handleUpload($_FILES['factura']);
        }

        $suite = Database::queryOne('SELECT suite_id FROM suites WHERE user_id = ?', [authId()]);
        if (!$suite) Response::error('Suite no encontrada', 404);

        // Generate pre-alert ID
        $year = date('Y');
        $last = Database::queryOne("SELECT id FROM pre_alerts WHERE id LIKE 'PA-$year-%' ORDER BY id DESC LIMIT 1");
        $seq  = $last ? (int) substr($last['id'], -5) + 1 : 1;
        $id   = sprintf('PA-%s-%05d', $year, $seq);

        Database::execute(
            'INSERT INTO pre_alerts
             (id, user_id, suite_id, tracking_number, store, description, declared_value,
              pieces, carrier, instructions, factura_path, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,"pending")',
            [
                $id,
                authId(),
                $suite['suite_id'],
                $v->get('tracking_number'),
                $v->get('store'),
                $v->get('description'),
                (float) $v->get('declared_value'),
                (int) ($v->get('pieces') ?: 1),
                $v->get('carrier'),
                $v->get('instructions'),
                $facturaPath,
            ]
        );

        $alert = Database::queryOne('SELECT * FROM pre_alerts WHERE id = ?', [$id]);
        Logger::audit('pre_alert_create', authId(), ['pre_alert_id' => $id]);
        Response::created($alert, 'Pre-alerta registrada');
    }

    // DELETE /pre-alerts/{id}
    public function cancel(string $id): void
    {
        $alert = Database::queryOne(
            'SELECT * FROM pre_alerts WHERE id = ? AND user_id = ?',
            [$id, authId()]
        );

        if (!$alert) Response::notFound('Pre-alerta no encontrada');

        if ($alert['status'] === 'received') {
            Response::error('No se puede cancelar una pre-alerta ya recibida', 409);
        }

        Database::execute(
            "UPDATE pre_alerts SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
            [$id]
        );

        Logger::audit('pre_alert_cancel', authId(), ['pre_alert_id' => $id]);
        Response::ok(null, 'Pre-alerta cancelada');
    }

    private function handleUpload(array $file): string
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('Error al subir el archivo', 400);
        }

        if ($file['size'] > self::MAX_BYTES) {
            Response::error('El archivo no puede superar 5 MB', 413);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, self::ALLOWED_MIME)) {
            Response::error('Solo se permiten PDF, JPG, PNG o WebP', 415);
        }

        $ext     = pathinfo($file['name'], PATHINFO_EXTENSION);
        $name    = bin2hex(random_bytes(16)) . '.' . strtolower($ext);
        $dir     = env('UPLOAD_DIR', '../uploads') . '/facturas/' . date('Y/m');

        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('No se pudo guardar el archivo', 500);
        }

        return $dest;
    }
}
