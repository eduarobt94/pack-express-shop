-- Optimus Envíos — Migración 004: paquetes, envíos, relaciones seguras y reglas de negocio en triggers
-- Fase EXPANSIÓN: no se eliminan columnas ni datos. Los estados antiguos siguen siendo válidos.
-- Aprobación de una sola vez: ON DELETE CASCADE sobre datos de clientes pasa a RESTRICT
-- (un borrado accidental de un usuario ya no arrastra paquetes, envíos ni destinatarios).

-- ── Prechequeos de datos existentes ───────────────────────────────────────────────────────
-- @@assert paquetes con peso <= 0
SELECT COUNT(*) FROM packages WHERE weight_kg IS NOT NULL AND weight_kg <= 0;
-- @@
-- @@assert paquetes con valor declarado negativo
SELECT COUNT(*) FROM packages WHERE declared_value < 0;
-- @@
-- @@assert paquetes asociados a más de un envío
SELECT COUNT(*) FROM (SELECT package_id FROM locker_shipment_packages GROUP BY package_id HAVING COUNT(*) > 1) x;
-- @@
-- @@assert envíos cuyo destinatario no pertenece al mismo cliente
SELECT COUNT(*) FROM locker_shipments s LEFT JOIN addresses a ON a.id = s.address_id AND a.user_id = s.user_id WHERE s.address_id IS NOT NULL AND a.id IS NULL;
-- @@
-- ── Paquetes ───────────────────────────────────────────────────────────────────────────
ALTER TABLE packages
  MODIFY user_id  INT UNSIGNED NULL COMMENT 'NULL = paquete no identificado (bandeja de revisión)',
  MODIFY suite_id VARCHAR(25)  NULL,
  ADD COLUMN IF NOT EXISTS purchase_id     BIGINT UNSIGNED NULL AFTER suite_id,
  ADD COLUMN IF NOT EXISTS weight_original DECIMAL(9,3) NULL COMMENT 'Peso tal como fue cargado, sin perder el dato original',
  ADD COLUMN IF NOT EXISTS weight_unit     ENUM('kg','lb') NULL,
  ADD COLUMN IF NOT EXISTS observed_condition VARCHAR(255) NULL,
  MODIFY status ENUM('in_transit','received','verifying','no_docs','ready','retained','shipped',
                     'pending_reception','unidentified','received_us','preparing','dispatched',
                     'in_cuba','out_for_delivery','delivered','incident') NOT NULL DEFAULT 'pending_reception';
