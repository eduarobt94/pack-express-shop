-- Optimus Envíos — Usuarios de base de datos con MÍNIMO PRIVILEGIO (MariaDB)
-- Ejecutar UNA VEZ como administrador de la base, reemplazando los marcadores <...>.
-- Las contraseñas NO se guardan en el repositorio: generarlas con `openssl rand -base64 33`.
--
--   optimus_migrator : DDL. Solo para correr `php database/migrate.php up`. Nunca lo usa la app.
--   optimus_app      : lo usa la API. DML acotado por tabla; sin DDL, sin TRIGGER, sin DELETE donde no corresponde.
--   optimus_report   : solo lectura para reportes (sin tablas de credenciales ni costos internos).

CREATE USER IF NOT EXISTS 'optimus_migrator'@'localhost' IDENTIFIED BY '<PASSWORD_MIGRATOR>';
GRANT ALL PRIVILEGES ON `<DB_NAME>`.* TO 'optimus_migrator'@'localhost';

CREATE USER IF NOT EXISTS 'optimus_app'@'localhost' IDENTIFIED BY '<PASSWORD_APP>';
-- lectura/escritura operativa
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.users                    TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.suites                   TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.addresses        TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.purchases                TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.purchase_items   TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.packages                 TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.locker_shipments         TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON `<DB_NAME>`.locker_shipment_packages TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.settlements              TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.settlement_lines TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT         ON `<DB_NAME>`.payments                 TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT         ON `<DB_NAME>`.tariff_versions          TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT         ON `<DB_NAME>`.internal_cost_params     TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT         ON `<DB_NAME>`.status_log               TO 'optimus_app'@'localhost';
GRANT SELECT                 ON `<DB_NAME>`.status_transitions       TO 'optimus_app'@'localhost';
GRANT SELECT                 ON `<DB_NAME>`.provinces                TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DB_NAME>`.counters                 TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.refresh_tokens   TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.rate_limits      TO 'optimus_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DB_NAME>`.password_reset_tokens TO 'optimus_app'@'localhost';
-- modelo anterior: solo lectura histórica
GRANT SELECT ON `<DB_NAME>`.orders      TO 'optimus_app'@'localhost';
GRANT SELECT ON `<DB_NAME>`.order_items TO 'optimus_app'@'localhost';
GRANT SELECT, UPDATE ON `<DB_NAME>`.pre_alerts TO 'optimus_app'@'localhost';

CREATE USER IF NOT EXISTS 'optimus_report'@'localhost' IDENTIFIED BY '<PASSWORD_REPORT>';
GRANT SELECT ON `<DB_NAME>`.purchases    TO 'optimus_report'@'localhost';
GRANT SELECT ON `<DB_NAME>`.settlements  TO 'optimus_report'@'localhost';
GRANT SELECT ON `<DB_NAME>`.payments     TO 'optimus_report'@'localhost';
GRANT SELECT ON `<DB_NAME>`.locker_shipments TO 'optimus_report'@'localhost';
FLUSH PRIVILEGES;
