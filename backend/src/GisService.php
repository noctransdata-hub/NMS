<?php
namespace Transdata\Nms;

use PDO;

class GisService
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function getAllObjects(array $filters = []): array
    {
        $sql = "SELECT o.*, p.name as parent_name FROM ftth_objects o LEFT JOIN ftth_objects p ON o.parent_object_id = p.id WHERE 1=1";
        $params = [];

        if (!empty($filters['object_type'])) {
            $sql .= " AND o.object_type = :type";
            $params[':type'] = $filters['object_type'];
        }

        if (!empty($filters['status'])) {
            $sql .= " AND o.status = :status";
            $params[':status'] = $filters['status'];
        }

        if (!empty($filters['search'])) {
            $sql .= " AND (o.name LIKE :q OR o.code LIKE :q OR o.address LIKE :q)";
            $params[':q'] = '%' . $filters['search'] . '%';
        }

        $sql .= " ORDER BY o.created_at ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $objects = $stmt->fetchAll();

        // Include splitters for each object
        foreach ($objects as &$obj) {
            $spStmt = $this->db->prepare("SELECT * FROM ftth_splitters WHERE parent_object_id = :id");
            $spStmt->execute([':id' => $obj['id']]);
            $obj['splitters'] = $spStmt->fetchAll();
        }

        return $objects;
    }

    public function saveObject(array $data): array
    {
        $id = $data['id'] ?? $this->generateUuid();
        $isUpdate = !empty($data['id']);

        $stmt = $this->db->prepare("SELECT id FROM ftth_objects WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $exists = (bool)$stmt->fetch();

        if ($exists) {
            $sql = "UPDATE ftth_objects SET 
                object_type = :object_type,
                code = :code,
                name = :name,
                latitude = :latitude,
                longitude = :longitude,
                status = :status,
                address = :address,
                port_capacity = :port_capacity,
                ports_used = :ports_used,
                parent_object_id = :parent_object_id,
                notes = :notes
                WHERE id = :id";
        } else {
            $sql = "INSERT INTO ftth_objects 
                (id, object_type, code, name, latitude, longitude, status, address, port_capacity, ports_used, parent_object_id, notes)
                VALUES (:id, :object_type, :code, :name, :latitude, :longitude, :status, :address, :port_capacity, :ports_used, :parent_object_id, :notes)";
        }

        $cmd = $this->db->prepare($sql);
        $cmd->execute([
            ':id'               => $id,
            ':object_type'      => $data['object_type'],
            ':code'             => $data['code'],
            ':name'             => $data['name'],
            ':latitude'         => (float)$data['latitude'],
            ':longitude'        => (float)$data['longitude'],
            ':status'           => $data['status'] ?? 'ACTIVE',
            ':address'          => $data['address'] ?? null,
            ':port_capacity'    => (int)($data['port_capacity'] ?? 0),
            ':ports_used'       => (int)($data['ports_used'] ?? 0),
            ':parent_object_id' => !empty($data['parent_object_id']) ? $data['parent_object_id'] : null,
            ':notes'            => $data['notes'] ?? null
        ]);

        return $this->getObjectById($id);
    }

    public function deleteObject(string $id): bool
    {
        // Validasi dependensi: periksa apakah ada downstream objects atau kabel terhubung
        $stmt = $this->db->prepare("SELECT COUNT(*) as cnt FROM ftth_objects WHERE parent_object_id = :id");
        $stmt->execute([':id' => $id]);
        if (((int)$stmt->fetch()['cnt']) > 0) {
            throw new \RuntimeException('Tidak dapat menghapus objek: masih terdapat sub-node jaringan di bawah objek ini.', 400);
        }

        $del = $this->db->prepare("DELETE FROM ftth_objects WHERE id = :id");
        return $del->execute([':id' => $id]);
    }

    public function getObjectById(string $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM ftth_objects WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $obj = $stmt->fetch();
        if (!$obj) return null;

        $sp = $this->db->prepare("SELECT * FROM ftth_splitters WHERE parent_object_id = :id");
        $sp->execute([':id' => $id]);
        $obj['splitters'] = $sp->fetchAll();

        return $obj;
    }

    public function getAllCables(): array
    {
        $stmt = $this->db->query("
            SELECT c.*, 
                   s.name as start_object_name, s.code as start_object_code,
                   e.name as end_object_name, e.code as end_object_code
            FROM ftth_cables c
            LEFT JOIN ftth_objects s ON c.start_object_id = s.id
            LEFT JOIN ftth_objects e ON c.end_object_id = e.id
            ORDER BY c.created_at ASC
        ");
        $cables = $stmt->fetchAll();

        foreach ($cables as &$cable) {
            $vStmt = $this->db->prepare("SELECT vertex_order, latitude, longitude FROM ftth_cable_vertices WHERE cable_id = :cid ORDER BY vertex_order ASC");
            $vStmt->execute([':cid' => $cable['id']]);
            $cable['vertices'] = $vStmt->fetchAll();
        }

        return $cables;
    }

    public function saveCable(array $data): array
    {
        $id = $data['id'] ?? $this->generateUuid();
        $vertices = $data['vertices'] ?? [];

        // Hitung panjang jalur nyata menggunakan formula Haversine
        $calculatedMeters = $this->calculatePolylineLengthMeters($vertices);

        $stmt = $this->db->prepare("SELECT id FROM ftth_cables WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $exists = (bool)$stmt->fetch();

        if ($exists) {
            $sql = "UPDATE ftth_cables SET
                cable_code = :code,
                cable_name = :name,
                cable_type = :cable_type,
                core_count = :core_count,
                calculated_length_m = :calc_len,
                actual_installed_length_m = :act_len,
                start_object_id = :start_id,
                end_object_id = :end_id,
                color_hex = :color_hex,
                status = :status,
                technician_notes = :notes
                WHERE id = :id";
        } else {
            $sql = "INSERT INTO ftth_cables
                (id, cable_code, cable_name, cable_type, core_count, calculated_length_m, actual_installed_length_m, start_object_id, end_object_id, color_hex, status, technician_notes)
                VALUES (:id, :code, :name, :cable_type, :core_count, :calc_len, :act_len, :start_id, :end_id, :color_hex, :status, :notes)";
        }

        $cmd = $this->db->prepare($sql);
        $cmd->execute([
            ':id'         => $id,
            ':code'       => $data['cable_code'],
            ':name'       => $data['cable_name'],
            ':cable_type' => $data['cable_type'] ?? 'DISTRIBUTION',
            ':core_count' => (int)($data['core_count'] ?? 12),
            ':calc_len'   => $calculatedMeters,
            ':act_len'    => !empty($data['actual_installed_length_m']) ? (float)$data['actual_installed_length_m'] : null,
            ':start_id'   => !empty($data['start_object_id']) ? $data['start_object_id'] : null,
            ':end_id'     => !empty($data['end_object_id']) ? $data['end_object_id'] : null,
            ':color_hex'  => $data['color_hex'] ?? '#3b82f6',
            ':status'     => $data['status'] ?? 'ACTIVE',
            ':notes'      => $data['technician_notes'] ?? null
        ]);

        // Simpan vertex koordinat jalur kabel
        $this->db->prepare("DELETE FROM ftth_cable_vertices WHERE cable_id = :id")->execute([':id' => $id]);
        if (!empty($vertices)) {
            $vInsert = $this->db->prepare("INSERT INTO ftth_cable_vertices (cable_id, vertex_order, latitude, longitude) VALUES (:cid, :vorder, :lat, :lng)");
            foreach ($vertices as $idx => $v) {
                $vInsert->execute([
                    ':cid'    => $id,
                    ':vorder' => $idx + 1,
                    ':lat'    => (float)$v['latitude'],
                    ':lng'    => (float)$v['longitude']
                ]);
            }
        }

        return [
            'id'                  => $id,
            'calculated_length_m' => $calculatedMeters,
            'vertices_count'      => count($vertices)
        ];
    }

    /**
     * Hitung panjang segmen polyline dalam meter menggunakan rumus Haversine
     */
    public function calculatePolylineLengthMeters(array $vertices): float
    {
        if (count($vertices) < 2) return 0.00;

        $earthRadiusM = 6371000.0;
        $totalDistance = 0.00;

        for ($i = 0; $i < count($vertices) - 1; $i++) {
            $lat1 = deg2rad((float)$vertices[$i]['latitude']);
            $lng1 = deg2rad((float)$vertices[$i]['longitude']);
            $lat2 = deg2rad((float)$vertices[$i + 1]['latitude']);
            $lng2 = deg2rad((float)$vertices[$i + 1]['longitude']);

            $dLat = $lat2 - $lat1;
            $dLng = $lng2 - $lng1;

            $a = sin($dLat / 2) * sin($dLat / 2) +
                 cos($lat1) * cos($lat2) * sin($dLng / 2) * sin($dLng / 2);
            $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
            $segmentDist = $earthRadiusM * $c;

            $totalDistance += $segmentDist;
        }

        return round($totalDistance, 2);
    }

    /**
     * Analisis Dampak Kerusakan Jaringan (Impact Analysis)
     * Mengembalikan daftar pelanggan yang terdampak jika objek/kabel mengalami gangguan
     */
    public function traceDownstreamCustomers(string $objectId): array
    {
        // Temukan seluruh sub-node turunan secara rekursif
        $downstreamIds = [$objectId];
        $queue = [$objectId];

        while (!empty($queue)) {
            $currId = array_shift($queue);
            $stmt = $this->db->prepare("SELECT id FROM ftth_objects WHERE parent_object_id = :pid");
            $stmt->execute([':pid' => $currId]);
            $children = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($children as $cid) {
                if (!in_array($cid, $downstreamIds)) {
                    $downstreamIds[] = $cid;
                    $queue[] = $cid;
                }
            }
        }

        // Ambil data pelanggan yang terhubung ke node-node ini
        $inClause = implode(',', array_fill(0, count($downstreamIds), '?'));
        $cStmt = $this->db->prepare("
            SELECT c.*, o.name as odp_name, o.code as odp_code
            FROM ftth_customers c
            JOIN ftth_objects o ON c.connected_odp_id = o.id
            WHERE c.connected_odp_id IN ($inClause)
        ");
        $cStmt->execute($downstreamIds);
        $customers = $cStmt->fetchAll();

        return [
            'target_object_id'    => $objectId,
            'affected_nodes'      => count($downstreamIds),
            'affected_subscribers'=> count($customers),
            'subscribers'         => $customers
        ];
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
