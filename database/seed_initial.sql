-- ====================================================================
-- Transdata NMS - Initial Roles and System Settings Seed
-- (NO DEFAULT ADMIN USER IS CREATED; ADMIN IS INITIALIZED ON FIRST SETUP)
-- ====================================================================

-- 1. Standard ISP Operational Roles
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'Superadmin', 'Akses penuh ke seluruh sistem NMS, manajemen user, konfigurasi jaringan, dan audit'),
(2, 'Network Engineer', 'Akses operasional router, switch, OLT, monitoring SNMP, dan troubleshooting'),
(3, 'NOC Operator', 'Monitoring real-time, penanganan alarm, dan pengecekan konektivitas'),
(4, 'FTTH Field Technician', 'Manajemen GIS fisik, inventaris ODP/ODC, data splitter, dan pencatatan kabel')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 2. System Settings Defaults
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`) VALUES
('isp_name', 'ISP Transdata', 'Nama resmi entitas penyedia jasa internet'),
('snmp_default_community', 'public', 'Default SNMP read community untuk query polling'),
('snmp_default_timeout', '3', 'Default SNMP timeout dalam satuan detik'),
('snmp_default_retries', '2', 'Default percobaan ulang SNMP jika request gagal'),
('genieacs_nbi_url', 'http://127.0.0.1:7557', 'Endpoint GenieACS NBI REST API untuk manajemen ONT/CPE'),
('ping_default_count', '4', 'Jumlah paket ICMP per pengetesan status jaringan'),
('traffic_retention_days', '30', 'Kebijakan retensi data riwayat trafik interface (hari)'),
('gis_default_lat', '-6.2088', 'Default latitude peta GIS (Indonesia/Jakarta/Pusat Operasional)'),
('gis_default_lng', '106.8456', 'Default longitude peta GIS'),
('gis_default_zoom', '14', 'Default level zoom Leaflet GIS')
ON DUPLICATE KEY UPDATE `setting_key`=VALUES(`setting_key`);
