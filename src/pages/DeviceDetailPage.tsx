import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Server,
  Activity,
  Radio,
  RefreshCw,
  Clock,
  Terminal,
  Layers,
  ArrowDownUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Network
} from 'lucide-react';
import { api } from '../services/api';
import { Device, DeviceInterface, PingResult, SnmpResult } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';

interface DeviceDetailPageProps {
  deviceId: number;
  onBack: () => void;
}

export const DeviceDetailPage: React.FC<DeviceDetailPageProps> = ({ deviceId, onBack }) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [interfaces, setInterfaces] = useState<DeviceInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pollingPing, setPollingPing] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  const [pollingSnmp, setPollingSnmp] = useState(false);
  const [snmpResult, setSnmpResult] = useState<SnmpResult | null>(null);

  const fetchDetail = async () => {
    try {
      const data = await api.getDevice(deviceId);
      setDevice(data.device);
      setInterfaces(data.interfaces || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil detail perangkat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [deviceId]);

  const handleTestPing = async () => {
    if (!device) return;
    setPollingPing(true);
    try {
      const res = await api.testDevicePing(device.id, 4);
      setPingResult(res.ping);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan ping');
    } finally {
      setPollingPing(false);
    }
  };

  const handlePollSnmp = async () => {
    if (!device) return;
    setPollingSnmp(true);
    try {
      const res = await api.pollDeviceSnmp(device.id);
      setSnmpResult(res.snmp);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Gagal polling SNMP');
    } finally {
      setPollingSnmp(false);
    }
  };

  const formatBitsPerSec = (bps: number | null) => {
    if (bps === null) return 'Sampel ke-1 (Tersimpan)';
    if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
    return `${bps} bps`;
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null) return '-';
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mr-2" />
        <span>Memuat data perangkat...</span>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="text-rose-400 font-semibold">{error || 'Perangkat tidak ditemukan'}</div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Kembali ke Daftar Perangkat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{device.name}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                {device.ip_address}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {device.device_type} • Lokasi: {device.location} • Vendor: {device.vendor}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestPing}
            disabled={pollingPing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${pollingPing ? 'animate-pulse' : ''}`} />
            <span>{pollingPing ? 'Pinging...' : 'Uji Ping (ICMP)'}</span>
          </button>

          <button
            onClick={handlePollSnmp}
            disabled={pollingSnmp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pollingSnmp ? 'animate-spin' : ''}`} />
            <span>{pollingSnmp ? 'Polling...' : 'Polling SNMP'}</span>
          </button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ICMP Ping Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Status Koneksi ICMP (Ping)
            </span>
            <StatusBadge status={device.ping_status} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-400">Latensi Rata-rata:</span>
              <div className="font-mono text-cyan-300 font-semibold text-sm mt-0.5">
                {device.ping_latency_ms !== null ? `${device.ping_latency_ms} ms` : 'Tidak tersedia'}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Packet Loss:</span>
              <div className="font-mono text-slate-200 font-semibold text-sm mt-0.5">
                {device.ping_packet_loss_pct !== null ? `${device.ping_packet_loss_pct}%` : 'Tidak tersedia'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-1">
            Waktu pengujian terakhir: {device.last_ping_time ? new Date(device.last_ping_time).toLocaleString() : 'Belum diuji'}
          </div>

          {device.last_ping_output && (
            <details className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <summary className="cursor-pointer hover:text-slate-200 font-medium">Lihat Output Konsol Ping</summary>
              <pre className="mt-2 p-2 bg-slate-950 rounded-lg text-emerald-400 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                {device.last_ping_output}
              </pre>
            </details>
          )}
        </div>

        {/* SNMP Status Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Status SNMP (v1/v2c)
            </span>
            <StatusBadge status={device.snmp_status} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-400">System Uptime (sysUpTime):</span>
              <div className="font-mono text-blue-300 font-semibold text-xs mt-0.5 truncate" title={device.snmp_uptime || ''}>
                {device.snmp_uptime || 'Tidak tersedia'}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Model Teridentifikasi:</span>
              <div className="text-slate-200 font-semibold text-xs mt-0.5">
                {device.model}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-1">
            Waktu polling terakhir: {device.last_snmp_time ? new Date(device.last_snmp_time).toLocaleString() : 'Belum pernah'}
          </div>

          {device.snmp_descr && (
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="font-semibold text-slate-300">sysDescr:</span>
              <div className="mt-1 font-mono text-[10px] text-slate-300 bg-slate-950 p-2 rounded max-h-24 overflow-y-auto">
                {device.snmp_descr}
              </div>
            </div>
          )}

          {device.last_snmp_error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[11px]">
              {device.last_snmp_error}
            </div>
          )}
        </div>
      </div>

      {/* Network Interface Traffic Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Monitoring Interface & Laju Trafik Aktual</h2>
              <p className="text-xs text-slate-400">
                Laju dihitung berdasarkan selisih counter oktet dibagi selang waktu: (Δ octets × 8) / Δ t
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400 font-medium">{interfaces.length} interface terdeteksi</span>
        </div>

        {interfaces.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Network className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <div className="font-semibold text-slate-300 mb-1">Belum Ada Data Interface yang Tersimpan</div>
            <p className="max-w-md mx-auto text-slate-400">
              Klik tombol "Polling SNMP" di bagian atas untuk mengambil tabel interface (ifDescr, ifName, ifOperStatus, ifHCInOctets, ifHCOutOctets) langsung dari perangkat melalui Net-SNMP CLI.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ifIndex</th>
                  <th className="py-3 px-4">Nama Interface</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4">Oper Status</th>
                  <th className="py-3 px-4">RX Counter</th>
                  <th className="py-3 px-4">TX Counter</th>
                  <th className="py-3 px-4">RX Rate (bps)</th>
                  <th className="py-3 px-4">TX Rate (bps)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {interfaces.map((intf) => (
                  <tr key={intf.if_index} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{intf.if_index}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{intf.if_name}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{intf.if_descr}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={intf.if_oper_status} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatBytes(intf.last_in_octets)}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatBytes(intf.last_out_octets)}</td>
                    <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                      {formatBitsPerSec(intf.current_rx_rate_bps)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-blue-400">
                      {formatBitsPerSec(intf.current_tx_rate_bps)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
