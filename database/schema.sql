-- Optimus Envíos — INSTANTÁNEA del esquema tras las migraciones 001–005 (solo referencia).
-- La fuente de verdad son database/migrations/*.sql; este archivo se regenera con mysqldump --no-data.
-- NO usar para crear la base: ejecutar `php database/migrate.php up`.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `addresses` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `recipient` varchar(120) NOT NULL,
  `ci` varchar(20) DEFAULT NULL COMMENT 'OBSOLETA: reemplazada por id_doc_enc (cifrada). Migrar con database/scripts/encrypt_recipient_docs.php y luego vaciar.',
  `id_doc_enc` varbinary(512) DEFAULT NULL COMMENT 'Documento de identidad cifrado (AES-256-GCM, opcional). Sustituye a ci.',
  `phone` varchar(30) DEFAULT NULL,
  `province` char(3) NOT NULL,
  `municipality` varchar(80) DEFAULT NULL,
  `street` text DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `default_owner` int(10) unsigned GENERATED ALWAYS AS (if(`is_default` = 1,`user_id`,NULL)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_addresses_id_user` (`id`,`user_id`),
  UNIQUE KEY `uq_addresses_one_default` (`default_owner`),
  KEY `idx_user` (`user_id`),
  KEY `fk_addresses_province` (`province`),
  CONSTRAINT `fk_addresses_province` FOREIGN KEY (`province`) REFERENCES `provinces` (`code`) ON UPDATE CASCADE,
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_addresses_recipient` CHECK (char_length(trim(`recipient`)) >= 2),
  CONSTRAINT `chk_addresses_default` CHECK (`is_default` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `counters` (
  `name` varchar(40) NOT NULL,
  `year` smallint(5) unsigned NOT NULL,
  `seq` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`name`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `internal_cost_params` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transport_per_lb` decimal(8,2) NOT NULL,
  `packaging` decimal(8,2) NOT NULL,
  `delivery` decimal(8,2) NOT NULL,
  `effective_from` datetime NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_costs_user` (`created_by`),
  CONSTRAINT `fk_costs_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_costs_pos` CHECK (`transport_per_lb` >= 0 and `packaging` >= 0 and `delivery` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_costs_no_update BEFORE UPDATE ON internal_cost_params FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los parámetros de costo son inmutables: crear una nueva versión' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_costs_no_delete BEFORE DELETE ON internal_cost_params FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los parámetros de costo no se eliminan' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `locker_shipment_packages` (
  `shipment_id` varchar(20) NOT NULL,
  `package_id` varchar(20) NOT NULL,
  PRIMARY KEY (`shipment_id`,`package_id`),
  UNIQUE KEY `uq_lsp_package` (`package_id`),
  CONSTRAINT `fk_lsp_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`),
  CONSTRAINT `fk_lsp_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `locker_shipments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_lsp_bi BEFORE INSERT ON locker_shipment_packages FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_lsp_bd BEFORE DELETE ON locker_shipment_packages FOR EACH ROW
BEGIN
  IF (SELECT status FROM locker_shipments WHERE id = OLD.shipment_id) NOT IN ('pending','preparing','ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden quitar paquetes de un envío ya despachado';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `locker_shipments` (
  `id` varchar(20) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `suite_id` varchar(25) NOT NULL,
  `address_id` int(10) unsigned DEFAULT NULL,
  `total_weight_kg` decimal(7,3) DEFAULT NULL,
  `volumetric_weight_kg` decimal(7,3) DEFAULT NULL COMMENT 'OBSOLETA: el cobro por volumen está pendiente de definición comercial.',
  `freight` decimal(10,2) DEFAULT 0.00,
  `handling` decimal(10,2) DEFAULT NULL COMMENT 'OBSOLETA: el cobro vigente es comisión + kg (ver settlements).',
  `insurance` decimal(10,2) DEFAULT NULL COMMENT 'OBSOLETA: el seguro no forma parte del alcance actual.',
  `total` decimal(10,2) DEFAULT 0.00,
  `status` enum('pending','in_transit','customs','delivered','cancelled','preparing','ready','dispatched','in_cuba','out_for_delivery','incident') NOT NULL DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `dispatched_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `operator_guide` varchar(100) DEFAULT NULL COMMENT 'Guía del operador de transporte',
  `dispatch_override_by` int(10) unsigned DEFAULT NULL,
  `dispatch_override_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shipments_id_user` (`id`,`user_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `fk_shipments_recipient` (`address_id`,`user_id`),
  KEY `fk_shipments_override` (`dispatch_override_by`),
  CONSTRAINT `fk_shipments_override` FOREIGN KEY (`dispatch_override_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_shipments_recipient` FOREIGN KEY (`address_id`, `user_id`) REFERENCES `addresses` (`id`, `user_id`),
  CONSTRAINT `fk_shipments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_shipments_money` CHECK (`freight` >= 0 and `handling` >= 0 and `insurance` >= 0 and `total` >= 0),
  CONSTRAINT `chk_shipments_weight` CHECK (`total_weight_kg` is null or `total_weight_kg` > 0),
  CONSTRAINT `chk_shipments_override` CHECK (`dispatch_override_by` is null or char_length(`dispatch_override_reason`) >= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_shipments_bu BEFORE UPDATE ON locker_shipments FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_shipments_au AFTER UPDATE ON locker_shipments FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('shipment', NEW.id, OLD.status, NEW.status, @app_user_id);
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_shipments_bd BEFORE DELETE ON locker_shipments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los envíos no se eliminan: cancelar con cambio de estado' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(25) NOT NULL,
  `product_id` varchar(80) NOT NULL,
  `name` varchar(200) NOT NULL,
  `qty` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OBSOLETA — ver orders. Sustituida por purchase_items.';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` varchar(25) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `address_id` int(10) unsigned DEFAULT NULL,
  `method` enum('standard','express') DEFAULT 'standard',
  `status` enum('pending','processing','in_transit','customs','delivered','cancelled') DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `shipping` decimal(10,2) DEFAULT 0.00,
  `customs` decimal(10,2) DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `eta` varchar(60) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `address_id` (`address_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OBSOLETA (modelo anterior: el producto se pagaba dentro de la plataforma). Solo lectura histórica. Sustituida por purchases + settlements.';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `packages` (
  `id` varchar(20) NOT NULL,
  `user_id` int(10) unsigned DEFAULT NULL COMMENT 'NULL = paquete no identificado (bandeja de revisión)',
  `suite_id` varchar(25) DEFAULT NULL,
  `purchase_id` bigint(20) unsigned DEFAULT NULL,
  `tracking_number` varchar(100) NOT NULL,
  `store` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `declared_value` decimal(10,2) DEFAULT 0.00,
  `weight_kg` decimal(7,3) DEFAULT NULL,
  `length_cm` decimal(6,1) DEFAULT NULL,
  `width_cm` decimal(6,1) DEFAULT NULL,
  `height_cm` decimal(6,1) DEFAULT NULL,
  `status` enum('in_transit','received','verifying','no_docs','ready','retained','shipped','pending_reception','unidentified','received_us','preparing','dispatched','in_cuba','out_for_delivery','delivered','incident') NOT NULL DEFAULT 'pending_reception',
  `received_at` datetime DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `photo_requested` tinyint(1) DEFAULT 0,
  `insured` tinyint(1) DEFAULT NULL COMMENT 'OBSOLETA: el seguro no forma parte del alcance actual.',
  `insurance_cost` decimal(8,2) DEFAULT NULL COMMENT 'OBSOLETA — ver insured.',
  `retained_reason` text DEFAULT NULL,
  `notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`notes`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `weight_original` decimal(9,3) DEFAULT NULL COMMENT 'Peso tal como fue cargado, sin perder el dato original',
  `weight_unit` enum('kg','lb') DEFAULT NULL,
  `observed_condition` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_tracking` (`tracking_number`),
  KEY `fk_packages_purchase` (`purchase_id`,`user_id`),
  CONSTRAINT `fk_packages_purchase` FOREIGN KEY (`purchase_id`, `user_id`) REFERENCES `purchases` (`id`, `user_id`),
  CONSTRAINT `fk_packages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_packages_weight` CHECK (`weight_kg` is null or `weight_kg` > 0 and `weight_kg` <= 5000),
  CONSTRAINT `chk_packages_value` CHECK (`declared_value` >= 0),
  CONSTRAINT `chk_packages_unit` CHECK (`weight_original` is null = (`weight_unit` is null)),
  CONSTRAINT `chk_packages_ident` CHECK (`user_id` is not null or `purchase_id` is null and `status` in ('received_us','unidentified','received','incident'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_packages_au AFTER UPDATE ON packages FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('package', NEW.id, OLD.status, NEW.status, @app_user_id);
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_packages_bd BEFORE DELETE ON packages FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los paquetes no se eliminan: marcar incidencia' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(150) NOT NULL,
  `token` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  `user_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`email`),
  KEY `idx_prt_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `settlement_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reversal_of_id` bigint(20) unsigned DEFAULT NULL,
  `currency_original` char(3) NOT NULL DEFAULT 'USD',
  `amount_original` decimal(12,2) NOT NULL,
  `fx_rate` decimal(12,4) DEFAULT NULL,
  `method` enum('cash','transfer','card_pos','other') NOT NULL,
  `branch` varchar(80) NOT NULL,
  `received_by` int(10) unsigned NOT NULL,
  `receipt_ref` varchar(80) NOT NULL,
  `paid_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_receipt` (`branch`,`receipt_ref`),
  UNIQUE KEY `uq_payments_reversal` (`reversal_of_id`),
  KEY `idx_payments_settlement` (`settlement_id`),
  KEY `fk_payments_employee` (`received_by`),
  CONSTRAINT `fk_payments_employee` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_payments_reversal` FOREIGN KEY (`reversal_of_id`) REFERENCES `payments` (`id`),
  CONSTRAINT `fk_payments_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `settlements` (`id`),
  CONSTRAINT `chk_payments_sign` CHECK (`amount` > 0 and `reversal_of_id` is null or `amount` < 0 and `reversal_of_id` is not null),
  CONSTRAINT `chk_payments_cur` CHECK (`currency_original` in ('USD','UYU')),
  CONSTRAINT `chk_payments_fx` CHECK (`currency_original` = 'USD' and `fx_rate` is null and `amount_original` = `amount` or `currency_original` = 'UYU' and `fx_rate` is not null and `fx_rate` > 0),
  CONSTRAINT `chk_payments_ref` CHECK (char_length(trim(`receipt_ref`)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_payments_bi BEFORE INSERT ON payments FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_payments_bu BEFORE UPDATE ON payments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos son inmutables: registrar una contrapartida' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_payments_bd BEFORE DELETE ON payments FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos no se eliminan: registrar una contrapartida' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pre_alerts` (
  `id` varchar(20) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `suite_id` varchar(25) NOT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `store` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `declared_value` decimal(10,2) DEFAULT 0.00,
  `pieces` tinyint(3) unsigned DEFAULT 1,
  `carrier` varchar(50) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `factura_path` varchar(500) DEFAULT NULL,
  `status` enum('pending','received','cancelled') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_pre_alerts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_pre_alerts_value` CHECK (`declared_value` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OBSOLETA: las pre-alertas pasan a ser compras registradas (purchases). Se conserva por historial.';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `provinces` (
  `code` char(3) NOT NULL,
  `name` varchar(60) NOT NULL,
  PRIMARY KEY (`code`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchase_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_id` bigint(20) unsigned NOT NULL,
  `description` varchar(300) NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `qty` smallint(5) unsigned NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_amount` decimal(12,2) GENERATED ALWAYS AS (`qty` * `unit_price` - `discount`) STORED,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_items_purchase` (`purchase_id`),
  CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `chk_items_qty` CHECK (`qty` between 1 and 1000),
  CONSTRAINT `chk_items_price` CHECK (`unit_price` >= 0 and `unit_price` <= 100000),
  CONSTRAINT `chk_items_discount` CHECK (`discount` >= 0 and `discount` <= `qty` * `unit_price`),
  CONSTRAINT `chk_items_url` CHECK (`url` is null or `url` regexp '^https?://'),
  CONSTRAINT `chk_items_desc` CHECK (char_length(trim(`description`)) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_items_bi BEFORE INSERT ON purchase_items FOR EACH ROW
BEGIN
  IF (SELECT status FROM purchases WHERE id = NEW.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar productos a una compra ya aceptada';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_items_bu BEFORE UPDATE ON purchase_items FOR EACH ROW
BEGIN
  IF NEW.purchase_id <> OLD.purchase_id OR (SELECT status FROM purchases WHERE id = OLD.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los productos de una compra aceptada no se pueden modificar';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_items_bd BEFORE DELETE ON purchase_items FOR EACH ROW
BEGIN
  IF (SELECT status FROM purchases WHERE id = OLD.purchase_id) NOT IN ('registered','in_review') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los productos de una compra aceptada no se pueden eliminar';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchases` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(25) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `recipient_id` int(10) unsigned NOT NULL,
  `store` varchar(100) NOT NULL,
  `store_order_number` varchar(100) NOT NULL,
  `purchased_on` date NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'USD',
  `store_taxes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `store_shipping` decimal(10,2) NOT NULL DEFAULT 0.00,
  `receipt_path` varchar(500) NOT NULL,
  `status` enum('registered','in_review','accepted','partially_received','fully_received','cancelled') NOT NULL DEFAULT 'registered',
  `terms_version` varchar(20) NOT NULL,
  `terms_accepted_at` datetime NOT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchases_code` (`code`),
  UNIQUE KEY `uq_purchases_id_user` (`id`,`user_id`),
  UNIQUE KEY `uq_purchases_store_order` (`user_id`,`store`,`store_order_number`),
  KEY `idx_purchases_user_status` (`user_id`,`status`),
  KEY `fk_purchases_recipient` (`recipient_id`,`user_id`),
  CONSTRAINT `fk_purchases_recipient` FOREIGN KEY (`recipient_id`, `user_id`) REFERENCES `addresses` (`id`, `user_id`),
  CONSTRAINT `fk_purchases_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_purchases_currency` CHECK (`currency` = 'USD'),
  CONSTRAINT `chk_purchases_amounts` CHECK (`store_taxes` >= 0 and `store_shipping` >= 0),
  CONSTRAINT `chk_purchases_store` CHECK (char_length(trim(`store`)) >= 2 and char_length(trim(`store_order_number`)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_purchases_bu BEFORE UPDATE ON purchases FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_purchases_au AFTER UPDATE ON purchases FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('purchase', NEW.code, OLD.status, NEW.status, @app_user_id);
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_purchases_bd BEFORE DELETE ON purchases FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las compras no se eliminan: cancelar con cambio de estado' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rate_limits` (
  `bucket_key` char(64) NOT NULL,
  `hits` int(10) unsigned NOT NULL DEFAULT 0,
  `window_start` int(10) unsigned NOT NULL,
  PRIMARY KEY (`bucket_key`),
  KEY `idx_rate_window` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `family_id` char(32) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `replaced_by` bigint(20) unsigned DEFAULT NULL,
  `created_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_hash` (`token_hash`),
  KEY `idx_refresh_user` (`user_id`,`revoked_at`),
  KEY `idx_refresh_family` (`family_id`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(10) NOT NULL,
  `name` varchar(150) NOT NULL,
  `checksum` char(64) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settlement_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `settlement_id` bigint(20) unsigned NOT NULL,
  `purchase_id` bigint(20) unsigned NOT NULL,
  `product_base` decimal(12,2) NOT NULL,
  `weight_kg` decimal(8,3) DEFAULT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `current_purchase` bigint(20) unsigned GENERATED ALWAYS AS (if(`is_current` = 1,`purchase_id`,NULL)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lines_settlement_purchase` (`settlement_id`,`purchase_id`),
  UNIQUE KEY `uq_lines_current_purchase` (`current_purchase`),
  KEY `fk_lines_purchase` (`purchase_id`),
  CONSTRAINT `fk_lines_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `fk_lines_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `settlements` (`id`),
  CONSTRAINT `chk_lines` CHECK (`product_base` >= 0 and (`weight_kg` is null or `weight_kg` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_lines_bi BEFORE INSERT ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = NEW.settlement_id) <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se agregan líneas a una liquidación emitida';
  END IF;
  IF (SELECT user_id FROM settlements WHERE id = NEW.settlement_id) <> (SELECT user_id FROM purchases WHERE id = NEW.purchase_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La compra pertenece a otro cliente';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_lines_bu BEFORE UPDATE ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = OLD.settlement_id) <> 'estimate'
     AND NOT (NEW.product_base <=> OLD.product_base AND NEW.weight_kg <=> OLD.weight_kg AND NEW.purchase_id <=> OLD.purchase_id AND NEW.settlement_id <=> OLD.settlement_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las líneas de una liquidación emitida son inmodificables';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_lines_bd BEFORE DELETE ON settlement_lines FOR EACH ROW
BEGIN
  IF (SELECT status FROM settlements WHERE id = OLD.settlement_id) <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las líneas de una liquidación emitida no se eliminan';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settlements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `shipment_id` varchar(20) DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `supersedes_id` bigint(20) unsigned DEFAULT NULL,
  `tariff_version_id` bigint(20) unsigned NOT NULL,
  `commission_rate` decimal(5,4) NOT NULL,
  `sell_rate_per_kg` decimal(8,2) NOT NULL,
  `product_base` decimal(12,2) NOT NULL,
  `commission` decimal(10,2) NOT NULL,
  `weight_billable_kg` decimal(8,3) DEFAULT NULL,
  `shipping` decimal(10,2) DEFAULT NULL,
  `extra_charges` decimal(10,2) NOT NULL DEFAULT 0.00,
  `extra_charges_note` varchar(255) DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL,
  `status` enum('estimate','issued','partial','paid','refund_pending','void') NOT NULL DEFAULT 'estimate',
  `issued_by` int(10) unsigned DEFAULT NULL,
  `issued_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settlements_code` (`code`),
  UNIQUE KEY `uq_settlements_supersedes` (`supersedes_id`),
  KEY `idx_settlements_user_status` (`user_id`,`status`),
  KEY `idx_settlements_shipment` (`shipment_id`),
  KEY `fk_settlements_tariff` (`tariff_version_id`),
  KEY `fk_settlements_issuer` (`issued_by`),
  CONSTRAINT `fk_settlements_issuer` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_settlements_shipment` FOREIGN KEY (`shipment_id`) REFERENCES `locker_shipments` (`id`),
  CONSTRAINT `fk_settlements_super` FOREIGN KEY (`supersedes_id`) REFERENCES `settlements` (`id`),
  CONSTRAINT `fk_settlements_tariff` FOREIGN KEY (`tariff_version_id`) REFERENCES `tariff_versions` (`id`),
  CONSTRAINT `fk_settlements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_settle_money` CHECK (`product_base` >= 0 and `commission` >= 0 and `extra_charges` >= 0),
  CONSTRAINT `chk_settle_comm` CHECK (`commission` = round(`product_base` * `commission_rate`,2)),
  CONSTRAINT `chk_settle_weight` CHECK (`weight_billable_kg` is null = (`shipping` is null) and (`weight_billable_kg` is null or `weight_billable_kg` > 0)),
  CONSTRAINT `chk_settle_ship` CHECK (`shipping` is null or `shipping` = round(`weight_billable_kg` * `sell_rate_per_kg`,2)),
  CONSTRAINT `chk_settle_total` CHECK (`total` is null or `shipping` is not null and `total` = `commission` + `shipping` + `extra_charges`),
  CONSTRAINT `chk_settle_extra` CHECK (`extra_charges` = 0 or `extra_charges_note` is not null and char_length(`extra_charges_note`) >= 5),
  CONSTRAINT `chk_settle_issued` CHECK (`status` in ('estimate','void') or `total` is not null and `issued_by` is not null and `issued_at` is not null),
  CONSTRAINT `chk_settle_version` CHECK (`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_settlements_bi BEFORE INSERT ON settlements FOR EACH ROW
BEGIN
  IF NEW.status <> 'estimate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una liquidación nace como estimación; se emite en un paso posterior';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_settlements_bu BEFORE UPDATE ON settlements FOR EACH ROW
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_settlements_au AFTER UPDATE ON settlements FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO status_log (entity, entity_id, from_status, to_status, changed_by)
    VALUES ('settlement', NEW.code, OLD.status, NEW.status, @app_user_id);
    IF NEW.status = 'void' THEN
      UPDATE settlement_lines SET is_current = 0 WHERE settlement_id = NEW.id;
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_settlements_bd BEFORE DELETE ON settlements FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las liquidaciones no se eliminan: anular con nueva versión' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `status_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `entity` enum('purchase','settlement','shipment','package') NOT NULL,
  `entity_id` varchar(30) NOT NULL,
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) NOT NULL,
  `changed_by` int(10) unsigned DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status_log_entity` (`entity`,`entity_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_status_log_no_update BEFORE UPDATE ON status_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados es inmutable' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_status_log_no_delete BEFORE DELETE ON status_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados no se elimina' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `status_transitions` (
  `entity` enum('purchase','settlement','shipment') NOT NULL,
  `from_status` varchar(30) NOT NULL,
  `to_status` varchar(30) NOT NULL,
  PRIMARY KEY (`entity`,`from_status`,`to_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suites` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `suite_id` varchar(25) NOT NULL,
  `country` char(2) NOT NULL DEFAULT 'UY',
  `member_since` date NOT NULL,
  `status` enum('active','suspended') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `suite_id` (`suite_id`),
  CONSTRAINT `fk_suites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tariff_versions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `commission_rate` decimal(5,4) NOT NULL,
  `sell_rate_per_kg` decimal(8,2) NOT NULL,
  `effective_from` datetime NOT NULL,
  `is_reference` tinyint(1) NOT NULL DEFAULT 1,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tariff_effective` (`effective_from`),
  KEY `fk_tariff_user` (`created_by`),
  CONSTRAINT `fk_tariff_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_tariff_rate` CHECK (`commission_rate` >= 0 and `commission_rate` <= 0.5),
  CONSTRAINT `chk_tariff_kg` CHECK (`sell_rate_per_kg` > 0 and `sell_rate_per_kg` <= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_tariff_creator BEFORE INSERT ON tariff_versions FOR EACH ROW
BEGIN
  IF NEW.created_by IS NOT NULL AND (SELECT role FROM users WHERE id = NEW.created_by) <> 'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador puede crear tarifas';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_tariff_no_update BEFORE UPDATE ON tariff_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las tarifas son inmutables: crear una nueva versión' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER trg_tariff_no_delete BEFORE DELETE ON tariff_versions FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las tarifas no se eliminan' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `tier` enum('standard','frequent','vip') DEFAULT NULL COMMENT 'OBSOLETA: el modelo de negocio actual no usa niveles de cliente.',
  `status` enum('active','suspended','pending') DEFAULT 'pending',
  `role` enum('customer','agent','warehouse','admin') NOT NULL DEFAULT 'customer',
  `token_version` int(10) unsigned NOT NULL DEFAULT 0,
  `failed_logins` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  CONSTRAINT `chk_users_email` CHECK (`email` like '%_@_%._%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

