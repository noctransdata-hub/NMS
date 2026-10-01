<?php
namespace Transdata\Nms;

use PDO;
use PDOException;

/**
 * MariaDB PDO Connection Manager with Prepared Statements
 */
class Database
{
    private static ?PDO $instance = null;
    private static array $config = [];

    public static function setConfig(array $config): void
    {
        self::$config = $config;
    }

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $cfg = self::$config['db'] ?? [
                'host'     => '127.0.0.1',
                'port'     => 3306,
                'database' => 'transdata_nms',
                'username' => 'root',
                'password' => '',
                'charset'  => 'utf8mb4'
            ];

            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $cfg['host'],
                $cfg['port'],
                $cfg['database'],
                $cfg['charset'] ?? 'utf8mb4'
            );

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, $cfg['username'], $cfg['password'], $options);
            } catch (PDOException $e) {
                // Jangan bocorkan kredensial dalam pesan error
                throw new \RuntimeException('Koneksi database MariaDB gagal: ' . $e->getMessage(), 500);
            }
        }

        return self::$instance;
    }
}