-- @@
ALTER TABLE packages DROP FOREIGN KEY IF EXISTS packages_ibfk_1;
-- @@
ALTER TABLE packages
  ADD FOREIGN KEY IF NOT EXISTS fk_packages_user (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY IF NOT EXISTS fk_packages_purchase (purchase_id, user_id) REFERENCES purchases(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT IF NOT EXISTS chk_packages_weight CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 5000)),
  ADD CONSTRAINT IF NOT EXISTS chk_packages_value  CHECK (declared_value >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_packages_unit   CHECK ((weight_original IS NULL) = (weight_unit IS NULL)),
  ADD CONSTRAINT IF NOT EXISTS chk_packages_ident  CHECK (user_id IS NOT NULL OR (purchase_id IS NULL AND status IN ('received_us','unidentified','received','incident')));
-- @@
-- ── Pre-alertas y suites: sin borrado en cascada de datos del cliente ─────────────────────
ALTER TABLE pre_alerts DROP FOREIGN KEY IF EXISTS pre_alerts_ibfk_1;
-- @@
ALTER TABLE pre_alerts ADD FOREIGN KEY IF NOT EXISTS fk_pre_alerts_user (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT IF NOT EXISTS chk_pre_alerts_value CHECK (declared_value >= 0);
-- @@
ALTER TABLE suites DROP FOREIGN KEY IF EXISTS suites_ibfk_1;
-- @@
ALTER TABLE suites ADD FOREIGN KEY IF NOT EXISTS fk_suites_user (user_id) REFERENCES users(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE addresses DROP FOREIGN KEY IF EXISTS addresses_ibfk_1;
-- @@
ALTER TABLE addresses ADD FOREIGN KEY IF NOT EXISTS fk_addresses_user (user_id) REFERENCES users(id) ON DELETE RESTRICT;
-- @@
-- ── Envíos a Cuba ───────────────────────────────────────────────────────────────────────
ALTER TABLE locker_shipments
  ADD COLUMN IF NOT EXISTS operator_guide         VARCHAR(100) NULL COMMENT 'Guía del operador de transporte',
  ADD COLUMN IF NOT EXISTS dispatch_override_by   INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS dispatch_override_reason VARCHAR(255) NULL,
  MODIFY status ENUM('pending','in_transit','customs','delivered','cancelled',
                     'preparing','ready','dispatched','in_cuba','out_for_delivery','incident') NOT NULL DEFAULT 'pending';
-- @@
ALTER TABLE locker_shipments DROP FOREIGN KEY IF EXISTS locker_shipments_ibfk_1;
-- @@
ALTER TABLE locker_shipments
  ADD FOREIGN KEY IF NOT EXISTS fk_shipments_user (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY IF NOT EXISTS fk_shipments_recipient (address_id, user_id) REFERENCES addresses(id, user_id) ON DELETE RESTRICT,
  ADD FOREIGN KEY IF NOT EXISTS fk_shipments_override (dispatch_override_by) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT IF NOT EXISTS chk_shipments_money CHECK (freight >= 0 AND handling >= 0 AND insurance >= 0 AND total >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_shipments_weight CHECK (total_weight_kg IS NULL OR total_weight_kg > 0),
  ADD CONSTRAINT IF NOT EXISTS chk_shipments_override CHECK (dispatch_override_by IS NULL OR CHAR_LENGTH(dispatch_override_reason) >= 5);
-- @@
ALTER TABLE locker_shipments ADD UNIQUE KEY IF NOT EXISTS uq_shipments_id_user (id, user_id);
-- @@
ALTER TABLE locker_shipment_packages DROP FOREIGN KEY IF EXISTS locker_shipment_packages_ibfk_1;
-- @@
ALTER TABLE locker_shipment_packages DROP FOREIGN KEY IF EXISTS locker_shipment_packages_ibfk_2;
-- @@
ALTER TABLE locker_shipment_packages
  ADD FOREIGN KEY IF NOT EXISTS fk_lsp_shipment (shipment_id) REFERENCES locker_shipments(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY IF NOT EXISTS fk_lsp_package  (package_id)  REFERENCES packages(id)         ON DELETE RESTRICT,
  ADD UNIQUE KEY IF NOT EXISTS uq_lsp_package (package_id);   -- un paquete pertenece a un solo envío
-- @@
INSERT IGNORE INTO status_transitions (entity, from_status, to_status) VALUES
 ('shipment','pending','preparing'),('shipment','pending','ready'),('shipment','pending','cancelled'),
 ('shipment','preparing','ready'),('shipment','preparing','cancelled'),
 ('shipment','ready','dispatched'),('shipment','ready','cancelled'),
 ('shipment','dispatched','in_cuba'),('shipment','in_cuba','out_for_delivery'),
 ('shipment','in_cuba','delivered'),('shipment','out_for_delivery','delivered'),
 ('shipment','preparing','incident'),('shipment','ready','incident'),('shipment','dispatched','incident'),
 ('shipment','in_cuba','incident'),('shipment','out_for_delivery','incident'),
 ('shipment','incident','preparing'),('shipment','incident','ready'),('shipment','incident','dispatched'),
 ('shipment','incident','in_cuba'),('shipment','incident','out_for_delivery'),('shipment','incident','cancelled'),
 ('shipment','in_transit','customs'),('shipment','in_transit','delivered'),('shipment','in_transit','in_cuba'),
 ('shipment','in_transit','incident'),('shipment','customs','delivered'),('shipment','customs','out_for_delivery'),
 ('shipment','customs','incident');
-- @@
-- ════════════════════════════ TRIGGERS DE REGLAS DE NEGOCIO ════════════════════════════
-- Inmutabilidad de tarifas, costos internos y registro de estados
CREATE OR REPLACE TRIGGER trg_tariff_no_update BEFORE UPDATE ON tariff_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las tarifas son inmutables: crear una nueva versión';
-- @@
CREATE OR REPLACE TRIGGER trg_tariff_no_delete BEFORE DELETE ON tariff_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las tarifas no se eliminan';
-- @@
CREATE OR REPLACE TRIGGER trg_costs_no_update BEFORE UPDATE ON internal_cost_params FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los parámetros de costo son inmutables: crear una nueva versión';
-- @@
CREATE OR REPLACE TRIGGER trg_costs_no_delete BEFORE DELETE ON internal_cost_params FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los parámetros de costo no se eliminan';
-- @@
CREATE OR REPLACE TRIGGER trg_status_log_no_update BEFORE UPDATE ON status_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados es inmutable';
-- @@
CREATE OR REPLACE TRIGGER trg_status_log_no_delete BEFORE DELETE ON status_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados no se elimina';
-- @@
CREATE OR REPLACE TRIGGER trg_tariff_creator BEFORE INSERT ON tariff_versions FOR EACH ROW
BEGIN
  IF NEW.created_by IS NOT NULL AND (SELECT role FROM users WHERE id = NEW.created_by) <> 'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador puede crear tarifas';
  END IF;
END;
-- @@
-- ── Compras ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_purchases_bu BEFORE UPDATE ON purchases FOR EACH ROW
BEGIN
  IF NEW.code <> OLD.code OR NEW.user_id <> OLD.user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El código y el propietario de la compra no se pueden cambiar';
  END IF;
  IF NEW.status <> OLD.status AND NOT EXISTS (
       SELECT 1 FROM status_transitions WHERE entity = 'purchase' AND from_status = OLD.status AND to_status = NEW.status) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transición de estado de compra no permitida';
  END IF;
  IF OLD.status NOT IN ('registered','in_review')
     AND NOT (NEW.recipient_id <=> OLD.recipient_id AND NEW.store_taxes <=> OLD.store_taxes AND NEW.store_shipping <=> OLD.store_shipping
              AND NEW.store <=> OLD.store AND NEW.store_order_number <=> OLD.store_order_number) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La compra ya fue aceptada: sus datos no se pueden modificar';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_purchases_au AFTER UPDATE ON purchases FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('purchase', NEW.code, OLD.status, NEW.status, @app_user_id);
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_purchases_bd BEFORE DELETE ON purchases FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las compras no se eliminan: cancelar con cambio de estado';
-- @@
CREATE OR REPLACE TRIGGER trg_items_bi BEFORE INSERT ON purchase_items FOR EACH ROW
BEGIN
  IF (SELECT status FROM purchases WHERE id = NEW.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar productos a una compra ya aceptada';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_items_bu BEFORE UPDATE ON purchase_items FOR EACH ROW
BEGIN
  IF NEW.purchase_id <> OLD.purchase_id OR (SELECT status FROM purchases WHERE id = OLD.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los productos de una compra aceptada no se pueden modificar';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_items_bd BEFORE DELETE ON purchase_items FOR EACH ROW
BEGIN
  IF (SELECT status FROM purchases WHERE id = OLD.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los productos de una compra aceptada no se pueden eliminar';
  END IF;
END;
-- @@
-- ── Liquidaciones ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_settlements_bi BEFORE INSERT ON settlements FOR EACH ROW
BEGIN
  IF NEW.status <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una liquidación nace como estimación; se emite en un paso posterior';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_settlements_bu BEFORE UPDATE ON settlements FOR EACH ROW
BEGIN
  DECLARE v_base DECIMAL(14,2);
  DECLARE v_weight DECIMAL(12,3);
  DECLARE v_nulls INT;
  IF NEW.user_id <> OLD.user_id OR NEW.code <> OLD.code THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El código y el cliente de la liquidación no se pueden cambiar';
  END IF;
  IF NEW.status <> OLD.status AND NOT EXISTS (
       SELECT 1 FROM status_transitions WHERE entity = 'settlement' AND from_status = OLD.status AND to_status = NEW.status) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transición de estado de liquidación no permitida';
  END IF;
  IF OLD.status <> 'estimate' AND NOT (
       NEW.product_base <=> OLD.product_base AND NEW.commission <=> OLD.commission
       AND NEW.weight_billable_kg <=> OLD.weight_billable_kg AND NEW.shipping <=> OLD.shipping
       AND NEW.extra_charges <=> OLD.extra_charges AND NEW.total <=> OLD.total
       AND NEW.commission_rate <=> OLD.commission_rate AND NEW.sell_rate_per_kg <=> OLD.sell_rate_per_kg
       AND NEW.tariff_version_id <=> OLD.tariff_version_id AND NEW.shipment_id <=> OLD.shipment_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Liquidación emitida: es inmodificable. Emitir una nueva versión como ajuste';
  END IF;
  IF OLD.status = 'estimate' AND NEW.status = 'issued' THEN
    IF NEW.issued_by IS NULL OR (SELECT role FROM users WHERE id = NEW.issued_by) NOT IN ('agent','admin') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo atención o un administrador puede emitir liquidaciones';
    END IF;
    SELECT COALESCE(SUM(product_base),0), COALESCE(SUM(weight_kg),0), COALESCE(SUM(weight_kg IS NULL),0)
      INTO v_base, v_weight, v_nulls FROM settlement_lines WHERE settlement_id = OLD.id AND is_current = 1;
    IF v_base <> NEW.product_base THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La base de comisión no coincide con la suma de las compras de la liquidación';
    END IF;
    IF v_nulls > 0 OR v_weight <> NEW.weight_billable_kg THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El peso facturable no coincide con la suma de los pesos registrados';
    END IF;
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_settlements_au AFTER UPDATE ON settlements FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('settlement', NEW.code, OLD.status, NEW.status, @app_user_id);
    IF NEW.status = 'void' THEN
      UPDATE settlement_lines SET is_current = 0 WHERE settlement_id = NEW.id;
    END IF;
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_settlements_bd BEFORE DELETE ON settlements FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las liquidaciones no se eliminan: anular con nueva versión';
-- @@
CREATE OR REPLACE TRIGGER trg_lines_bu BEFORE UPDATE ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = OLD.settlement_id) <> 'estimate'
     AND NOT (NEW.product_base <=> OLD.product_base AND NEW.weight_kg <=> OLD.weight_kg AND NEW.purchase_id <=> OLD.purchase_id AND NEW.settlement_id <=> OLD.settlement_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las líneas de una liquidación emitida son inmodificables';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_lines_bi BEFORE INSERT ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = NEW.settlement_id) <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se agregan líneas a una liquidación emitida';
  END IF;
  IF (SELECT user_id FROM settlements WHERE id = NEW.settlement_id) <> (SELECT user_id FROM purchases WHERE id = NEW.purchase_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La compra pertenece a otro cliente';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_lines_bd BEFORE DELETE ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = OLD.settlement_id) <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las líneas de una liquidación emitida no se eliminan';
  END IF;
END;
-- @@
-- ── Pagos: solo personal autorizado, sin sobrepago, inmutables ───────────────────────────────
CREATE OR REPLACE TRIGGER trg_payments_bi BEFORE INSERT ON payments FOR EACH ROW
BEGIN
  DECLARE v_total DECIMAL(10,2);
  DECLARE v_status VARCHAR(20);
  DECLARE v_paid DECIMAL(12,2);
  DECLARE v_orig DECIMAL(10,2);
  DECLARE v_orig_settlement BIGINT UNSIGNED;
  IF (SELECT role FROM users WHERE id = NEW.received_by) NOT IN ('agent','admin') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo atención o administración puede registrar pagos';
  END IF;
  -- bloquea la liquidación: serializa pagos concurrentes sobre la misma liquidación
  SELECT total, status INTO v_total, v_status FROM settlements WHERE id = NEW.settlement_id FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM payments WHERE settlement_id = NEW.settlement_id;
  IF NEW.amount > 0 THEN
    IF v_status NOT IN ('issued','partial') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La liquidación no admite pagos en su estado actual';
    END IF;
    IF v_paid + NEW.amount > v_total THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago excede el saldo de la liquidación';
    END IF;
  ELSE
    SELECT amount, settlement_id INTO v_orig, v_orig_settlement FROM payments WHERE id = NEW.reversal_of_id;
    IF v_orig IS NULL OR v_orig <= 0 OR v_orig_settlement <> NEW.settlement_id OR NEW.amount <> -v_orig THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La contrapartida debe anular por completo un pago de la misma liquidación';
    END IF;
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW
BEGIN
  DECLARE v_total DECIMAL(10,2);
  DECLARE v_paid  DECIMAL(12,2);
  DECLARE v_status VARCHAR(20);
  SELECT total, status INTO v_total, v_status FROM settlements WHERE id = NEW.settlement_id;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM payments WHERE settlement_id = NEW.settlement_id;
  IF v_status IN ('issued','partial','paid') THEN
    UPDATE settlements
       SET status = CASE WHEN v_paid >= v_total THEN 'paid' WHEN v_paid > 0 THEN 'partial' ELSE 'issued' END
     WHERE id = NEW.settlement_id;
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_payments_bu BEFORE UPDATE ON payments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos son inmutables: registrar una contrapartida';
-- @@
CREATE OR REPLACE TRIGGER trg_payments_bd BEFORE DELETE ON payments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos no se eliminan: registrar una contrapartida';
-- @@
-- ── Envíos ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_shipments_bu BEFORE UPDATE ON locker_shipments FOR EACH ROW
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El propietario del envío no se puede cambiar';
  END IF;
  IF NEW.status <> OLD.status AND NOT EXISTS (
       SELECT 1 FROM status_transitions WHERE entity = 'shipment' AND from_status = OLD.status AND to_status = NEW.status) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transición de estado de envío no permitida';
  END IF;
  -- Condición para despachar: liquidación final pagada, guía del operador y pesos completos
  IF NEW.status = 'dispatched' AND OLD.status <> 'dispatched' THEN
    IF NEW.operator_guide IS NULL OR CHAR_LENGTH(TRIM(NEW.operator_guide)) < 3 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Despacho: falta la guía del operador';
    END IF;
    IF NEW.dispatch_override_by IS NOT NULL THEN
      IF (SELECT role FROM users WHERE id = NEW.dispatch_override_by) <> 'admin' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador puede autorizar una excepción de despacho';
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM settlements WHERE shipment_id = OLD.id AND status = 'paid') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Despacho: la liquidación final no está pagada por completo';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM locker_shipment_packages WHERE shipment_id = OLD.id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Despacho: el envío no tiene paquetes';
      END IF;
      IF EXISTS (SELECT 1 FROM locker_shipment_packages l JOIN packages p ON p.id = l.package_id
                  WHERE l.shipment_id = OLD.id AND (p.weight_kg IS NULL OR p.user_id IS NULL)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Despacho: hay paquetes sin peso o sin identificar';
      END IF;
    END IF;
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_shipments_au AFTER UPDATE ON locker_shipments FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('shipment', NEW.id, OLD.status, NEW.status, @app_user_id);
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_shipments_bd BEFORE DELETE ON locker_shipments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los envíos no se eliminan: cancelar con cambio de estado';
-- @@
CREATE OR REPLACE TRIGGER trg_lsp_bi BEFORE INSERT ON locker_shipment_packages FOR EACH ROW
BEGIN
  DECLARE v_pkg_user INT UNSIGNED;
  DECLARE v_ship_user INT UNSIGNED;
  DECLARE v_ship_status VARCHAR(20);
  SELECT user_id INTO v_pkg_user FROM packages WHERE id = NEW.package_id;
  SELECT user_id, status INTO v_ship_user, v_ship_status FROM locker_shipments WHERE id = NEW.shipment_id;
  IF v_pkg_user IS NULL OR v_pkg_user <> v_ship_user THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El paquete no está identificado o pertenece a otro cliente';
  END IF;
  IF v_ship_status NOT IN ('pending','preparing','ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar paquetes a un envío ya despachado';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_lsp_bd BEFORE DELETE ON locker_shipment_packages FOR EACH ROW
BEGIN
  IF (SELECT status FROM locker_shipments WHERE id = OLD.shipment_id) NOT IN ('pending','preparing','ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden quitar paquetes de un envío ya despachado';
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_packages_au AFTER UPDATE ON packages FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('package', NEW.id, OLD.status, NEW.status, @app_user_id);
  END IF;
END;
-- @@
CREATE OR REPLACE TRIGGER trg_packages_bd BEFORE DELETE ON packages FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los paquetes no se eliminan: marcar incidencia';
