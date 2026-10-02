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
('gis_default_zoom', '14', 'Default level zoom Leaflet GIS'),
('whatsapp_gateway_url', '', 'Endpoint API WhatsApp Gateway (opsional untuk notifikasi otomatis)'),
('whatsapp_gateway_token', '', 'API Key / Token WhatsApp Gateway'),
('whatsapp_reminder_template', 'Halo Pelanggan Yth. {nama},\n\nTagihan internet Transdata periode ini sebesar *Rp {tagihan}* untuk paket *{paket}* ({bandwidth}).\nMohon lakukan pembayaran sebelum tanggal {jatuh_tempo}.\n\nPembayaran dapat ditransfer ke:\nBCA: 1234-5678-90 a/n PT TRANSDATA PRIMA\n\nTerima kasih atas kepercayaannya.\nTransdata NOC Center', 'Template pesan pengingat tagihan WhatsApp')
ON DUPLICATE KEY UPDATE `setting_key`=VALUES(`setting_key`);

-- 3. Default Service Packages
INSERT INTO `packages` (`id`, `name`, `price`, `bandwidth`, `description`, `mikrotik_profile`) VALUES
(1, 'HOME 20 Mbps', 175000.00, '20 Mbps / 20 Mbps', 'Paket internet fiber optik rumahan up to 20 Mbps', 'HOME-20M'),
(2, 'HOME 30 Mbps', 235000.00, '30 Mbps / 30 Mbps', 'Paket internet fiber optik keluarga up to 30 Mbps', 'HOME-30M'),
(3, 'HOME 50 Mbps', 325000.00, '50 Mbps / 50 Mbps', 'Paket internet fiber optik streaming & gaming up to 50 Mbps', 'HOME-50M'),
(4, 'SOHO 100 Mbps', 550000.00, '100 Mbps / 100 Mbps', 'Paket internet prioritas kantor & UMKM up to 100 Mbps', 'SOHO-100M')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `price`=VALUES(`price`), `bandwidth`=VALUES(`bandwidth`);
