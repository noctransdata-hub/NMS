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

    // Default 404
    errorResponse("Endpoint '{$method} {$path}' tidak ditemukan.", 404);

} catch (\Throwable $e) {
    errorResponse($e->getMessage(), 500);
}
