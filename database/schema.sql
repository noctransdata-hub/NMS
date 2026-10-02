-- ====================================================================
-- Transdata NMS - ISP Network Management System
-- Production MariaDB Database Schema
-- Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Roles & Permissions (RBAC)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(100) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
    `role_id` INT NOT NULL,
    `permission_id` INT NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Users (No default admin/admin auto-created; initialized securely)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(60) NOT NULL UNIQUE,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `role_id` INT NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `last_login` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Devices (Physical Network Hardware)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL UNIQUE,
    `device_type` ENUM('ROUTER', 'SWITCH', 'OLT', 'ONT', 'SERVER', 'OTHER') NOT NULL DEFAULT 'ROUTER',
    `vendor` VARCHAR(100) DEFAULT 'Tidak tersedia',
    `model` VARCHAR(100) DEFAULT 'Tidak tersedia',
    `serial_number` VARCHAR(100) DEFAULT 'Tidak tersedia',
    `location` VARCHAR(200) DEFAULT 'Tidak ditentukan',
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    
    -- SNMP Configuration
    `snmp_version` ENUM('v1', 'v2c', 'v3') NOT NULL DEFAULT 'v2c',
    `snmp_port` INT NOT NULL DEFAULT 161,
    `snmp_community_encrypted` TEXT NULL,
    `snmp_timeout_sec` INT NOT NULL DEFAULT 3,
    `snmp_retries` INT NOT NULL DEFAULT 2,
    
    -- MikroTik API Configuration (Optional)
    `mikrotik_api_port` INT DEFAULT 8728,
    `mikrotik_username` VARCHAR(60) NULL,
    `mikrotik_password_encrypted` TEXT NULL,
    `mikrotik_use_ssl` TINYINT(1) DEFAULT 0,
    
    -- Monitoring Flags & Actual Real Status
    `monitoring_enabled` TINYINT(1) DEFAULT 1,
    `ping_status` ENUM('ONLINE', 'OFFLINE', 'UNKNOWN', 'ERROR') NOT NULL DEFAULT 'UNKNOWN',
    `ping_latency_ms` DECIMAL(8, 2) NULL,
    `ping_packet_loss_pct` DECIMAL(5, 2) NULL,
    `last_ping_time` TIMESTAMP NULL,
    `last_ping_output` TEXT NULL,
    
    `snmp_status` ENUM('ONLINE', 'OFFLINE', 'UNKNOWN', 'ERROR', 'DISABLED') NOT NULL DEFAULT 'UNKNOWN',
    `snmp_uptime` VARCHAR(100) NULL,
    `snmp_descr` TEXT NULL,
    `last_snmp_time` TIMESTAMP NULL,
    `last_snmp_error` TEXT NULL,
    
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_device_ip` (`ip_address`),
    INDEX `idx_device_ping` (`ping_status`),
    INDEX `idx_device_snmp` (`snmp_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Device Interfaces
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `device_interfaces` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `device_id` INT NOT NULL,
    `if_index` INT NOT NULL,
    `if_name` VARCHAR(100) NOT NULL,
    `if_descr` VARCHAR(255) NULL,
    `if_oper_status` ENUM('up', 'down', 'testing', 'unknown', 'dormant', 'notPresent', 'lowerLayerDown') DEFAULT 'unknown',
    `is_monitored` TINYINT(1) DEFAULT 1,
    `last_in_octets` BIGINT UNSIGNED NULL,
    `last_out_octets` BIGINT UNSIGNED NULL,
    `last_sample_time` TIMESTAMP NULL,
    `current_rx_rate_bps` BIGINT UNSIGNED NULL,
    `current_tx_rate_bps` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_device_interface` (`device_id`, `if_index`),
    CONSTRAINT `fk_interface_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Interface Traffic Samples (With Data Retention Policy)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `interface_traffic_samples` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `device_id` INT NOT NULL,
    `interface_id` INT NOT NULL,
    `sample_time` TIMESTAMP NOT NULL,
    `in_octets` BIGINT UNSIGNED NOT NULL,
    `out_octets` BIGINT UNSIGNED NOT NULL,
    `time_delta_sec` DECIMAL(8, 2) NOT NULL,
    `rx_rate_bps` BIGINT UNSIGNED NOT NULL,
    `tx_rate_bps` BIGINT UNSIGNED NOT NULL,
    INDEX `idx_sample_device_time` (`device_id`, `sample_time`),
    INDEX `idx_sample_if_time` (`interface_id`, `sample_time`),
    CONSTRAINT `fk_sample_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sample_if` FOREIGN KEY (`interface_id`) REFERENCES `device_interfaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. Alarms (Real Network Issues)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alarms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `device_id` INT NULL,
    `alarm_type` VARCHAR(50) NOT NULL,
    `severity` ENUM('CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO') NOT NULL DEFAULT 'MAJOR',
    `message` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'ACKNOWLEDGED', 'CLEARED') NOT NULL DEFAULT 'ACTIVE',
    `acknowledged_by` INT NULL,
    `acknowledged_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `resolved_at` TIMESTAMP NULL,
    INDEX `idx_alarm_status` (`status`),
    INDEX `idx_alarm_device` (`device_id`),
    CONSTRAINT `fk_alarm_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_alarm_user` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. Audit Logs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `action` VARCHAR(60) NOT NULL,
    `target_type` VARCHAR(50) NOT NULL,
    `target_id` VARCHAR(50) NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. System Settings
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key` VARCHAR(80) PRIMARY KEY,
    `setting_value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 9. Service Packages (Paket Layanan Internet)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `packages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `bandwidth` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `mikrotik_profile` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 10. Customers (Data Pelanggan ISP & Relasi ODP/ONT)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_number` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(120) NOT NULL,
    `nik` VARCHAR(30) NOT NULL,
    `address` TEXT NOT NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `email` VARCHAR(120) NULL,
    `package_id` INT NOT NULL,
    `odp_id` VARCHAR(36) NULL,
    `ont_sn` VARCHAR(80) NULL,
    `ont_model` VARCHAR(100) NULL,
    `pppoe_username` VARCHAR(80) NULL UNIQUE,
    `pppoe_password` VARCHAR(80) NULL,
    `status` ENUM('ACTIVE', 'ISOLIR', 'DOWN') NOT NULL DEFAULT 'ACTIVE',
    `isolir_reason` VARCHAR(255) NULL,
    `isolir_at` TIMESTAMP NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_cust_package` (`package_id`),
    INDEX `idx_cust_odp` (`odp_id`),
    INDEX `idx_cust_sn` (`ont_sn`),
    INDEX `idx_cust_status` (`status`),
    CONSTRAINT `fk_cust_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
