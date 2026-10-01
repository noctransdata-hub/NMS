-- ====================================================================
-- Transdata NMS - FTTH GIS Physical Network Topology Schema
-- Database: MariaDB (Compatible with MariaDB 10.5+ / MySQL 8.0+)
-- Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. FTTH Physical Network Objects (Nodes/Points)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_objects` (
    `id` VARCHAR(36) PRIMARY KEY,
    `object_type` ENUM(
        'OLT', 'ODC', 'ODP', 'FAT', 'TIANG',
        'HANDHOLE', 'PELANGGAN', 'JOINT_CLOSURE',
        'SPLITTER', 'POP'
    ) NOT NULL,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `status` ENUM('ACTIVE', 'PLANNING', 'MAINTENANCE', 'FAULT') NOT NULL DEFAULT 'ACTIVE',
    `address` VARCHAR(255) NULL,
    `port_capacity` INT NOT NULL DEFAULT 0,
    `ports_used` INT NOT NULL DEFAULT 0,
    `parent_object_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_ftth_type` (`object_type`),
    INDEX `idx_ftth_coords` (`latitude`, `longitude`),
    INDEX `idx_ftth_parent` (`parent_object_id`),
    CONSTRAINT `fk_ftth_parent` FOREIGN KEY (`parent_object_id`) REFERENCES `ftth_objects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. FTTH Fiber Cables (Feeder, Distribution, Dropcore)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_cables` (
    `id` VARCHAR(36) PRIMARY KEY,
    `cable_code` VARCHAR(50) NOT NULL UNIQUE,
    `cable_name` VARCHAR(100) NOT NULL,
    `cable_type` ENUM('FEEDER', 'DISTRIBUTION', 'DROPCORE') NOT NULL DEFAULT 'DISTRIBUTION',
    `core_count` INT NOT NULL DEFAULT 12,
    `calculated_length_m` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `actual_installed_length_m` DECIMAL(10, 2) NULL,
    `start_object_id` VARCHAR(36) NULL,
    `end_object_id` VARCHAR(36) NULL,
    `color_hex` VARCHAR(10) NOT NULL DEFAULT '#3b82f6',
    `status` ENUM('ACTIVE', 'PLANNING', 'FAULT', 'REPAIR') NOT NULL DEFAULT 'ACTIVE',
    `installation_date` DATE NULL,
    `technician_notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_cable_type` (`cable_type`),
    INDEX `idx_cable_start` (`start_object_id`),
    INDEX `idx_cable_end` (`end_object_id`),
    CONSTRAINT `fk_cable_start` FOREIGN KEY (`start_object_id`) REFERENCES `ftth_objects` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_cable_end` FOREIGN KEY (`end_object_id`) REFERENCES `ftth_objects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Cable Multi-Segment Vertices (Path polyline on map)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_cable_vertices` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `cable_id` VARCHAR(36) NOT NULL,
    `vertex_order` INT NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    INDEX `idx_vertex_cable_order` (`cable_id`, `vertex_order`),
    CONSTRAINT `fk_vertex_cable` FOREIGN KEY (`cable_id`) REFERENCES `ftth_cables` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Optical Splitters (1:4, 1:8, 1:16, 1:32 inside ODC/ODP/FAT)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_splitters` (
    `id` VARCHAR(36) PRIMARY KEY,
    `parent_object_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `ratio` ENUM('1:2', '1:4', '1:8', '1:16', '1:32') NOT NULL DEFAULT '1:8',
    `input_port_count` INT NOT NULL DEFAULT 1,
    `output_port_count` INT NOT NULL DEFAULT 8,
    `notes` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_splitter_parent` (`parent_object_id`),
    CONSTRAINT `fk_splitter_parent` FOREIGN KEY (`parent_object_id`) REFERENCES `ftth_objects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Physical Port Allocations (ODC/ODP and Splitter ports)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_ports` (
    `id` VARCHAR(36) PRIMARY KEY,
    `parent_type` ENUM('OBJECT', 'SPLITTER') NOT NULL,
    `parent_id` VARCHAR(36) NOT NULL,
    `port_number` INT NOT NULL,
    `status` ENUM('AVAILABLE', 'CONNECTED', 'DAMAGED', 'RESERVED') NOT NULL DEFAULT 'AVAILABLE',
    `connected_cable_id` VARCHAR(36) NULL,
    `connected_object_id` VARCHAR(36) NULL,
    `customer_id` VARCHAR(36) NULL,
    `label` VARCHAR(80) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_parent_port` (`parent_type`, `parent_id`, `port_number`),
    INDEX `idx_port_cable` (`connected_cable_id`),
    INDEX `idx_port_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. FTTH Customers & ONT Association (Real subscriber endpoints)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_customers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `customer_code` VARCHAR(50) NOT NULL UNIQUE,
    `full_name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `address` VARCHAR(255) NOT NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `service_package` VARCHAR(80) DEFAULT 'Standard 30 Mbps',
    `bandwidth_mbps` INT DEFAULT 30,
    `connected_odp_id` VARCHAR(36) NULL,
    `connected_port_number` INT NULL,
    `ont_serial_number` VARCHAR(80) NULL,
    `ont_ip_address` VARCHAR(45) NULL,
    `genieacs_device_id` VARCHAR(100) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED', 'SURVEY') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_customer_odp` (`connected_odp_id`),
    INDEX `idx_customer_sn` (`ont_serial_number`),
    CONSTRAINT `fk_cust_odp` FOREIGN KEY (`connected_odp_id`) REFERENCES `ftth_objects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. FTTH Maintenance Logs & Audit
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ftth_maintenance_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `object_id` VARCHAR(36) NULL,
    `cable_id` VARCHAR(36) NULL,
    `action_taken` VARCHAR(100) NOT NULL,
    `technician_name` VARCHAR(100) NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
