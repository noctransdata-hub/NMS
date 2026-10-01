<?php
namespace Transdata\Nms;

class PingService
{
    private string $pingBinary;
    private int $defaultCount;

    public function __construct(string $pingBinary = '/bin/ping', int $defaultCount = 4)
    {
        $this->pingBinary = is_executable($pingBinary) ? $pingBinary : '/bin/ping';
        $this->defaultCount = $defaultCount;
    }

    /**
     * Jalankan tes ping ICMP nyata ke alamat IP perangkat
     */
    public function executePing(string $ipAddress, int $count = 4, int $timeoutSec = 5): array
    {
        // Validasi ketat IP Address untuk mencegah command injection
        if (!filter_var($ipAddress, FILTER_VALIDATE_IP)) {
            return [
                'success'     => false,
                'status'      => 'ERROR',
                'latency_ms'  => null,
                'packet_loss' => 100.0,
                'output'      => 'IP address tidak valid: ' . htmlspecialchars($ipAddress),
                'error'       => 'Format IP address tidak valid',
                'timestamp'   => date('Y-m-d H:i:s')
            ];
        }

        $count = max(1, min(10, $count));
        $timeoutSec = max(1, min(15, $timeoutSec));

        // Command line dengan argumen terpisah aman
        $cmd = sprintf(
            '%s -c %d -W %d %s 2>&1',
            escapeshellcmd($this->pingBinary),
            $count,
            $timeoutSec,
            escapeshellarg($ipAddress)
        );

        $outputLines = [];
        $exitCode = 0;
        exec($cmd, $outputLines, $exitCode);
        $rawOutput = implode("\n", $outputLines);

        $parsed = $this->parsePingOutput($rawOutput, $count);
        $isOnline = ($parsed['packet_loss'] < 100.0 && $parsed['latency_avg'] !== null);

        return [
            'success'          => $isOnline,
            'status'           => $isOnline ? 'ONLINE' : 'OFFLINE',
            'ip_address'       => $ipAddress,
            'packets_sent'     => $count,
            'packet_loss'      => $parsed['packet_loss'],
            'latency_ms'       => $parsed['latency_avg'],
            'latency_min_ms'   => $parsed['latency_min'],
            'latency_max_ms'   => $parsed['latency_max'],
            'latency_mdev_ms'  => $parsed['latency_mdev'],
            'output'           => $rawOutput,
            'exit_code'        => $exitCode,
            'timestamp'        => date('Y-m-d H:i:s')
        ];
    }

    private function parsePingOutput(string $output, int $expectedCount): array
    {
        $loss = 100.0;
        $min = null;
        $avg = null;
        $max = null;
        $mdev = null;

        // Parse: 4 packets transmitted, 4 received, 0% packet loss
        if (preg_match('/(\d+)\s+(?:packets\s+)?transmitted.*?(\d+)\s+(?:packets\s+)?received.*?(\d+(?:\.\d+)?)%\s+packet\s+loss/i', $output, $matches)) {
            $loss = (float)$matches[3];
        }

        // Parse: rtt min/avg/max/mdev = 0.148/0.210/0.320/0.045 ms
        if (preg_match('/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)\/([0-9.]+)/i', $output, $matches)) {
            $min = (float)$matches[1];
            $avg = (float)$matches[2];
            $max = (float)$matches[3];
            $mdev = (float)$matches[4];
        }

        return [
            'packet_loss'  => $loss,
            'latency_min'  => $min,
            'latency_avg'  => $avg,
            'latency_max'  => $max,
            'latency_mdev' => $mdev
        ];
    }
}
