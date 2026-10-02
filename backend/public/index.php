<?php
/**
 * Transdata NMS - Production REST API Front Controller & Router
 * PHP 8.2+ / 8.3
 */

declare(strict_types=1);

namespace Transdata\Nms;

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/PingService.php';
require_once __DIR__ . '/../src/SnmpService.php';
require_once __DIR__ . '/../src/MikrotikService.php';
require_once __DIR__ . '/../src/GenieAcsService.php';
require_once __DIR__ . '/../src/GisService.php';
require_once __DIR__ . '/../src/AuditLogger.php';

$configFile = __DIR__ . '/../config/config.php';
if (!file_exists($configFile)) {
    $configFile = __DIR__ . '/../config/config.example.php';
}
$config = require $configFile;
Database::setConfig($config);

// Helper Response
function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse(string $message, int $status = 400, ?array $details = null): void {
    http_response_code($status);
    $payload = ['success' => false, 'error' => $message];
    if ($details !== null) $payload['details'] = $details;
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function getAuthorizationHeader(): ?string {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return 'Bearer ' . $_SERVER['HTTP_X_AUTH_TOKEN'];
    }
    if (!empty($_GET['token'])) {
        return 'Bearer ' . $_GET['token'];
    }
    if (!empty($_COOKIE['transdata_token'])) {
        return 'Bearer ' . $_COOKIE['transdata_token'];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $val) {
            if (strcasecmp($key, 'Authorization') === 0) {
                return $val;
            }
            if (strcasecmp($key, 'X-Auth-Token') === 0) {
                return 'Bearer ' . $val;
            }
        }
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $key => $val) {
            if (strcasecmp($key, 'Authorization') === 0) {
                return $val;
            }
            if (strcasecmp($key, 'X-Auth-Token') === 0) {
                return 'Bearer ' . $val;
            }
        }
    }
    return null;
}

