<?php
namespace Transdata\Nms;

class GenieAcsService
{
    private string $nbiUrl;
    private int $timeout;

    public function __construct(string $nbiUrl = 'http://127.0.0.1:7557', int $timeout = 6)
    {
        $this->nbiUrl = rtrim($nbiUrl, '/');
        $this->timeout = $timeout;
    }

    /**
     * Ambil daftar perangkat CPE / ONT dari GenieACS NBI
     */
    public function getDevices(array $projection = []): array
    {
        $fields = !empty($projection) ? implode(',', $projection) : '_id,_lastInform,_registered,InternetGatewayDevice.DeviceInfo.Manufacturer,InternetGatewayDevice.DeviceInfo.ModelName,InternetGatewayDevice.DeviceInfo.SerialNumber,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress,InternetGatewayDevice.WANDevice.1.WANCommonInterfaceConfig.WANAccessType,Device.Optical.Interface.1.RxPower,Device.Optical.Interface.1.TxPower,InternetGatewayDevice.WANDevice.1.WANOponInterfaceConfig.RxPower';
        
        $url = $this->nbiUrl . '/devices/?projection=' . urlencode($fields);
        $response = $this->httpRequest('GET', $url);

        if (!$response['success']) {
            return [
                'success' => false,
                'error'   => 'Gagal menghubungi GenieACS NBI di ' . $this->nbiUrl . ': ' . $response['error'],
                'devices' => []
            ];
        }

        $rawDevices = json_decode($response['body'], true);
        if (!is_array($rawDevices)) {
            return [
                'success' => false,
                'error'   => 'Format respon GenieACS NBI tidak valid',
                'devices' => []
            ];
        }

        $formatted = [];
        foreach ($rawDevices as $dev) {
            $formatted[] = $this->parseOntRecord($dev);
        }

        return [
            'success'   => true,
            'count'     => count($formatted),
            'nbi_url'   => $this->nbiUrl,
            'devices'   => $formatted,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Parse data mentah GenieACS menjadi format ISP Transdata yang konsisten
     */
    private function parseOntRecord(array $raw): array
    {
        $id = $raw['_id'] ?? 'Unknown';
        $lastInform = $raw['_lastInform'] ?? null;

        // Ambil serial number dari beberapa alternatif parameter TR-069
        $serial = $this->extractParamValue($raw, [
            'InternetGatewayDevice.DeviceInfo.SerialNumber',
            'Device.DeviceInfo.SerialNumber',
            '_deviceId._SerialNumber'
        ]) ?: 'N/A';

        $manufacturer = $this->extractParamValue($raw, [
            'InternetGatewayDevice.DeviceInfo.Manufacturer',
            'Device.DeviceInfo.Manufacturer',
            '_deviceId._Manufacturer'
        ]) ?: 'N/A';

        $model = $this->extractParamValue($raw, [
            'InternetGatewayDevice.DeviceInfo.ModelName',
            'Device.DeviceInfo.ModelName',
            'InternetGatewayDevice.DeviceInfo.ProductClass'
        ]) ?: 'N/A';

        $wanIp = $this->extractParamValue($raw, [
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
            'Device.IP.Interface.1.IPv4Address.1.IPAddress',
            '_ip'
        ]) ?: 'N/A';

        // Optical RX Power (dBm) - vendor TR-098 / TR-181 differences
        $rxRaw = $this->extractParamValue($raw, [
            'InternetGatewayDevice.WANDevice.1.WANOponInterfaceConfig.RxPower',
            'InternetGatewayDevice.WANDevice.1.WANCommonInterfaceConfig.RxPower',
            'Device.Optical.Interface.1.RxPower',
            'InternetGatewayDevice.X_ZTE_COM_PON.RxPower',
            'InternetGatewayDevice.X_HW_PON.RxPower'
        ]);

        $txRaw = $this->extractParamValue($raw, [
            'InternetGatewayDevice.WANDevice.1.WANOponInterfaceConfig.TxPower',
            'InternetGatewayDevice.WANDevice.1.WANCommonInterfaceConfig.TxPower',
            'Device.Optical.Interface.1.TxPower',
            'InternetGatewayDevice.X_ZTE_COM_PON.TxPower',
            'InternetGatewayDevice.X_HW_PON.TxPower'
        ]);

        // Hitung status aktif berdasarkan lastInform (jika kurang dari 15 menit yang lalu)
        $isOnline = false;
        if ($lastInform) {
            $informTs = strtotime($lastInform);
            if ($informTs && (time() - $informTs) < 900) {
                $isOnline = true;
            }
        }

        return [
            'device_id'     => $id,
            'serial_number' => $serial,
            'manufacturer'  => $manufacturer,
            'model'         => $model,
            'wan_ip'        => $wanIp,
            'optical_rx'    => $rxRaw !== null ? (string)$rxRaw : 'N/A',
            'optical_tx'    => $txRaw !== null ? (string)$txRaw : 'N/A',
            'last_inform'   => $lastInform ?: 'Belum pernah',
            'is_online'     => $isOnline
        ];
    }

    private function extractParamValue(array $source, array $keys): ?string
    {
        foreach ($keys as $key) {
            $parts = explode('.', $key);
            $curr = $source;
            $found = true;
            foreach ($parts as $p) {
                if (isset($curr[$p])) {
                    $curr = $curr[$p];
                } else {
                    $found = false;
                    break;
                }
            }
            if ($found) {
                if (is_array($curr) && isset($curr['_value'])) {
                    return (string)$curr['_value'];
                }
                if (is_scalar($curr)) {
                    return (string)$curr;
                }
            }
        }
        return null;
    }

    /**
     * Jalankan task GenieACS aktual (Refresh Object atau Reboot)
     */
    public function createTask(string $deviceId, string $taskName, array $args = []): array
    {
        $url = sprintf('%s/devices/%s/tasks?timeout=%d', $this->nbiUrl, urlencode($deviceId), $this->timeout * 1000);
        $payload = ['name' => $taskName];
        if (!empty($args)) {
            $payload = array_merge($payload, $args);
        }

        $res = $this->httpRequest('POST', $url, json_encode($payload));
        if (!$res['success']) {
            return [
                'success' => false,
                'error'   => 'GenieACS Task Error: ' . $res['error']
            ];
        }

        return [
            'success'   => true,
            'device_id' => $deviceId,
            'task'      => $taskName,
            'status'    => 'QUEUED',
            'response'  => json_decode($res['body'], true)
        ];
    }

    private function httpRequest(string $method, string $url, ?string $body = null): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return [
                'success'   => false,
                'http_code' => $httpCode,
                'error'     => $err ?: 'Network timeout / Host unreachable'
            ];
        }

        return [
            'success'   => ($httpCode >= 200 && $httpCode < 300),
            'http_code' => $httpCode,
            'body'      => $response,
            'error'     => $httpCode >= 400 ? "HTTP $httpCode: $response" : null
        ];
    }
}
