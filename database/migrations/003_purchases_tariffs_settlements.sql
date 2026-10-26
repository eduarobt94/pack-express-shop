-- Optimus Envíos — Migración 003: compras, tarifas versionadas, liquidaciones y pagos
-- Fase EXPANSIÓN: tablas nuevas. `orders`/`order_items` (modelo anterior de pago de producto
-- dentro de la plataforma) se conservan intactas hasta la fase de CONTRACCIÓN (ver docs/database-migration.md).

-- ── Contadores atómicos para códigos públicos (sin SELECT MAX + INSERT: sin carreras) ──────
CREATE TABLE IF NOT EXISTS counters (
  name  VARCHAR(40)       NOT NULL,
  year  SMALLINT UNSIGNED NOT NULL,
  seq   INT UNSIGNED      NOT NULL DEFAULT 0,
  PRIMARY KEY (name, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- Clave compuesta que permite a otras tablas garantizar que el destinatario es del mismo cliente.
ALTER TABLE addresses ADD UNIQUE KEY IF NOT EXISTS uq_addresses_id_user (id, user_id);
-- @@
-- ── Máquina de estados declarativa ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS status_transitions (
  entity       ENUM('purchase','settlement','shipment') NOT NULL,
  from_status  VARCHAR(30) NOT NULL,
  to_status    VARCHAR(30) NOT NULL,
  PRIMARY KEY (entity, from_status, to_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
INSERT IGNORE INTO status_transitions (entity, from_status, to_status) VALUES
 ('purchase','registered','in_review'),('purchase','registered','accepted'),('purchase','registered','cancelled'),
 ('purchase','in_review','accepted'),('purchase','in_review','cancelled'),
 ('purchase','accepted','partially_received'),('purchase','accepted','fully_received'),('purchase','accepted','cancelled'),
 ('purchase','partially_received','fully_received'),('purchase','partially_received','cancelled'),
 ('settlement','estimate','issued'),('settlement','estimate','void'),
 ('settlement','issued','partial'),('settlement','issued','paid'),('settlement','issued','void'),
 ('settlement','partial','paid'),('settlement','partial','issued'),('settlement','partial','refund_pending'),
 ('settlement','paid','partial'),('settlement','paid','issued'),('settlement','paid','refund_pending'),
 ('settlement','refund_pending','void');
-- @@
CREATE TABLE IF NOT EXISTS status_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity      ENUM('purchase','settlement','shipment','package') NOT NULL,
  entity_id   VARCHAR(30)  NOT NULL,
  from_status VARCHAR(30)  NULL,
  to_status   VARCHAR(30)  NOT NULL,
  changed_by  INT UNSIGNED NULL,                       -- @app_user_id de la sesión; NULL = sistema
  note        VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status_log_entity (entity, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- ── Compras (pedidos de tienda registrados por el cliente; el producto NO se paga en Optimus) ──
CREATE TABLE IF NOT EXISTS purchases (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code                VARCHAR(25)  NOT NULL,                       -- OPT-HAB-2026-00847
  user_id             INT UNSIGNED NOT NULL,
  recipient_id        INT UNSIGNED NOT NULL,
  store               VARCHAR(100) NOT NULL,
  store_order_number  VARCHAR(100) NOT NULL,
  purchased_on        DATE         NOT NULL,
  currency            CHAR(3)      NOT NULL DEFAULT 'USD',
  store_taxes         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  store_shipping      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  receipt_path        VARCHAR(500) NOT NULL,                       -- comprobante legible (obligatorio)
  status              ENUM('registered','in_review','accepted','partially_received','fully_received','cancelled')
                      NOT NULL DEFAULT 'registered',
  terms_version       VARCHAR(20)  NOT NULL,                       -- condiciones aceptadas (versión y fecha)
  terms_accepted_at   DATETIME     NOT NULL,
  notes               VARCHAR(500) NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchases_code (code),
  UNIQUE KEY uq_purchases_id_user (id, user_id),
  UNIQUE KEY uq_purchases_store_order (user_id, store, store_order_number),
  KEY idx_purchases_user_status (user_id, status),
  CONSTRAINT fk_purchases_user      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  -- el destinatario debe pertenecer al MISMO cliente (impide asignar destinatarios ajenos)
  CONSTRAINT fk_purchases_recipient FOREIGN KEY (recipient_id, user_id) REFERENCES addresses(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_purchases_currency CHECK (currency = 'USD'),
  CONSTRAINT chk_purchases_amounts  CHECK (store_taxes >= 0 AND store_shipping >= 0),
  CONSTRAINT chk_purchases_store    CHECK (CHAR_LENGTH(TRIM(store)) >= 2 AND CHAR_LENGTH(TRIM(store_order_number)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE IF NOT EXISTS purchase_items (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id  BIGINT UNSIGNED NOT NULL,
  description  VARCHAR(300)  NOT NULL,
  url          VARCHAR(1000) NULL,
  model        VARCHAR(100)  NULL,
  qty          SMALLINT UNSIGNED NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  discount     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  line_amount  DECIMAL(12,2) AS (qty * unit_price - discount) STORED,   -- importe de productos (base de la comisión)
  KEY idx_purchase_items_purchase (purchase_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
  CONSTRAINT chk_items_qty      CHECK (qty BETWEEN 1 AND 1000),
  CONSTRAINT chk_items_price    CHECK (unit_price >= 0 AND unit_price <= 100000),
  CONSTRAINT chk_items_discount CHECK (discount >= 0 AND discount <= qty * unit_price),
  CONSTRAINT chk_items_url      CHECK (url IS NULL OR url REGEXP '^https?://'),
  CONSTRAINT chk_items_desc     CHECK (CHAR_LENGTH(TRIM(description)) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- ── Tarifas versionadas e inmutables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tariff_versions (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  commission_rate   DECIMAL(5,4) NOT NULL,                 -- 0.1000 = 10%
  sell_rate_per_kg  DECIMAL(8,2) NOT NULL,                 -- tarifa de venta USD/kg
  effective_from    DATETIME     NOT NULL,
  is_reference      TINYINT(1)   NOT NULL DEFAULT 1,       -- 1 = valor de referencia, no confirmado por Optimus
  notes             VARCHAR(255) NULL,
  created_by        INT UNSIGNED NULL,                     -- NULL = sembrada por migración
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tariff_effective (effective_from),
  CONSTRAINT fk_tariff_user  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_tariff_rate CHECK (commission_rate >= 0 AND commission_rate <= 0.5),
  CONSTRAINT chk_tariff_kg   CHECK (sell_rate_per_kg > 0 AND sell_rate_per_kg <= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- Parámetros de COSTO INTERNO (nunca se exponen al cliente).
CREATE TABLE IF NOT EXISTS internal_cost_params (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transport_per_lb   DECIMAL(8,2) NOT NULL,
  packaging          DECIMAL(8,2) NOT NULL,
  delivery           DECIMAL(8,2) NOT NULL,
  effective_from     DATETIME     NOT NULL,
  notes              VARCHAR(255) NULL,
  created_by         INT UNSIGNED NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_costs_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_costs_pos CHECK (transport_per_lb >= 0 AND packaging >= 0 AND delivery >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
INSERT INTO tariff_versions (commission_rate, sell_rate_per_kg, effective_from, is_reference, notes)
SELECT 0.1000, 11.00, '2026-10-24 00:00:00', 1, 'REFERENCIA del documento de alcance v1 — pendiente de confirmación de Optimus'
WHERE NOT EXISTS (SELECT 1 FROM tariff_versions);
-- @@
INSERT INTO internal_cost_params (transport_per_lb, packaging, delivery, effective_from, notes)
SELECT 3.50, 10.00, 15.00, '2026-10-24 00:00:00', 'REFERENCIA interna inicial — unidad de embalaje/entrega por confirmar'
WHERE NOT EXISTS (SELECT 1 FROM internal_cost_params);
-- @@
-- ── Liquidaciones ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code                VARCHAR(20)  NOT NULL,                       -- LQ-2026-00001
  user_id             INT UNSIGNED NOT NULL,
  shipment_id         VARCHAR(20)  NULL,
  version             INT UNSIGNED NOT NULL DEFAULT 1,
  supersedes_id       BIGINT UNSIGNED NULL,
  tariff_version_id   BIGINT UNSIGNED NOT NULL,
  commission_rate     DECIMAL(5,4) NOT NULL,                       -- copia: la tarifa aplicada no cambia nunca
  sell_rate_per_kg    DECIMAL(8,2) NOT NULL,
  product_base        DECIMAL(12,2) NOT NULL,
  commission          DECIMAL(10,2) NOT NULL,
  weight_billable_kg  DECIMAL(8,3) NULL,
  shipping            DECIMAL(10,2) NULL,
  extra_charges       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  extra_charges_note  VARCHAR(255) NULL,
  total               DECIMAL(10,2) NULL,
  status              ENUM('estimate','issued','partial','paid','refund_pending','void') NOT NULL DEFAULT 'estimate',
  issued_by           INT UNSIGNED NULL,
  issued_at           DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settlements_code (code),
  UNIQUE KEY uq_settlements_supersedes (supersedes_id),
  KEY idx_settlements_user_status (user_id, status),
  KEY idx_settlements_shipment (shipment_id),
  CONSTRAINT fk_settlements_user      FOREIGN KEY (user_id)           REFERENCES users(id)             ON DELETE RESTRICT,
  CONSTRAINT fk_settlements_shipment  FOREIGN KEY (shipment_id)       REFERENCES locker_shipments(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_settlements_super     FOREIGN KEY (supersedes_id)     REFERENCES settlements(id)       ON DELETE RESTRICT,
  CONSTRAINT fk_settlements_tariff    FOREIGN KEY (tariff_version_id) REFERENCES tariff_versions(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_settlements_issuer    FOREIGN KEY (issued_by)         REFERENCES users(id)             ON DELETE RESTRICT,
  CONSTRAINT chk_settle_money   CHECK (product_base >= 0 AND commission >= 0 AND extra_charges >= 0),
  -- reglas de cálculo aplicadas por la base de datos (no solo por la aplicación)
  CONSTRAINT chk_settle_comm    CHECK (commission = ROUND(product_base * commission_rate, 2)),
  CONSTRAINT chk_settle_weight  CHECK ((weight_billable_kg IS NULL) = (shipping IS NULL) AND (weight_billable_kg IS NULL OR weight_billable_kg > 0)),
  CONSTRAINT chk_settle_ship    CHECK (shipping IS NULL OR shipping = ROUND(weight_billable_kg * sell_rate_per_kg, 2)),
  CONSTRAINT chk_settle_total   CHECK (total IS NULL OR (shipping IS NOT NULL AND total = commission + shipping + extra_charges)),
  CONSTRAINT chk_settle_extra   CHECK (extra_charges = 0 OR (extra_charges_note IS NOT NULL AND CHAR_LENGTH(extra_charges_note) >= 5)),
  CONSTRAINT chk_settle_issued  CHECK (status IN ('estimate','void') OR (total IS NOT NULL AND issued_by IS NOT NULL AND issued_at IS NOT NULL)),
  CONSTRAINT chk_settle_version CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE IF NOT EXISTS settlement_lines (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  settlement_id   BIGINT UNSIGNED NOT NULL,
  purchase_id     BIGINT UNSIGNED NOT NULL,
  product_base    DECIMAL(12,2)   NOT NULL,
  weight_kg       DECIMAL(8,3)    NULL,
  is_current      TINYINT(1)      NOT NULL DEFAULT 1,
  current_purchase BIGINT UNSIGNED AS (IF(is_current = 1, purchase_id, NULL)) VIRTUAL,
  UNIQUE KEY uq_lines_settlement_purchase (settlement_id, purchase_id),
  -- una compra no puede estar en dos liquidaciones vigentes: no se duplica comisión, peso ni cargos
  UNIQUE KEY uq_lines_current_purchase (current_purchase),
  CONSTRAINT fk_lines_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lines_purchase   FOREIGN KEY (purchase_id)   REFERENCES purchases(id)   ON DELETE RESTRICT,
  CONSTRAINT chk_lines CHECK (product_base >= 0 AND (weight_kg IS NULL OR weight_kg > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- ── Pagos (inmutables; las correcciones son contrapartidas negativas) ───────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  settlement_id    BIGINT UNSIGNED NOT NULL,
  amount           DECIMAL(10,2)   NOT NULL,                     -- en USD
  reversal_of_id   BIGINT UNSIGNED NULL,
  currency_original CHAR(3)        NOT NULL DEFAULT 'USD',
  amount_original  DECIMAL(12,2)   NOT NULL,
  fx_rate          DECIMAL(12,4)   NULL,                         -- UYU por USD aplicado
  method           ENUM('cash','transfer','card_pos','other') NOT NULL,
  branch           VARCHAR(80)     NOT NULL,
  received_by      INT UNSIGNED    NOT NULL,
  receipt_ref      VARCHAR(80)     NOT NULL,
  paid_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_receipt (branch, receipt_ref),
  UNIQUE KEY uq_payments_reversal (reversal_of_id),
  KEY idx_payments_settlement (settlement_id),
  CONSTRAINT fk_payments_settlement FOREIGN KEY (settlement_id)  REFERENCES settlements(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_reversal   FOREIGN KEY (reversal_of_id) REFERENCES payments(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_payments_employee   FOREIGN KEY (received_by)    REFERENCES users(id)       ON DELETE RESTRICT,
  CONSTRAINT chk_payments_sign CHECK ((amount > 0 AND reversal_of_id IS NULL) OR (amount < 0 AND reversal_of_id IS NOT NULL)),
  CONSTRAINT chk_payments_cur  CHECK (currency_original IN ('USD','UYU')),
  CONSTRAINT chk_payments_fx   CHECK ((currency_original = 'USD' AND fx_rate IS NULL AND amount_original = amount)
                                   OR (currency_original = 'UYU' AND fx_rate IS NOT NULL AND fx_rate > 0)),
  CONSTRAINT chk_payments_ref  CHECK (CHAR_LENGTH(TRIM(receipt_ref)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
