-- Optimus Envíos — Migración 002: roles, provincias de Cuba, destinatarios, sesiones y rate limit
-- Fase EXPANSIÓN: solo agrega estructuras. No elimina ni transforma datos existentes.

-- ── Roles de usuario (el rol vive en la base, no en el token ni en el frontend) ──────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role ENUM('customer','agent','warehouse','admin') NOT NULL DEFAULT 'customer' AFTER status,
  ADD COLUMN IF NOT EXISTS token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER role,
  ADD COLUMN IF NOT EXISTS failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER token_version,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL AFTER failed_logins;
-- @@
ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS chk_users_email CHECK (email LIKE '%_@_%._%');
-- @@
-- Los clientes residen en Uruguay: nuevo valor por defecto (los registros existentes no cambian).
ALTER TABLE suites MODIFY country CHAR(2) NOT NULL DEFAULT 'UY';
-- @@
-- ── Provincias de Cuba (catálogo cerrado; reemplaza texto libre CHAR(3)) ──────────────────
CREATE TABLE IF NOT EXISTS provinces (
  code  CHAR(3)      NOT NULL PRIMARY KEY,
  name  VARCHAR(60)  NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
INSERT IGNORE INTO provinces (code, name) VALUES
 ('PRI','Pinar del Río'),('ART','Artemisa'),('HAB','La Habana'),('MAY','Mayabeque'),
 ('MTZ','Matanzas'),('CFG','Cienfuegos'),('VCL','Villa Clara'),('SSP','Sancti Spíritus'),
 ('CAV','Ciego de Ávila'),('CMG','Camagüey'),('LTU','Las Tunas'),('HOL','Holguín'),
 ('GRA','Granma'),('SCU','Santiago de Cuba'),('GTM','Guantánamo'),('IJV','Isla de la Juventud');
-- @@
-- ── Destinatarios (addresses): integridad y documento cifrado opcional ───────────────────
-- Precondición: ninguna dirección existente puede tener una provincia fuera del catálogo.
-- @@assert addresses con provincia inexistente (corregir los datos antes de migrar)
SELECT COUNT(*) FROM addresses a LEFT JOIN provinces p ON p.code = a.province WHERE p.code IS NULL;
-- @@
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS id_doc_enc VARBINARY(512) NULL COMMENT 'Documento de identidad cifrado (AES-256-GCM, opcional). Sustituye a ci.' AFTER ci,
  ADD COLUMN IF NOT EXISTS default_owner INT UNSIGNED AS (IF(is_default = 1, user_id, NULL)) VIRTUAL;
-- @@
ALTER TABLE addresses
  ADD FOREIGN KEY IF NOT EXISTS fk_addresses_province (province) REFERENCES provinces(code) ON UPDATE CASCADE ON DELETE RESTRICT;
-- @@
-- Un solo destinatario predeterminado por cliente (garantizado por la base, no por la app).
-- Precondición: no puede haber hoy dos predeterminados del mismo usuario.
-- @@assert usuarios con más de un destinatario predeterminado
SELECT COUNT(*) FROM (SELECT user_id FROM addresses WHERE is_default = 1 GROUP BY user_id HAVING COUNT(*) > 1) x;
-- @@
ALTER TABLE addresses ADD UNIQUE KEY IF NOT EXISTS uq_addresses_one_default (default_owner);
-- @@
ALTER TABLE addresses
  ADD CONSTRAINT IF NOT EXISTS chk_addresses_recipient CHECK (CHAR_LENGTH(TRIM(recipient)) >= 2),
  ADD CONSTRAINT IF NOT EXISTS chk_addresses_default   CHECK (is_default IN (0,1));
-- @@
-- ── Sesiones: refresh tokens con rotación y revocación ───────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  token_hash    CHAR(64)     NOT NULL,                -- SHA-256; el token en claro no se guarda
  family_id     CHAR(32)     NOT NULL,                -- una familia por login; reutilización => revoca toda la familia
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  replaced_by   BIGINT UNSIGNED NULL,
  created_ip    VARCHAR(45)  NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id, revoked_at),
  KEY idx_refresh_family (family_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- ── Rate limiting compartido entre procesos (reemplaza archivos en /tmp) ───────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key    CHAR(64)     NOT NULL,                -- SHA-256(ámbito|identificador|ventana)
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  window_start  INT UNSIGNED NOT NULL,
  PRIMARY KEY (bucket_key),
  KEY idx_rate_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
-- ── Tokens de reseteo: guardar solo el hash y atarlo a un usuario existente ─────────────────
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS user_id INT UNSIGNED NULL,
  ADD KEY IF NOT EXISTS idx_prt_expires (expires_at);
