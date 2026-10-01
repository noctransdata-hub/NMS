import React, { useState, useEffect } from 'react';
import {
  Radio,
  RefreshCw,
  RotateCw,
  Power,
  Search,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  Settings
} from 'lucide-react';
import { api } from '../services/api';
import { GenieAcsDevice } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const GenieAcsPage: React.FC = () => {
  const [devices, setDevices] = useState<GenieAcsDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nbiUrl, setNbiUrl] = useState<string>('http://127.0.0.1:7557');
  const [search, setSearch] = useState('');

  const fetchGenieAcs = async () => {
    setLoading(true);
    try {
      const res = await api.getGenieAcsDevices();
      setNbiUrl(res.nbi_url);
      setDevices(res.devices || []);
      if (!res.success && res.error) {
        setError(res.error);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungi GenieACS NBI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenieAcs();
  }, []);

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.serial_number.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.wan_ip.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Manajemen CPE / ONT (GenieACS NBI)</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Monitoring optical power (RX/TX dBm), status TR-069, dan serial number ONT ISP Transdata
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGenieAcs}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Sinkronisasi NBI</span>
          </button>
        </div>
      </div>

      {/* Endpoint URL notice & diagnostic */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Radio className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Endpoint NBI Aktif:</span>
          <code className="font-mono text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {nbiUrl}
          </code >
        </div>

        <span className="text-slate-400 text-[11px]">
          Dapat diubah pada Pengaturan Sistem (Settings)
        </span>
      </div>

      {/* Error state if GenieACS service is unreachable */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Koneksi GenieACS NBI Terputus atau Belum Berjalan</span>
          </div>
          <p className="text-amber-300/90 leading-relaxed font-mono text-[11px]">
            {error}
          </p>
          <div className="pt-2 text-[11px] text-amber-400/80 border-t border-amber-800/40">
            Periksa apakah service GenieACS aktif: <code className="bg-amber-950 px-1 py-0.5 rounded">systemctl status genieacs-nbi</code> atau sesuaikan URL endpoint jika berada di server terpisah.
          </div>
        </div>
      )}

      {/* Search & Counter */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Serial Number, IP WAN, atau Model..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="text-xs text-slate-400 self-center">
          {devices.length} CPE/ONT terdeteksi
        </div>
      </div>

      {/* ONT Table / Empty State */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mr-2" />
          <span>Menghubungi GenieACS NBI API...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak Ada ONT Terdeteksi di GenieACS"
          description={
            error
              ? 'Layanan GenieACS belum terhubung. Pastikan alamat NBI valid dan daemon GenieACS berjalan di port 7557.'
              : 'Belum ada ONT yang terdaftar atau melakukan inform TR-069 ke server GenieACS.'
          }
          icon={<Radio className="w-6 h-6 text-purple-400" />}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Serial Number (SN)</th>
                  <th className="py-3.5 px-4">Pabrikan & Model</th>
                  <th className="py-3.5 px-4">IP WAN External</th>
                  <th className="py-3.5 px-4">Optical RX Power</th>
                  <th className="py-3.5 px-4">Optical TX Power</th>
                  <th className="py-3.5 px-4">Status TR-069</th>
                  <th className="py-3.5 px-4">Inform Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((ont) => (
                  <tr key={ont.device_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                      {ont.serial_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium">{ont.manufacturer}</div>
                      <div className="text-[11px] text-slate-400">{ont.model}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {ont.wan_ip}
                    </td>
                    <td className="py-3 px-4">
                      {ont.optical_rx !== 'N/A' ? (
                        <span className="font-mono text-emerald-400 font-semibold">{ont.optical_rx} dBm</span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ont.optical_tx !== 'N/A' ? (
                        <span className="font-mono text-blue-400 font-semibold">{ont.optical_tx} dBm</span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ont.is_online ? 'ONLINE' : 'OFFLINE'} label={ont.is_online ? 'Active' : 'Idle'} />
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <div className="text-[11px]">
                        {ont.last_inform !== 'Belum pernah' ? new Date(ont.last_inform).toLocaleTimeString() : 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {ont.last_inform !== 'Belum pernah' ? new Date(ont.last_inform).toLocaleDateString() : ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
