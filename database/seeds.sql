-- Optimus Envíos — Datos de DESARROLLO (nunca cargar en producción)
-- Requiere las migraciones 001–005 aplicadas. La clave de todos los usuarios de prueba es: Dev-Clave-123
-- (el hash corresponde a esa clave; cámbiela en cualquier ambiente compartido).
-- Los roles de personal se asignan aquí como lo haría un DBA: no existe API para elevar privilegios.

-- password 'Dev-Clave-123' (bcrypt cost 10)
SET @pwd = '$2y$10$t1YD/urGuSvChlyT/dMUh.iaEk5NvYiXE445s6ZZbiz.g83MuKnSK';

INSERT INTO users (id, name, email, phone, password_hash, status, role) VALUES
(1, 'Yanet Rodríguez',   'yanet.rodriguez@email.com', '+598 99 765 432', @pwd, 'active', 'customer'),
(2, 'Yusniel Rojas',     'yusniel.rojas@email.com',   NULL,              @pwd, 'active', 'customer'),
(3, 'Atención Sucursal', 'agente@optimus.test',       NULL,              @pwd, 'active', 'agent'),
(4, 'Almacén EE.UU.',    'almacen@optimus.test',      NULL,              @pwd, 'active', 'warehouse'),
(5, 'Administración',    'admin@optimus.test',        NULL,              @pwd, 'active', 'admin');

INSERT INTO suites (user_id, suite_id, country, member_since) VALUES
(1, 'OPT-UY-000001', 'UY', '2026-08-12'),
(2, 'OPT-UY-000002', 'UY', '2026-10-01');

-- Destinatarios en Cuba (el documento va cifrado: cargarlo desde la API, que usa DATA_ENC_KEY)
INSERT INTO addresses (id, user_id, label, recipient, phone, province, municipality, street, is_default) VALUES
(1, 1, 'Mamá — La Habana',   'Mercedes Pérez León', '+53 5234 5678', 'HAB', 'Plaza de la Revolución', 'Calle 23 #456 e/ G y H, Vedado', 1),
(2, 1, 'Hermano — Santiago', 'Luis Rodríguez León', '+53 5345 6789', 'SCU', 'Santiago de Cuba',       'Av. Victoriano Garzón #210, Reparto Sueño', 0);

-- Una compra aceptada con su paquete recibido y pesado
INSERT INTO purchases (id, code, user_id, recipient_id, store, store_order_number, purchased_on, receipt_path, status, terms_version, terms_accepted_at) VALUES
(1, 'OPT-HAB-2026-00001', 1, 1, 'Amazon', '112-3456789-0123456', '2026-10-08', '2026/10/00000000000000000000000000000000.pdf', 'registered', 'v0-pendiente', '2026-10-08 14:32:00');
INSERT INTO purchase_items (purchase_id, description, model, qty, unit_price, discount) VALUES
(1, 'EcoFlow DELTA 2 Max', 'DELTA 2 Max', 1, 1099.00, 0.00);
-- Los productos solo se pueden cargar mientras la compra está registrada; luego se acepta (regla de la base)
UPDATE purchases SET status = 'accepted' WHERE id = 1;
INSERT INTO packages (id, user_id, suite_id, purchase_id, tracking_number, weight_kg, weight_original, weight_unit, status, received_at) VALUES
('WR-2026-00001', 1, 'OPT-UY-000001', 1, '1Z999AA10123456784', 25.000, 25.000, 'kg', 'received_us', '2026-10-12 16:20:00');

-- Contadores coherentes con los códigos sembrados
INSERT INTO counters (name, year, seq) VALUES ('purchase', 2026, 1), ('package', 2026, 1) ON DUPLICATE KEY UPDATE seq = GREATEST(seq, VALUES(seq));
