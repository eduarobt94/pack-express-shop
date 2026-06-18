<?php
declare(strict_types=1);

class LockerController
{
    // GET /locker — suite + stats
    public function index(): void
    {
        $suite = Database::queryOne(
            'SELECT s.suite_id, s.country, s.member_since,
                    COUNT(CASE WHEN p.status NOT IN ("shipped") THEN 1 END) AS packages_in_locker,
                    COUNT(CASE WHEN p.status = "ready"    THEN 1 END) AS ready,
                    COUNT(CASE WHEN p.status = "retained" THEN 1 END) AS retained,
                    COUNT(pa.id) AS pending_alerts
             FROM suites s
             LEFT JOIN packages   p  ON p.suite_id = s.suite_id
             LEFT JOIN pre_alerts pa ON pa.suite_id = s.suite_id AND pa.status = "pending"
             WHERE s.user_id = ?
             GROUP BY s.suite_id',
            [authId()]
        );

        if (!$suite) Response::notFound('Suite no encontrada');

        Response::ok($suite);
    }

    // GET /locker/packages?status=ready
    public function packages(): void
    {
        $status = $_GET['status'] ?? null;
        $allowed = ['in_transit','received','verifying','no_docs','ready','retained','shipped'];

        $sql    = 'SELECT * FROM packages WHERE user_id = ?';
        $params = [authId()];

        if ($status && in_array($status, $allowed)) {
            $sql    .= ' AND status = ?';
            $params[] = $status;
        }

        $sql .= ' ORDER BY received_at DESC';

        $packages = Database::query($sql, $params);

        // Decode JSON notes field
        foreach ($packages as &$pkg) {
            $pkg['notes'] = json_decode($pkg['notes'] ?? '[]', true);
        }

        Response::ok($packages);
    }

    // GET /locker/packages/{id}
    public function packageDetail(string $id): void
    {
        $pkg = Database::queryOne(
            'SELECT * FROM packages WHERE id = ? AND user_id = ?',
            [$id, authId()]
        );

        if (!$pkg) Response::notFound('Paquete no encontrado');

        $pkg['notes'] = json_decode($pkg['notes'] ?? '[]', true);
        Response::ok($pkg);
    }

    // GET /locker/shipments
    public function shipments(): void
    {
        $shipments = Database::query(
            'SELECT ls.*,
                    JSON_ARRAYAGG(lsp.package_id) AS package_ids
             FROM locker_shipments ls
             LEFT JOIN locker_shipment_packages lsp ON lsp.shipment_id = ls.id
             WHERE ls.user_id = ?
             GROUP BY ls.id
             ORDER BY ls.created_at DESC',
            [authId()]
        );

        foreach ($shipments as &$s) {
            $s['package_ids'] = json_decode($s['package_ids'] ?? '[]', true);
        }

        Response::ok($shipments);
    }

    // GET /locker/shipments/{id}
    public function shipmentDetail(string $id): void
    {
        $shipment = Database::queryOne(
            'SELECT ls.*,
                    JSON_ARRAYAGG(lsp.package_id) AS package_ids
             FROM locker_shipments ls
             LEFT JOIN locker_shipment_packages lsp ON lsp.shipment_id = ls.id
             WHERE ls.id = ? AND ls.user_id = ?
             GROUP BY ls.id',
            [$id, authId()]
        );

        if (!$shipment) Response::notFound('Envío no encontrado');

        $shipment['package_ids'] = json_decode($shipment['package_ids'] ?? '[]', true);
        Response::ok($shipment);
    }
}
