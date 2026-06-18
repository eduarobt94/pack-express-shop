-- ─────────────────────────────────────────────────────────────────────────────
-- Pack Express Shop — Seeds de desarrollo v1.0
-- Datos que reflejan exactamente los hardcoded del frontend (Fase 0)
-- ─────────────────────────────────────────────────────────────────────────────

-- password '1234' → $2y$10$/cfk9DSegwAJlkgMlPDJBOnaeqrpybIy.G2yYN/m1awWZm48z3Jwq
INSERT INTO users (id, name, email, phone, password_hash, tier, status, email_verified_at) VALUES
(1, 'Yanet Rodríguez',  'yanet.rodriguez@email.com', '+1 (305) 555-0147', '$2y$10$/cfk9DSegwAJlkgMlPDJBOnaeqrpybIy.G2yYN/m1awWZm48z3Jwq', 'frequent', 'active', '2024-08-12 00:00:00'),
(2, 'Yusniel Rojas',    'yusniel.rojas@email.com',   NULL,                '$2y$10$/cfk9DSegwAJlkgMlPDJBOnaeqrpybIy.G2yYN/m1awWZm48z3Jwq', 'standard', 'active', '2026-06-14 00:00:00'),
(3, 'Frank Leon',       'frank.leon@email.com',      NULL,                '$2y$10$/cfk9DSegwAJlkgMlPDJBOnaeqrpybIy.G2yYN/m1awWZm48z3Jwq', 'standard', 'active', '2026-06-14 00:00:00');

-- Suites
INSERT INTO suites (user_id, suite_id, country, member_since) VALUES
(1, 'PKX-CU-096582', 'CU', '2024-08-12'),
(2, 'PKX-CU-100221', 'CU', '2026-06-14'),
(3, 'PKX-CU-100222', 'CU', '2026-06-14');

-- Paquetes en el casillero
INSERT INTO packages (id, user_id, suite_id, tracking_number, store, description, declared_value, weight_kg, length_cm, width_cm, height_cm, status, received_at, photo_requested, insured, insurance_cost, notes) VALUES
('WR-2026-00101', 1, 'PKX-CU-096582', '1Z999AA10123456784',   'Amazon',     'Cargador portátil Anker 26800mAh',            55.00,   0.52, 17, 9,  4,  'ready',    '2026-06-02 09:14:00', 0, 0, 0.00, '[]'),
('WR-2026-00102', 1, 'PKX-CU-096582', '9400111899223397622401','Walmart',    'Auriculares Bluetooth Sony WH-1000XM5',       278.00,  0.25, 26, 22, 10, 'ready',    '2026-06-05 14:30:00', 1, 1, 33.00,'[]'),
('WR-2026-00103', 1, 'PKX-CU-096582', '795644790135',          'Best Buy',   'iPad Pro 11" M4 + Apple Pencil Pro',          1299.00, 1.10, 35, 27, 8,  'no_docs',  '2026-06-08 11:20:00', 0, 0, 0.00, '["Falta factura de compra. Subir en la sección Documentos."]'),
('WR-2026-00104', 1, 'PKX-CU-096582', '1FedEx923847612',       'Home Depot', 'Kit de herramientas Dewalt 20V MAX (20 piezas)',189.00, 6.30, 50, 35, 20, 'verifying','2026-06-10 16:45:00', 0, 0, 0.00, '["Verificación de contenido en proceso. Estimado: 24h."]'),
('WR-2026-00098', 1, 'PKX-CU-096582', '1Z999BB20987654321',    'Amazon',     'Router Wi-Fi 6 TP-Link Archer AX73',          149.00,  1.80, 30, 18, 6,  'shipped',  '2026-05-20 10:00:00', 0, 0, 0.00, '[]'),
('pkg-006',       1, 'PKX-CU-096582', '7312840029837412',       'Best Buy',   'Monitor LG 27" 4K',                           399.00,  6.20, 68, 44, 15, 'retained', '2026-06-10 09:00:00', 0, 0, 0.00, '[]');

UPDATE packages SET retained_reason = 'Dirección incompleta — requiere corrección' WHERE id = 'pkg-006';

-- Pre-alertas
INSERT INTO pre_alerts (id, user_id, suite_id, tracking_number, store, description, declared_value, pieces, status, created_at) VALUES
('PA-2026-00051', 1, 'PKX-CU-096582', 'TMUW202606140012345',    'Temu',  'Lámpara LED escritorio + soporte monitor',        42.00, 2, 'pending', '2026-06-11 20:30:00'),
('PA-2026-00052', 1, 'PKX-CU-096582', '9261290100129790195523', 'eBay',  'Sensor de temperatura y humedad Govee (pack x4)', 67.00, 1, 'pending', '2026-06-13 10:15:00');

-- Dirección de entrega Cuba
INSERT INTO addresses (id, user_id, label, recipient, ci, phone, province, municipality, street, is_default) VALUES
(1, 1, 'Mamá — La Habana',   'Mercedes Pérez León',   '54091205832', '+53 5234 5678', 'HAB', 'Plaza de la Revolución', 'Calle 23 #456 e/ G y H, Vedado',              1),
(2, 1, 'Hermano — Santiago', 'Luis Rodríguez León',   '88112048711', '+53 5345 6789', 'SCU', 'Santiago de Cuba',       'Av. Victoriano Garzón #210, Reparto Sueño',   0);

-- Envío de casillero
INSERT INTO locker_shipments (id, user_id, suite_id, address_id, total_weight_kg, volumetric_weight_kg, freight, handling, insurance, total, status, created_at, dispatched_at) VALUES
('SH-2026-00009', 1, 'PKX-CU-096582', 1, 1.80, 1.80, 42.30, 5.00, 0.00, 47.30, 'in_transit', '2026-05-22 09:00:00', '2026-05-25 08:30:00');

INSERT INTO locker_shipment_packages (shipment_id, package_id) VALUES
('SH-2026-00009', 'WR-2026-00098');

-- Órdenes de tienda (marketplace)
INSERT INTO orders (id, user_id, address_id, method, status, subtotal, shipping, customs, total, eta, paid_at, created_at) VALUES
('PKX-HAB-2026-00847', 1, 1, 'express',   'in_transit', 1099.00, 121.55, 131.88, 1352.43, '20–22 jun 2026',    '2026-06-08 14:32:00', '2026-06-08 14:32:00'),
('PKX-SCU-2026-00731', 1, 2, 'standard',  'delivered',  1099.00,  26.04, 131.88, 1256.92, 'Entregado el 09 jun 2026', '2026-05-21 09:15:00', '2026-05-21 09:15:00'),
('PKX-CMG-2026-00692', 1, 1, 'standard',  'customs',    1498.00,  95.70, 179.76, 1773.46, '18–21 jun 2026',    '2026-05-10 17:48:00', '2026-05-10 17:48:00');

INSERT INTO order_items (order_id, product_id, name, qty, unit_price) VALUES
('PKX-HAB-2026-00847', 'ef-delta-2-max',    'EcoFlow DELTA 2 Max',          1, 1099.00),
('PKX-SCU-2026-00731', 'macbook-air-m3',    'MacBook Air 13" M3',            1, 1099.00),
('PKX-CMG-2026-00692', 'segway-max-g2',     'Segway Ninebot MAX G2',         1,  899.00),
('PKX-CMG-2026-00692', 'ecoflow-panel-400', 'EcoFlow Panel Solar 400W',      1,  599.00);
