<?php
namespace Transdata\Nms;

use PDO;

class AuditLogger
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function log(?int $userId, string $action, string $targetType, ?string $targetId = null, ?string $details = null, ?string $ipAddress = null): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address)
            VALUES (:uid, :action, :type, :tid, :details, :ip)
        ");
        $stmt->execute([
            ':uid'     => $userId,
            ':action'  => $action,
            ':type'    => $targetType,
            ':tid'     => $targetId,
            ':details' => $details,
            ':ip'      => $ipAddress ?? ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1')
        ]);
    }

    public function getRecentLogs(int $limit = 100): array
    {
        $stmt = $this->db->prepare("
            SELECT a.*, u.username, u.full_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT :lim
        ");
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
