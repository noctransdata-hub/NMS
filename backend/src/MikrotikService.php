<?php
namespace Transdata\Nms;

class MikrotikService
{
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private int $timeout;

    public function __construct(string $host, string $username, string $password, int $port = 8728, int $timeout = 5)
    {
        $this->host = $host;
        $this->username = $username;
        $this->password = $password;
        $this->port = $port;
        $this->timeout = $timeout;
    }

    /**
     * Uji koneksi socket TCP aktual ke port RouterOS API
     */
    public function testConnection(): array
    {
        if (!filter_var($this->host, FILTER_VALIDATE_IP)) {
            return [
                'success' => false,
                'status'  => 'ERROR',
                'message' => 'Alamat IP router tidak valid.'
            ];
        }

        $startTime = microtime(true);
        $errno = 0;
        $errstr = '';

        $fp = @fsockopen($this->host, $this->port, $errno, $errstr, $this->timeout);
        $durationMs = round((microtime(true) - $startTime) * 1000, 2);

        if (!$fp) {
            return [
                'success'     => false,
                'status'      => 'UNREACHABLE',
                'latency_ms'  => null,
                'error_code'  => $errno,
                'message'     => sprintf('Koneksi ke RouterOS API %s:%d gagal (%d: %s)', $this->host, $this->port, $errno, $errstr ?: 'Connection Refused / Timeout'),
                'timestamp'   => date('Y-m-d H:i:s')
            ];
        }

        fclose($fp);

        return [
            'success'     => true,
            'status'      => 'CONNECTED',
            'host'        => $this->host,
            'port'        => $this->port,
            'latency_ms'  => $durationMs,
            'message'     => sprintf('Port API MikroTik (%d) aktif dan merespons dalam %0.2f ms', $this->port, $durationMs),
            'timestamp'   => date('Y-m-d H:i:s')
        ];
    }

    /**
     * RouterOS binary protocol packet transmitter (RFC RouterOS API standard)
     */
    public function executeCommand(string $command, array $params = []): array
    {
        $fp = @fsockopen($this->host, $this->port, $errno, $errstr, $this->timeout);
        if (!$fp) {
            return [
                'success' => false,
                'error'   => "Gagal menghubungkan ke {$this->host}:{$this->port} ($errstr)"
            ];
        }

        stream_set_timeout($fp, $this->timeout);

        // Login protocol (RouterOS v6.43+ uses plain login word format)
        $this->writeWord($fp, '/login');
        $this->writeWord($fp, '=name=' . $this->username);
        $this->writeWord($fp, '=password=' . $this->password);
        $this->writeWord($fp, '');

        $loginResponse = $this->readSentence($fp);
        if (empty($loginResponse) || !isset($loginResponse['!done'])) {
            fclose($fp);
            return [
                'success' => false,
                'error'   => 'Autentikasi RouterOS gagal: kredensial ditolak atau timeout'
            ];
        }

        // Execute target command
        $this->writeWord($fp, $command);
        foreach ($params as $k => $v) {
            $this->writeWord($fp, "=$k=$v");
        }
        $this->writeWord($fp, '');

        $result = [];
        while (true) {
            $sentence = $this->readSentence($fp);
            if (isset($sentence['!done'])) {
                break;
            }
            if (isset($sentence['!trap'])) {
                fclose($fp);
                return [
                    'success' => false,
                    'error'   => $sentence['message'] ?? 'Perintah ditolak oleh RouterOS'
                ];
            }
            if (isset($sentence['!re'])) {
                $result[] = $sentence;
            }
        }

        fclose($fp);
        return [
            'success' => true,
            'data'    => $result
        ];
    }

    private function writeWord($fp, string $word): void
    {
        $len = strlen($word);
        if ($len < 0x80) {
            fwrite($fp, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($fp, chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        } elseif ($len < 0x200000) {
            $len |= 0xC00000;
            fwrite($fp, chr(($len >> 16) & 0xFF) . chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        }
        fwrite($fp, $word);
    }

    private function readSentence($fp): array
    {
        $sentence = [];
        while (true) {
            $lenByte = fread($fp, 1);
            if ($lenByte === false || strlen($lenByte) === 0) {
                break;
            }
            $len = ord($lenByte);
            if ($len === 0) {
                break; // End of sentence
            }
            if (($len & 0x80) === 0x80) {
                $b2 = ord(fread($fp, 1));
                $len = (($len & 0x7F) << 8) + $b2;
            }

            $word = '';
            $readBytes = 0;
            while ($readBytes < $len) {
                $chunk = fread($fp, $len - $readBytes);
                if ($chunk === false) break;
                $word .= $chunk;
                $readBytes += strlen($chunk);
            }

            if (str_starts_with($word, '!')) {
                $sentence[$word] = true;
            } elseif (str_starts_with($word, '=')) {
                $parts = explode('=', substr($word, 1), 2);
                $sentence[$parts[0]] = $parts[1] ?? '';
            }
        }
        return $sentence;
    }
}
