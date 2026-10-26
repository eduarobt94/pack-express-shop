-- ─────────────────────────────────────────────────────────────────────────────
-- Optimus Envíos — Migración 001: línea base (esquema v1.0 original)
-- Idempotente: se puede aplicar sobre una base vacía o sobre una base v1.0 ya existente.
-- Motor objetivo: MariaDB >= 10.4 · utf8mb4. Cada bloque separado por '-- @@' se ejecuta por separado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USUARIOS (clientes del casillero)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(120)  NOT NULL,
  email               VARCHAR(150)  NOT NULL UNIQUE,
  phone               VARCHAR(30),
  password_hash       VARCHAR(255)  NOT NULL,
  tier                ENUM('standard','frequent','vip') DEFAULT 'standard',
  status              ENUM('active','suspended','pending') DEFAULT 'pending',
  email_verified_at   DATETIME,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SUITES (casillero virtual, una por usuario)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suites (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL UNIQUE,
  suite_id      VARCHAR(25)   NOT NULL UNIQUE,  -- PKX-CU-096582
  country       CHAR(2)       NOT NULL DEFAULT 'CU',
  member_since  DATE          NOT NULL,
  status        ENUM('active','suspended') DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PAQUETES (llegan al casillero en Miami)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id               VARCHAR(20)   PRIMARY KEY,           -- WR-2026-00101
  user_id          INT UNSIGNED  NOT NULL,
  suite_id         VARCHAR(25)   NOT NULL,
  tracking_number  VARCHAR(100)  NOT NULL,
  store            VARCHAR(100),
  description      TEXT,
  declared_value   DECIMAL(10,2) DEFAULT 0.00,
  weight_kg        DECIMAL(7,3),
  length_cm        DECIMAL(6,1),
  width_cm         DECIMAL(6,1),
  height_cm        DECIMAL(6,1),
  status           ENUM('in_transit','received','verifying','no_docs','ready','retained','shipped')
                   DEFAULT 'in_transit',
  received_at      DATETIME,
  photo_url        VARCHAR(500),
  photo_requested  TINYINT(1)    DEFAULT 0,
  insured          TINYINT(1)    DEFAULT 0,
  insurance_cost   DECIMAL(8,2)  DEFAULT 0.00,
  retained_reason  TEXT,
  notes            JSON,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status   (user_id, status),
  INDEX idx_tracking      (tracking_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRE-ALERTAS (declaradas por el cliente antes de que lleguen)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pre_alerts (
  id               VARCHAR(20)   PRIMARY KEY,           -- PA-2026-00051
  user_id          INT UNSIGNED  NOT NULL,
  suite_id         VARCHAR(25)   NOT NULL,
  tracking_number  VARCHAR(100),
  store            VARCHAR(100),
  description      TEXT,
  declared_value   DECIMAL(10,2) DEFAULT 0.00,
  pieces           TINYINT UNSIGNED DEFAULT 1,
  carrier          VARCHAR(50),
  instructions     TEXT,
  factura_path     VARCHAR(500),
  status           ENUM('pending','received','cancelled') DEFAULT 'pending',
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ENVÍOS DE CASILLERO (paquetes del locker → Cuba)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locker_shipments (
  id                    VARCHAR(20)   PRIMARY KEY,       -- SH-2026-00009
  user_id               INT UNSIGNED  NOT NULL,
  suite_id              VARCHAR(25)   NOT NULL,
  address_id            INT UNSIGNED,
  total_weight_kg       DECIMAL(7,3),
  volumetric_weight_kg  DECIMAL(7,3),
  freight               DECIMAL(10,2) DEFAULT 0.00,
  handling              DECIMAL(10,2) DEFAULT 0.00,
  insurance             DECIMAL(10,2) DEFAULT 0.00,
  total                 DECIMAL(10,2) DEFAULT 0.00,
  status                ENUM('pending','in_transit','customs','delivered','cancelled')
                        DEFAULT 'pending',
  created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
  dispatched_at         DATETIME,
  delivered_at          DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PAQUETES POR ENVÍO (N:M)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locker_shipment_packages (
  shipment_id  VARCHAR(20) NOT NULL,
  package_id   VARCHAR(20) NOT NULL,
  PRIMARY KEY (shipment_id, package_id),
  FOREIGN KEY (shipment_id) REFERENCES locker_shipments(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id)  REFERENCES packages(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DIRECCIONES DE ENTREGA (Cuba)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  label         VARCHAR(100),                            -- "Mamá — La Habana"
  recipient     VARCHAR(120)  NOT NULL,
  ci            VARCHAR(20),                             -- carnet de identidad
  phone         VARCHAR(30),
  province      CHAR(3)       NOT NULL,                  -- HAB, SCU, CMG …
  municipality  VARCHAR(80),
  street        TEXT,
  is_default    TINYINT(1)    DEFAULT 0,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ÓRDENES DE TIENDA (compras de productos del marketplace)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          VARCHAR(25)   PRIMARY KEY,                 -- PKX-HAB-2026-00847
  user_id     INT UNSIGNED  NOT NULL,
  address_id  INT UNSIGNED,
  method      ENUM('standard','express') DEFAULT 'standard',
  status      ENUM('pending','processing','in_transit','customs','delivered','cancelled')
              DEFAULT 'pending',
  subtotal    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shipping    DECIMAL(10,2) DEFAULT 0.00,
  customs     DECIMAL(10,2) DEFAULT 0.00,
  total       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  eta         VARCHAR(60),
  paid_at     DATETIME,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ÍTEMS DE ÓRDENES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  order_id    VARCHAR(25)    NOT NULL,
  product_id  VARCHAR(80)    NOT NULL,                   -- slug del producto
  name        VARCHAR(200)   NOT NULL,
  qty         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2)  NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TOKENS DE RESET DE CONTRASEÑA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  email       VARCHAR(150)  NOT NULL PRIMARY KEY,
  token       VARCHAR(100)  NOT NULL,
  expires_at  DATETIME      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