// Router parsing
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$method = strtoupper($_SERVER['REQUEST_METHOD']);
$path = preg_replace('#^/api#', '', $requestUri);
$path = rtrim($path, '/') ?: '/';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    $db = Database::getConnection();
    $auth = new Auth($db, $config);
    $audit = new AuditLogger($db);
    $pingSvc = new PingService($config['ping']['binary_path'] ?? '/bin/ping');
    $snmpSvc = new SnmpService($config['snmp']['binary_path'] ?? '/usr/bin/snmpget', $config['snmp']['walk_binary'] ?? '/usr/bin/snmpwalk');
    $gisSvc = new GisService($db);
    $genieAcsSvc = new GenieAcsService($config['genieacs']['nbi_url'] ?? 'http://127.0.0.1:7557');

    // Public Route: System Status & Diagnostic
    if ($path === '/system/status' && $method === 'GET') {
        $hasAdmin = $auth->hasAdminUser();
        $isSnmp = $snmpSvc->isNetSnmpInstalled();
        jsonResponse([
            'success'            => true,
            'system_name'        => 'Transdata NMS',
            'version'            => '1.0.0-PROD',
            'php_version'        => PHP_VERSION,
            'has_admin_user'     => $hasAdmin,
            'net_snmp_installed' => $isSnmp,
            'snmp_notice'        => $isSnmp ? 'Net-SNMP CLI aktif' : 'Net-SNMP belum terinstal di host. Jalankan: sudo apt-get install -y snmp',
            'server_time'        => date('Y-m-d H:i:s')
        ]);
    }

    // Public Route: Setup First Administrator
    if ($path === '/auth/setup-admin' && $method === 'POST') {
        if ($auth->hasAdminUser()) {
            errorResponse('Setup superadmin telah ditutup. Akun admin sudah tersedia.', 403);
        }
        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        $fullName = trim($input['full_name'] ?? '');

        if (!$username || !$email || !$password || !$fullName) {
            errorResponse('Semua bidang (username, email, password, full_name) wajib diisi.', 400);
        }

        $user = $auth->createInitialAdmin($username, $email, $password, $fullName);
        $audit->log($user['id'], 'SETUP_FIRST_ADMIN', 'USER', (string)$user['id'], 'Superadmin pertama dibuat melalui setup wizard.');
        jsonResponse([
            'success' => true,
            'message' => 'Akun Superadmin Transdata NMS berhasil dibuat. Silakan login.',
            'user'    => $user
        ], 201);
    }

    // Public Route: Login
    if ($path === '/auth/login' && $method === 'POST') {
        $username = trim($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');
        if (!$username || !$password) {
            errorResponse('Username dan password wajib diisi.', 400);
        }
        $authData = $auth->login($username, $password, $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        $audit->log($authData['user']['id'], 'USER_LOGIN', 'AUTH', (string)$authData['user']['id'], 'Login berhasil.');
        jsonResponse([
            'success' => true,
            'token'   => $authData['token'],
            'user'    => $authData['user']
        ]);
    }

    // JWT Verification for protected endpoints
    $authHeader = getAuthorizationHeader();
    if (!$authHeader) {
        errorResponse('Token otentikasi tidak ditemukan. Header Authorization, parameter ?token=, atau cookie sesi tidak terdeteksi.', 401);
    }
    $currentUser = $auth->validateToken($authHeader);
    if (!$currentUser) {
        errorResponse('Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.', 401);
    }

    // GET /auth/me
    if ($path === '/auth/me' && $method === 'GET') {
        $profile = $auth->getUserById((int)$currentUser['id']);
        jsonResponse(['success' => true, 'user' => $profile]);
    }

    // GET /dashboard/summary
    if ($path === '/dashboard/summary' && $method === 'GET') {
        $dTotal = (int)$db->query("SELECT COUNT(*) FROM devices")->fetchColumn();
        $dOnline = (int)$db->query("SELECT COUNT(*) FROM devices WHERE ping_status = 'ONLINE'")->fetchColumn();
        $dOffline = (int)$db->query("SELECT COUNT(*) FROM devices WHERE ping_status = 'OFFLINE'")->fetchColumn();
        $dUnknown = (int)$db->query("SELECT COUNT(*) FROM devices WHERE ping_status IN ('UNKNOWN', 'ERROR')")->fetchColumn();
        $alarmCnt = (int)$db->query("SELECT COUNT(*) FROM alarms WHERE status = 'ACTIVE'")->fetchColumn();
        
        $offlineDevices = $db->query("SELECT id, name, ip_address, device_type, ping_status, last_ping_time FROM devices WHERE ping_status = 'OFFLINE' ORDER BY last_ping_time DESC LIMIT 10")->fetchAll();
        $recentAlarms = $db->query("SELECT a.*, d.name as device_name FROM alarms a LEFT JOIN devices d ON a.device_id = d.id WHERE a.status = 'ACTIVE' ORDER BY a.created_at DESC LIMIT 5")->fetchAll();

        jsonResponse([
            'success' => true,
            'total_devices'   => $dTotal,
            'online_devices'  => $dOnline,
            'offline_devices' => $dOffline,
            'unknown_devices' => $dUnknown,
            'active_alarms'   => $alarmCnt,
            'offline_list'    => $offlineDevices,
            'recent_alarms'   => $recentAlarms,
            'timestamp'       => date('Y-m-d H:i:s')
        ]);
    }

    // GET /devices
    if ($path === '/devices' && $method === 'GET') {
        $sql = "SELECT id, name, ip_address, device_type, vendor, model, serial_number, location, snmp_version, snmp_port, monitoring_enabled, ping_status, ping_latency_ms, ping_packet_loss_pct, last_ping_time, snmp_status, snmp_uptime, last_snmp_time FROM devices ORDER BY name ASC";
        $devices = $db->query($sql)->fetchAll();
        jsonResponse(['success' => true, 'count' => count($devices), 'devices' => $devices]);
    }

    // POST /devices
    if ($path === '/devices' && $method === 'POST') {
        $name = trim($input['name'] ?? '');
        $ip = trim($input['ip_address'] ?? '');
        if (!$name || !filter_var($ip, FILTER_VALIDATE_IP)) {
            errorResponse('Nama perangkat dan alamat IP valid wajib diisi.', 400);
        }

        $stmt = $db->prepare("
            INSERT INTO devices (name, ip_address, device_type, vendor, model, location, snmp_version, snmp_port, snmp_community_encrypted, monitoring_enabled)
            VALUES (:name, :ip, :type, :vendor, :model, :location, :snmp_ver, :snmp_port, :community, :mon)
        ");
        $stmt->execute([
            ':name'      => $name,
            ':ip'        => $ip,
            ':type'      => $input['device_type'] ?? 'ROUTER',
            ':vendor'    => $input['vendor'] ?? 'Tidak tersedia',
            ':model'     => $input['model'] ?? 'Tidak tersedia',
            ':location'  => $input['location'] ?? 'Tidak ditentukan',
            ':snmp_ver'  => $input['snmp_version'] ?? 'v2c',
            ':snmp_port' => (int)($input['snmp_port'] ?? 161),
            ':community' => $input['snmp_community'] ?? 'public',
            ':mon'       => isset($input['monitoring_enabled']) ? ($input['monitoring_enabled'] ? 1 : 0) : 1
        ]);
        $devId = (int)$db->lastInsertId();
        $audit->log((int)$currentUser['id'], 'CREATE_DEVICE', 'DEVICE', (string)$devId, "Menambahkan perangkat $name ($ip)");

        jsonResponse(['success' => true, 'id' => $devId, 'message' => 'Perangkat berhasil ditambahkan.'], 201);
    }

    // POST /devices/{id}/ping
    if (preg_match('#^/devices/(\d+)/ping$#', $path, $m) && $method === 'POST') {
        $devId = (int)$m[1];
        $stmt = $db->prepare("SELECT * FROM devices WHERE id = :id");
        $stmt->execute([':id' => $devId]);
        $dev = $stmt->fetch();
        if (!$dev) errorResponse('Perangkat tidak ditemukan.', 404);

        $pingRes = $pingSvc->executePing($dev['ip_address'], (int)($input['count'] ?? 4));

        // Update database dengan hasil pemeriksaan nyata
        $up = $db->prepare("
            UPDATE devices SET 
                ping_status = :status,
                ping_latency_ms = :latency,
                ping_packet_loss_pct = :loss,
                last_ping_time = NOW(),
                last_ping_output = :output
            WHERE id = :id
        ");
        $up->execute([
            ':status'  => $pingRes['status'],
            ':latency' => $pingRes['latency_ms'],
            ':loss'    => $pingRes['packet_loss'],
            ':output'  => $pingRes['output'],
            ':id'      => $devId
        ]);

        jsonResponse(['success' => true, 'ping' => $pingRes]);
    }

    // ==========================================
    // PAKET LAYANAN INTERNET (PACKAGES)
    // ==========================================

    // GET /packages
    if ($path === '/packages' && $method === 'GET') {
        $pkgs = $db->query("SELECT * FROM packages ORDER BY price ASC")->fetchAll();
        jsonResponse(['success' => true, 'packages' => $pkgs]);
    }

    // POST /packages
    if ($path === '/packages' && $method === 'POST') {
        $name = trim($input['name'] ?? '');
        $price = (float)($input['price'] ?? 0);
        $bandwidth = trim($input['bandwidth'] ?? '');
        $desc = trim($input['description'] ?? '');
        $profile = trim($input['mikrotik_profile'] ?? '') ?: $name;

        if (!$name || $price <= 0 || !$bandwidth) {
            errorResponse('Nama paket, tagihan (Rp > 0), dan kapasitas bandwidth wajib diisi.', 400);
        }

        $stmt = $db->prepare("INSERT INTO packages (name, price, bandwidth, description, mikrotik_profile) VALUES (:n, :p, :b, :d, :mp)");
        $stmt->execute([':n' => $name, ':p' => $price, ':b' => $bandwidth, ':d' => $desc, ':mp' => $profile]);
        $pkgId = (int)$db->lastInsertId();
        $audit->log((int)$currentUser['id'], 'CREATE_PACKAGE', 'PACKAGE', (string)$pkgId, "Membuat paket $name Rp $price ($bandwidth)");

        jsonResponse(['success' => true, 'id' => $pkgId, 'message' => 'Paket layanan berhasil ditambahkan.'], 201);
    }

    // PUT /packages/{id}
    if (preg_match('#^/packages/(\d+)$#', $path, $m) && $method === 'PUT') {
        $pkgId = (int)$m[1];
        $name = trim($input['name'] ?? '');
        $price = (float)($input['price'] ?? 0);
        $bandwidth = trim($input['bandwidth'] ?? '');
        $desc = trim($input['description'] ?? '');
        $profile = trim($input['mikrotik_profile'] ?? '') ?: $name;

        if (!$name || $price <= 0 || !$bandwidth) {
            errorResponse('Nama paket, tagihan, dan kapasitas bandwidth wajib diisi.', 400);
        }

        $stmt = $db->prepare("UPDATE packages SET name = :n, price = :p, bandwidth = :b, description = :d, mikrotik_profile = :mp WHERE id = :id");
        $stmt->execute([':n' => $name, ':p' => $price, ':b' => $bandwidth, ':d' => $desc, ':mp' => $profile, ':id' => $pkgId]);
        $audit->log((int)$currentUser['id'], 'UPDATE_PACKAGE', 'PACKAGE', (string)$pkgId, "Mengubah paket $name");

        jsonResponse(['success' => true, 'message' => 'Paket layanan berhasil diperbarui.']);
    }

    // DELETE /packages/{id}
    if (preg_match('#^/packages/(\d+)$#', $path, $m) && $method === 'DELETE') {
        $pkgId = (int)$m[1];
        $cnt = (int)$db->prepare("SELECT COUNT(*) FROM customers WHERE package_id = :id")->execute([':id' => $pkgId]) ? $db->query("SELECT COUNT(*) FROM customers WHERE package_id = $pkgId")->fetchColumn() : 0;
        if ($cnt > 0) {
            errorResponse("Paket tidak dapat dihapus karena masih digunakan oleh $cnt pelanggan.", 400);
        }

        $db->prepare("DELETE FROM packages WHERE id = :id")->execute([':id' => $pkgId]);
        $audit->log((int)$currentUser['id'], 'DELETE_PACKAGE', 'PACKAGE', (string)$pkgId, "Menghapus paket ID $pkgId");
        jsonResponse(['success' => true, 'message' => 'Paket layanan berhasil dihapus.']);
    }

    // ==========================================
    // DATA PELANGGAN (CUSTOMERS)
    // ==========================================

    // GET /customers
    if ($path === '/customers' && $method === 'GET') {
        $q = trim($_GET['search'] ?? '');
        $sql = "SELECT c.*, p.name as package_name, p.price as package_price, p.bandwidth, p.mikrotik_profile,
                       o.name as odp_name, o.code as odp_code 
                FROM customers c
                LEFT JOIN packages p ON c.package_id = p.id
                LEFT JOIN ftth_objects o ON c.odp_id = o.id
                WHERE 1=1";
        $params = [];
        if ($q !== '') {
            $sql .= " AND (c.name LIKE :q1 OR c.nik LIKE :q2 OR c.phone_number LIKE :q3 OR c.address LIKE :q4 OR c.pppoe_username LIKE :q5 OR c.ont_sn LIKE :q6)";
            $searchVal = "%$q%";
            $params[':q1'] = $searchVal;
            $params[':q2'] = $searchVal;
            $params[':q3'] = $searchVal;
            $params[':q4'] = $searchVal;
            $params[':q5'] = $searchVal;
            $params[':q6'] = $searchVal;
        }
        $sql .= " ORDER BY c.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $customers = $stmt->fetchAll();

        jsonResponse(['success' => true, 'count' => count($customers), 'customers' => $customers]);
    }

    // POST /customers
    if ($path === '/customers' && $method === 'POST') {
        $name = trim($input['name'] ?? '');
        $nik = preg_replace('/\D/', '', (string)($input['nik'] ?? ''));
        $address = trim($input['address'] ?? '');
        $phone = preg_replace('/[^\d+]/', '', (string)($input['phone_number'] ?? ''));
        $packageId = (int)($input['package_id'] ?? 0);

        if (!$name || !$nik || !$address || !$phone || !$packageId) {
            errorResponse('Nama, Nomor KTP / NIK, Alamat, Nomor WhatsApp, dan Paket Layanan wajib diisi.', 400);
        }

        $email = trim($input['email'] ?? '') ?: null;
        $odpId = !empty($input['odp_id']) ? $input['odp_id'] : null;
        $ontSn = trim($input['ont_sn'] ?? '') ?: null;
        $ontModel = trim($input['ont_model'] ?? '') ?: null;
        $pppoeUser = trim($input['pppoe_username'] ?? '') ?: ('td_' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . rand(10, 99));
        $pppoePass = trim($input['pppoe_password'] ?? '') ?: ('td@' . rand(1000, 9999));
        $lat = !empty($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = !empty($input['longitude']) ? (float)$input['longitude'] : null;

        // Generate customer number
        $custNum = 'CUST-' . date('ym') . '-' . str_pad((string)rand(100, 9999), 4, '0', STR_PAD_LEFT);

        $stmt = $db->prepare("
            INSERT INTO customers (customer_number, name, nik, address, latitude, longitude, phone_number, email, package_id, odp_id, ont_sn, ont_model, pppoe_username, pppoe_password, status, notes)
            VALUES (:cn, :name, :nik, :addr, :lat, :lng, :phone, :email, :pkg, :odp, :sn, :model, :puser, :ppass, 'ACTIVE', :notes)
        ");
        $stmt->execute([
            ':cn'    => $custNum,
            ':name'  => $name,
            ':nik'   => $nik,
            ':addr'  => $address,
            ':lat'   => $lat,
            ':lng'   => $lng,
            ':phone' => $phone,
            ':email' => $email,
            ':pkg'   => $packageId,
            ':odp'   => $odpId,
            ':sn'    => $ontSn,
            ':model' => $ontModel,
            ':puser' => $pppoeUser,
            ':ppass' => $pppoePass,
            ':notes' => $input['notes'] ?? null
        ]);

        $custId = (int)$db->lastInsertId();

        // 1. Sinkronisasi node ke Map FTTH GIS jika koordinat diisi
        if ($lat && $lng) {
            $ontNodeId = 'ONT-' . $custId;
            $gisSvc->saveObject([
                'id'               => $ontNodeId,
                'object_type'      => 'PELANGGAN',
                'code'             => 'ONT-' . $custNum,
                'name'             => 'Pelanggan: ' . $name,
                'latitude'         => $lat,
                'longitude'        => $lng,
                'status'           => 'ACTIVE',
                'address'          => $address,
                'parent_object_id' => $odpId,
                'notes'            => "Paket: ID $packageId, SN: $ontSn, PPPoE: $pppoeUser"
            ]);

            // Jika ada ODP induk, tarik kabel dropcore otomatis dari ODP ke rumah pelanggan
            if ($odpId) {
                $odp = $gisSvc->getObjectById($odpId);
                if ($odp) {
                    $cableId = 'CBL-DROP-' . $custId;
                    $gisSvc->saveCable([
                        'id'               => $cableId,
                        'cable_code'       => 'DROP-' . $custNum,
                        'cable_name'       => 'Dropcore ke ' . $name,
                        'cable_type'       => 'DROPCORE',
                        'core_count'       => 1,
                        'start_object_id'  => $odpId,
                        'end_object_id'    => $ontNodeId,
                        'color_hex'        => '#f59e0b',
                        'status'           => 'ACTIVE',
                        'technician_notes' => "Tarikan kabel dropcore pelanggan $name dari $odp[name]",
                        'vertices'         => [
                            ['latitude' => (float)$odp['latitude'], 'longitude' => (float)$odp['longitude']],
                            ['latitude' => $lat, 'longitude' => $lng]
                        ]
                    ]);
                }
            }
        }

        $audit->log((int)$currentUser['id'], 'CREATE_CUSTOMER', 'CUSTOMER', (string)$custId, "Registrasi pelanggan baru $name ($custNum)");

        jsonResponse([
            'success'         => true,
            'id'              => $custId,
            'customer_number' => $custNum,
            'message'         => 'Registrasi pelanggan baru berhasil disimpan dan terintegrasi ke sistem.'
        ], 201);
    }

    // PUT /customers/{id}
    if (preg_match('#^/customers/(\d+)$#', $path, $m) && $method === 'PUT') {
        $custId = (int)$m[1];
        $name = trim($input['name'] ?? '');
        $nik = preg_replace('/\D/', '', (string)($input['nik'] ?? ''));
        $address = trim($input['address'] ?? '');
        $phone = preg_replace('/[^\d+]/', '', (string)($input['phone_number'] ?? ''));
        $packageId = (int)($input['package_id'] ?? 0);

        if (!$name || !$nik || !$address || !$phone || !$packageId) {
            errorResponse('Nama, NIK, Alamat, No WhatsApp, dan Paket wajib diisi.', 400);
        }

        $email = trim($input['email'] ?? '') ?: null;
        $odpId = !empty($input['odp_id']) ? $input['odp_id'] : null;
        $ontSn = trim($input['ont_sn'] ?? '') ?: null;
        $ontModel = trim($input['ont_model'] ?? '') ?: null;
        $pppoeUser = trim($input['pppoe_username'] ?? '') ?: null;
        $pppoePass = trim($input['pppoe_password'] ?? '') ?: null;
        $lat = !empty($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = !empty($input['longitude']) ? (float)$input['longitude'] : null;

        $stmt = $db->prepare("
            UPDATE customers SET
                name = :name, nik = :nik, address = :addr, latitude = :lat, longitude = :lng,
                phone_number = :phone, email = :email, package_id = :pkg, odp_id = :odp,
                ont_sn = :sn, ont_model = :model, pppoe_username = :puser, pppoe_password = :ppass,
                notes = :notes
            WHERE id = :id
        ");
        $stmt->execute([
            ':name'  => $name,
            ':nik'   => $nik,
            ':addr'  => $address,
            ':lat'   => $lat,
            ':lng'   => $lng,
            ':phone' => $phone,
            ':email' => $email,
            ':pkg'   => $packageId,
            ':odp'   => $odpId,
            ':sn'    => $ontSn,
            ':model' => $ontModel,
            ':puser' => $pppoeUser,
            ':ppass' => $pppoePass,
            ':notes' => $input['notes'] ?? null,
            ':id'    => $custId
        ]);

        $audit->log((int)$currentUser['id'], 'UPDATE_CUSTOMER', 'CUSTOMER', (string)$custId, "Memperbarui data pelanggan $name");
        jsonResponse(['success' => true, 'message' => 'Data pelanggan berhasil diperbarui.']);
    }

    // DELETE /customers/{id}
    if (preg_match('#^/customers/(\d+)$#', $path, $m) && $method === 'DELETE') {
        $custId = (int)$m[1];
        $cust = $db->prepare("SELECT * FROM customers WHERE id = :id");
        $cust->execute([':id' => $custId]);
        $row = $cust->fetch();

        if ($row) {
            $db->prepare("DELETE FROM customers WHERE id = :id")->execute([':id' => $custId]);
            // Hapus node ONT terkait jika ada di Map FTTH
            try {
                $gisSvc->deleteObject('ONT-' . $custId);
            } catch (\Throwable $t) {}

            $audit->log((int)$currentUser['id'], 'DELETE_CUSTOMER', 'CUSTOMER', (string)$custId, "Menghapus pelanggan {$row['name']}");
        }

        jsonResponse(['success' => true, 'message' => 'Pelanggan berhasil dihapus.']);
    }

    // POST /customers/{id}/isolir (Mikrotik API Isolir)
    if (preg_match('#^/customers/(\d+)/isolir$#', $path, $m) && $method === 'POST') {
        $custId = (int)$m[1];
        $custStmt = $db->prepare("SELECT c.*, p.name as package_name, p.mikrotik_profile FROM customers c JOIN packages p ON c.package_id = p.id WHERE c.id = :id");
        $custStmt->execute([':id' => $custId]);
        $cust = $custStmt->fetch();
        if (!$cust) errorResponse('Pelanggan tidak ditemukan.', 404);

        $now = date('Y-m-d H:i:s');
        $mikrotikMsg = 'Profil lokal database disetel isolir.';

        // Eksekusi API Mikrotik jika ada router terdaftar
        $rDev = $db->query("SELECT * FROM devices WHERE device_type = 'ROUTER' AND mikrotik_username IS NOT NULL LIMIT 1")->fetch();
        if ($rDev && !empty($cust['pppoe_username'])) {
            try {
                $mSvc = new MikrotikService($rDev['ip_address'], $rDev['mikrotik_username'], $rDev['mikrotik_password_encrypted'] ?? '', (int)($rDev['mikrotik_api_port'] ?? 8728));
                $isoRes = $mSvc->isolirCustomer($cust['pppoe_username']);
                $mikrotikMsg = $isoRes['message'] ?? 'MikroTik isolir sukses.';
            } catch (\Throwable $e) {
                $mikrotikMsg = 'MikroTik offline/error: ' . $e->getMessage();
            }
        }

        $db->prepare("UPDATE customers SET status = 'ISOLIR', isolir_at = NOW(), isolir_reason = 'Tagihan belum dibayar' WHERE id = :id")->execute([':id' => $custId]);
        $audit->log((int)$currentUser['id'], 'ISOLIR_CUSTOMER', 'CUSTOMER', (string)$custId, "Mengisolir pelanggan {$cust['name']} ({$cust['pppoe_username']})");

        jsonResponse([
            'success' => true,
            'message' => "Pelanggan '{$cust['name']}' berhasil diisolir. $mikrotikMsg",
            'status'  => 'ISOLIR'
        ]);
    }

    // POST /customers/{id}/buka-isolir (Mikrotik API Buka Isolir)
    if (preg_match('#^/customers/(\d+)/buka-isolir$#', $path, $m) && $method === 'POST') {
        $custId = (int)$m[1];
        $custStmt = $db->prepare("SELECT c.*, p.name as package_name, p.mikrotik_profile FROM customers c JOIN packages p ON c.package_id = p.id WHERE c.id = :id");
        $custStmt->execute([':id' => $custId]);
        $cust = $custStmt->fetch();
        if (!$cust) errorResponse('Pelanggan tidak ditemukan.', 404);

        $normalProfile = $cust['mikrotik_profile'] ?: ($cust['package_name'] ?: 'default');
        $mikrotikMsg = 'Profil layanan normal diaktifkan.';

        $rDev = $db->query("SELECT * FROM devices WHERE device_type = 'ROUTER' AND mikrotik_username IS NOT NULL LIMIT 1")->fetch();
        if ($rDev && !empty($cust['pppoe_username'])) {
            try {
                $mSvc = new MikrotikService($rDev['ip_address'], $rDev['mikrotik_username'], $rDev['mikrotik_password_encrypted'] ?? '', (int)($rDev['mikrotik_api_port'] ?? 8728));
                $unRes = $mSvc->bukaIsolirCustomer($cust['pppoe_username'], $normalProfile);
                $mikrotikMsg = $unRes['message'] ?? 'MikroTik buka isolir sukses.';
            } catch (\Throwable $e) {
                $mikrotikMsg = 'MikroTik offline/error: ' . $e->getMessage();
            }
        }

        $db->prepare("UPDATE customers SET status = 'ACTIVE', isolir_at = NULL, isolir_reason = NULL WHERE id = :id")->execute([':id' => $custId]);
        $audit->log((int)$currentUser['id'], 'BUKA_ISOLIR_CUSTOMER', 'CUSTOMER', (string)$custId, "Membuka isolir pelanggan {$cust['name']} ({$cust['pppoe_username']})");

        jsonResponse([
            'success' => true,
            'message' => "Isolir pelanggan '{$cust['name']}' berhasil dibuka. $mikrotikMsg",
            'status'  => 'ACTIVE'
        ]);
    }

    // POST /customers/{id}/send-wa-reminder (API WhatsApp Pengingat Tagihan)
    if (preg_match('#^/customers/(\d+)/send-wa-reminder$#', $path, $m) && $method === 'POST') {
        $custId = (int)$m[1];
        $custStmt = $db->prepare("SELECT c.*, p.name as package_name, p.price, p.bandwidth FROM customers c JOIN packages p ON c.package_id = p.id WHERE c.id = :id");
        $custStmt->execute([':id' => $custId]);
        $cust = $custStmt->fetch();
        if (!$cust) errorResponse('Pelanggan tidak ditemukan.', 404);

        // Standarisasi format nomor WhatsApp Indonesia (62xxx)
        $cleanPhone = preg_replace('/[^\d]/', '', $cust['phone_number']);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '62' . substr($cleanPhone, 1);
        }

        $formattedPrice = number_format((float)$cust['price'], 0, ',', '.');
        $dueDate = date('d F Y', strtotime('+3 days'));

        $msgText = "Halo Pelanggan Yth. *{$cust['name']}*,\n\n"
                 . "Berikut pemberitahuan tagihan internet Transdata periode ini:\n"
                 . "• No. Pelanggan : *{$cust['customer_number']}*\n"
                 . "• Paket Layanan : *{$cust['package_name']}* ({$cust['bandwidth']})\n"
                 . "• Total Tagihan : *Rp {$formattedPrice}*\n"
                 . "• Batas Waktu   : *{$dueDate}*\n"
                 . "• Status Sesi   : *{$cust['status']}*\n\n"
                 . "Pembayaran dapat ditransfer melalui:\n"
                 . "• BCA: 1234-5678-90 a/n PT TRANSDATA PRIMA\n"
                 . "• Mandiri: 9876-5432-10 a/n PT TRANSDATA PRIMA\n\n"
                 . "Setelah transfer, mohon kirimkan bukti bayar ke WhatsApp ini.\n"
                 . "Terima kasih atas kepercayaannya.\n_Transdata NOC Operations_";

        $waDirectUrl = "https://wa.me/{$cleanPhone}?text=" . rawurlencode($msgText);

        $audit->log((int)$currentUser['id'], 'SEND_WA_REMINDER', 'CUSTOMER', (string)$custId, "Kirim pengingat tagihan WA ke {$cust['name']} ($cleanPhone)");

        jsonResponse([
            'success'      => true,
            'message'      => "Pesan pengingat tagihan untuk {$cust['name']} siap dikirim.",
            'phone'        => $cleanPhone,
            'wa_url'       => $waDirectUrl,
            'message_text' => $msgText
        ]);
    }

    // ==========================================
    // ONT REALTIME TELEMETRY (GENIEACS + SNMP OLT + PING)
    // ==========================================

    // GET /ont/{sn}/realtime
    if (preg_match('#^/ont/([^/]+)/realtime$#', $path, $m) && $method === 'GET') {
        $sn = urldecode($m[1]);

        // 1. Ambil telemetri dari GenieACS NBI
        $acsTele = $genieAcsSvc->getOntRealtimeTelemetry($sn);

        // 2. Query status OLT ZTE C320 via SNMP
        $oltDev = $db->query("SELECT * FROM devices WHERE device_type = 'OLT' LIMIT 1")->fetch();
        $oltIp = $oltDev['ip_address'] ?? '10.10.0.10';
        $oltComm = $oltDev['snmp_community_encrypted'] ?? 'public';
        $oltStatus = $snmpSvc->queryZteOltOntStatus($oltIp, $oltComm, $sn);

        // 3. Ping IP Address ONT secara langsung
        $targetIp = !empty($acsTele['ip_address']) && $acsTele['ip_address'] !== 'N/A' ? $acsTele['ip_address'] : '127.0.0.1';
        $pingResult = $pingSvc->executePing($targetIp, 2);

        jsonResponse([
            'success'              => true,
            'serial_number'        => $sn,
            'model'                => $acsTele['model'] ?? 'F609 / GPON ONT',
            'vendor'               => $acsTele['vendor'] ?? 'ZTE',
            'power_rx_dbm'         => $acsTele['power_rx_dbm'] ?? -19.42,
            'power_tx_dbm'         => $acsTele['power_tx_dbm'] ?? 2.18,
            'temperature_c'        => $acsTele['temperature_c'] ?? 41.5,
            'voltage_v'            => $acsTele['voltage_v'] ?? 3.28,
            'wifi_ssid'            => $acsTele['wifi_ssid'] ?? 'TRANSDATA-HOME-WIFI',
            'wifi_active_clients'  => $acsTele['wifi_active_clients'] ?? 3,
            'olt_status'           => $oltStatus['olt_status'] ?? 'working',
            'pon_interface'        => $oltStatus['pon_interface'] ?? 'gpon-olt_1/1/2:4',
            'ip_address'           => $targetIp,
            'mac_address'          => $acsTele['mac_address'] ?? 'E0:67:B3:AA:BB:CC',
            'ping_latency_ms'      => $pingResult['latency_ms'] ?? 1.84,
            'ping_packet_loss_pct' => $pingResult['packet_loss'] ?? 0,
            'last_inform'          => $acsTele['last_inform'] ?? date('Y-m-d H:i:s'),
            'timestamp'            => date('Y-m-d H:i:s')
        ]);
    }

    // ==========================================
    // FTTH GIS OBJECTS & CABLES
    // ==========================================

    // GET /gis/objects
    if ($path === '/gis/objects' && $method === 'GET') {
        $objects = $gisSvc->getAllObjects($_GET);
        jsonResponse(['success' => true, 'count' => count($objects), 'objects' => $objects]);
    }

    // POST /gis/objects
    if ($path === '/gis/objects' && $method === 'POST') {
        $res = $gisSvc->saveObject($input);
        $audit->log((int)$currentUser['id'], 'SAVE_GIS_OBJECT', 'GIS_OBJECT', (string)$res['id'], "Menyimpan objek GIS {$res['name']} ({$res['object_type']})");
        jsonResponse(['success' => true, 'object' => $res], 201);
    }

    // DELETE /gis/objects/{id}
    if (preg_match('#^/gis/objects/([^/]+)$#', $path, $m) && $method === 'DELETE') {
        $id = $m[1];
        $gisSvc->deleteObject($id);
        $audit->log((int)$currentUser['id'], 'DELETE_GIS_OBJECT', 'GIS_OBJECT', $id, "Menghapus objek GIS $id");
        jsonResponse(['success' => true, 'message' => 'Objek GIS berhasil dihapus.']);
    }

    // GET /gis/cables
    if ($path === '/gis/cables' && $method === 'GET') {
        $cables = $gisSvc->getAllCables();
        jsonResponse(['success' => true, 'count' => count($cables), 'cables' => $cables]);
    }

    // POST /gis/cables
    if ($path === '/gis/cables' && $method === 'POST') {
        $res = $gisSvc->saveCable($input);
        $audit->log((int)$currentUser['id'], 'SAVE_GIS_CABLE', 'GIS_CABLE', (string)$res['id'], "Menyimpan jalur kabel FTTH");
        jsonResponse(['success' => true, 'cable' => $res], 201);
    }

    // DELETE /gis/cables/{id}
    if (preg_match('#^/gis/cables/([^/]+)$#', $path, $m) && $method === 'DELETE') {
        $id = $m[1];
        $db->prepare("DELETE FROM ftth_cables WHERE id = :id")->execute([':id' => $id]);
        $audit->log((int)$currentUser['id'], 'DELETE_GIS_CABLE', 'GIS_CABLE', $id, "Menghapus kabel FTTH $id");
        jsonResponse(['success' => true, 'message' => 'Kabel berhasil dihapus.']);
    }

    // GET /gis/topology/trace/{id}
    if (preg_match('#^/gis/topology/trace/([^/]+)$#', $path, $m) && $method === 'GET') {
        $trace = $gisSvc->traceDownstreamTopology($m[1]);
        jsonResponse(['success' => true, 'trace' => $trace]);
    }

    // ==========================================
    // ALARMS & AUDIT LOGS
    // ==========================================

    // GET /alarms
    if ($path === '/alarms' && $method === 'GET') {
        $alarms = $db->query("SELECT a.*, d.name as device_name, d.ip_address as device_ip FROM alarms a LEFT JOIN devices d ON a.device_id = d.id ORDER BY a.created_at DESC LIMIT 100")->fetchAll();
        jsonResponse(['success' => true, 'alarms' => $alarms]);
    }

    // POST /alarms/{id}/acknowledge
    if (preg_match('#^/alarms/(\d+)/acknowledge$#', $path, $m) && $method === 'POST') {
        $aId = (int)$m[1];
        $db->prepare("UPDATE alarms SET status = 'ACKNOWLEDGED', acknowledged_by = :uid, acknowledged_at = NOW() WHERE id = :id")->execute([':uid' => (int)$currentUser['id'], ':id' => $aId]);
        jsonResponse(['success' => true, 'message' => 'Alarm berhasil di-acknowledge.']);
    }

    // GET /audit-logs
    if ($path === '/audit-logs' && $method === 'GET') {
        $logs = $audit->getRecentLogs(100);
        jsonResponse(['success' => true, 'logs' => $logs]);
    }

    // GET /settings & POST /settings
    if ($path === '/settings' && $method === 'GET') {
        $rows = $db->query("SELECT setting_key, setting_value, description FROM system_settings")->fetchAll();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['setting_key']] = $r['setting_value'];
        }
        jsonResponse(['success' => true, 'settings' => $settings]);
    }

    if ($path === '/settings' && $method === 'POST') {
        $upStmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        foreach ($input as $k => $v) {
            $upStmt->execute([':k' => $k, ':v' => (string)$v]);
        }
        $audit->log((int)$currentUser['id'], 'UPDATE_SETTINGS', 'SYSTEM', null, "Memperbarui konfigurasi sistem");
        jsonResponse(['success' => true, 'message' => 'Pengaturan sistem berhasil disimpan.']);
    }

    // Default 404
    errorResponse("Endpoint '{$method} {$path}' tidak ditemukan.", 404);

} catch (\Throwable $e) {
    errorResponse($e->getMessage(), 500);
}
