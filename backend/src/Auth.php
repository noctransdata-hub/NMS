<?php
namespace Transdata\Nms;

use PDO;

class Auth
{
    private PDO $db;
    private array $config;

    public function __construct(PDO $db, array $config)
    {
        $this->db = $db;
        $this->config = $config;
    }

    public function hasAdminUser(): bool
    {
        $stmt = $this->db->query("SELECT COUNT(*) as cnt FROM users");
        $res = $stmt->fetch();
        return ((int)($res['cnt'] ?? 0)) > 0;
    }

    public function createInitialAdmin(string $username, string $email, string $password, string $fullName): array
    {
        if ($this->hasAdminUser()) {
            throw new \RuntimeException('Akun administrator pertama sudah dibuat.', 400);
        }

        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('Password minimal 8 karakter.', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        
        $stmt = $this->db->prepare("
            INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
            VALUES (:username, :email, :password_hash, :full_name, 1, 1)
        ");
        $stmt->execute([
            ':username'      => $username,
            ':email'         => $email,
            ':password_hash' => $hash,
            ':full_name'     => $fullName
        ]);

        $userId = (int)$this->db->lastInsertId();
        return $this->getUserById($userId);
    }

    public function login(string $username, string $password, string $ipAddress): array
    {
        $stmt = $this->db->prepare("
            SELECT u.*, r.name as role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE (u.username = :user OR u.email = :user) AND u.is_active = 1
        ");
        $stmt->execute([':user' => $username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new \RuntimeException('Username atau password salah.', 401);
        }

        // Update last login
        $up = $this->db->prepare("UPDATE users SET last_login = NOW() WHERE id = :id");
        $up->execute([':id' => $user['id']]);

        // Generate token
        $token = $this->generateToken([
            'id'       => $user['id'],
            'username' => $user['username'],
            'role'     => $user['role_name'],
            'role_id'  => $user['role_id']
        ]);

        unset($user['password_hash']);
        return [
            'token' => $token,
            'user'  => $user
        ];
    }

    public function validateToken(?string $authHeader): ?array
    {
        if (!$authHeader || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerB64, $payloadB64, $sigB64] = $parts;
        $secret = $this->config['app']['jwt_secret'] ?? 'transdata_jwt_secret';
        $expectedSig = hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true);
        $expectedB64 = strtr(rtrim(base64_encode($expectedSig), '='), '+/', '-_');

        if (!hash_equals($expectedB64, $sigB64)) {
            return null;
        }

        $payload = json_decode(base64_decode(strtr($payloadB64, '-_', '+/')), true);
        if (!$payload || ($payload['exp'] ?? 0) < time()) {
            return null;
        }

        return $payload;
    }

    public function getUserById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name as role_name, u.is_active, u.created_at
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = :id
        ");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    private function generateToken(array $data): string
    {
        $secret = $this->config['app']['jwt_secret'] ?? 'transdata_jwt_secret';
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $payload = array_merge($data, [
            'iat' => time(),
            'exp' => time() + ($this->config['app']['session_lifetime'] ?? 86400)
        ]);

        $b64Header = strtr(rtrim(base64_encode(json_encode($header)), '='), '+/', '-_');
        $b64Payload = strtr(rtrim(base64_encode(json_encode($payload)), '='), '+/', '-_');
        $sig = hash_hmac('sha256', "$b64Header.$b64Payload", $secret, true);
        $b64Sig = strtr(rtrim(base64_encode($sig), '='), '+/', '-_');

        return "$b64Header.$b64Payload.$b64Sig";
    }
}
