-- Optimus Envíos — Migración 005: marca como OBSOLETAS las estructuras del modelo anterior
-- No elimina nada (fase EXPANSIÓN). La eliminación física es una migración de CONTRACCIÓN
-- posterior que requiere respaldo verificado y autorización explícita (docs/database-migration.md).

ALTER TABLE orders
  COMMENT = 'OBSOLETA (modelo anterior: el producto se pagaba dentro de la plataforma). Solo lectura histórica. Sustituida por purchases + settlements.';
-- @@
ALTER TABLE order_items
  COMMENT = 'OBSOLETA — ver orders. Sustituida por purchase_items.';
-- @@
ALTER TABLE pre_alerts
  COMMENT = 'OBSOLETA: las pre-alertas pasan a ser compras registradas (purchases). Se conserva por historial.';
-- @@
ALTER TABLE addresses
  MODIFY ci VARCHAR(20) NULL COMMENT 'OBSOLETA: reemplazada por id_doc_enc (cifrada). Migrar con database/scripts/encrypt_recipient_docs.php y luego vaciar.';
-- @@
ALTER TABLE users
  MODIFY tier ENUM('standard','frequent','vip') NULL COMMENT 'OBSOLETA: el modelo de negocio actual no usa niveles de cliente.';
-- @@
ALTER TABLE packages
  MODIFY insured TINYINT(1) NULL COMMENT 'OBSOLETA: el seguro no forma parte del alcance actual.',
  MODIFY insurance_cost DECIMAL(8,2) NULL COMMENT 'OBSOLETA — ver insured.';
-- @@
ALTER TABLE locker_shipments
  MODIFY volumetric_weight_kg DECIMAL(7,3) NULL COMMENT 'OBSOLETA: el cobro por volumen está pendiente de definición comercial.',
  MODIFY handling   DECIMAL(10,2) NULL COMMENT 'OBSOLETA: el cobro vigente es comisión + kg (ver settlements).',
  MODIFY insurance  DECIMAL(10,2) NULL COMMENT 'OBSOLETA: el seguro no forma parte del alcance actual.';
