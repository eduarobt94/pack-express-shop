-- Optimus Envíos — Migración 006: seguimientos de la tienda/transportista por compra
-- La especificación pide "seguimientos de la tienda o transportista" y poder agregar más si la compra se divide.
-- Es un dato declarado por el cliente (no sustituye al paquete recibido): no tiene efecto en cobros ni estados.

CREATE TABLE IF NOT EXISTS purchase_trackings (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id      BIGINT UNSIGNED NOT NULL,
  tracking_number  VARCHAR(60) NOT NULL,
  carrier          VARCHAR(40) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchase_tracking (purchase_id, tracking_number),
  KEY idx_purchase_tracking_number (tracking_number),
  CONSTRAINT fk_purchase_tracking_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_tracking_number CHECK (CHAR_LENGTH(TRIM(tracking_number)) >= 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
