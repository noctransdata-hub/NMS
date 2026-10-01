<?php
/**
 * Transdata NMS - Production Configuration Template
 * Salin file ini ke config.php dan sesuaikan nilai dengan server Anda.
 * JANGAN PERNAH commit kredensial asli ke repository publik.
 */

return [
    'db' => [
        'host'     => getenv('DB_HOST') ?: '127.0.0.1',
        'port'     => getenv('DB_PORT') ?: 3306,
        'database' => getenv('DB_NAME') ?: 'transdata_nms',
        'username' => getenv('DB_USER') ?: 'transdata_user',
        'password' => getenv('DB_PASS') ?: 'GantiDenganPasswordKuat123!',
        'charset'  => 'utf8mb4'
    ],
    'app' => [
        'name'            => 'Transdata NMS',
        'env'             => getenv('APP_ENV') ?: 'production',
        'url'             => getenv('APP_URL') ?: 'https://nms.transdata.net.id',
        'jwt_secret'      => getenv('JWT_SECRET') ?: 'ganti_dengan_random_64_karakter_hex_rahasia_sebelum_produksi',
        'session_lifetime'=> 86400, // 24 jam dalam detik
        'encryption_key'  => getenv('APP_ENC_KEY') ?: 'aes_256_gcm_secret_key_32_bytes_len'
    ],
    'snmp' => [
        'binary_path'    => '/usr/bin/snmpget',
        'walk_binary'    => '/usr/bin/snmpwalk',
        'default_community' => 'public',
        'default_version'   => 'v2c',
        'timeout_sec'       => 3,
        'retries'           => 2
    ],
    'ping' => [
        'binary_path' => '/bin/ping',
        'default_count' => 4,
        'timeout_sec'   => 5
    ],
    'genieacs' => [
        'nbi_url'     => getenv('GENIEACS_NBI_URL') ?: 'http://127.0.0.1:7557',
        'timeout_sec' => 5
    ]
];
