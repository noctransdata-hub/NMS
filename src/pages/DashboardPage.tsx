import React, { useEffect, useState } from 'react';
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowRight,
  TrendingDown,
  Clock,
  MapPin,
  Radio,
  Router
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardSummary } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
  onOpenAddDevice: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddDevice }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat ringkasan dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
          <span className="text-sm">Memuat data operasional jaringan aktual...</span>
        </div>
      </div>
    );
  }

  const total = summary?.total_devices ?? 0;
  const online = summary?.online_devices ?? 0;
  const offline = summary?.offline_devices ?? 0;
  const unknown = summary?.unknown_devices ?? 0;
  const activeAlarms = summary?.active_alarms ?? 0;

  return (
    <div className="space-y-6">
      {/* Top operational bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard Operasional NOC</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Status real-time perangkat jaringan, ICMP ping, SNMP, dan infrastruktur ISP Transdata
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 rounded-lg border border-slate-700/70 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Perbarui Data</span>
          </button>

          <button
            onClick={onOpenAddDevice}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-900/30 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Perangkat</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Devices */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Perangkat</span>
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white">{total}</span>
            <span className="text-xs text-slate-400 font-normal">unit di DB</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Diperbarui: {new Date(summary?.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Perangkat Online</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-400">{online}</span>
            <span className="text-xs text-slate-400 font-normal">
              {total > 0 ? `${Math.round((online / total) * 100)}% ketersediaan` : '0%'}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-emerald-400/80">ICMP ping aktif & responsif</div>
        </div>

        {/* Offline Devices */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">Perangkat Offline</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-rose-400">{offline}</span>
            <span className="text-xs text-slate-400 font-normal">host tak merespons</span>
          </div>
          <div className="mt-3 text-[11px] text-rose-400/80">
            {offline > 0 ? 'Perlu tindakan teknisi NOC' : 'Tidak ada host down'}
          </div>
        </div>

        {/* Active Alarms */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Alarm Aktif</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-400">{activeAlarms}</span>
            <span className="text-xs text-slate-400 font-normal">insiden belum tuntas</span>
          </div>
          <div className="mt-3 text-[11px] text-amber-400/80">
            {activeAlarms > 0 ? 'Periksa menu Alarm & Insiden' : 'Semua alarm terselesaikan'}
          </div>
        </div>
      </div>

      {/* Quick Launch & Shortcut Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('gis')}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/60 hover:bg-slate-800/40 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-cyan-300">Peta GIS FTTH</div>
              <div className="text-xs text-slate-400">Pemetaan interaktif rute kabel, ODC, ODP</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
        </button>

        <button
          onClick={() => onNavigate('mikrotik')}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/60 hover:bg-slate-800/40 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Router className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-blue-300">MikroTik RouterOS</div>
              <div className="text-xs text-slate-400">Monitoring resource API & isolir pelanggan</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </button>

        <button
          onClick={() => onNavigate('genieacs')}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-800/60 hover:bg-slate-800/40 transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200 group-hover:text-purple-300">GenieACS ONT / CPE</div>
              <div className="text-xs text-slate-400">Optical RX/TX power & manajemen TR-069</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
        </button>
      </div>

      {/* Main Content: Perangkat Gangguan or Empty State */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">Status Perangkat & Gangguan Terakhir</h2>
          </div>
          <button
            onClick={() => onNavigate('devices')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Semua Perangkat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {total === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Perangkat Jaringan"
              description="Aplikasi Transdata NMS berjalan dengan database produksi yang bersih. Tidak ada perangkat palsu atau simulasi yang dibuat otomatis."
              actionLabel="Tambah Perangkat Pertama"
              onAction={onOpenAddDevice}
              icon={<Server className="w-6 h-6 text-slate-400" />}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {summary?.offline_list && summary.offline_list.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Nama Perangkat</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Tipe</th>
                      <th className="py-3 px-4">Status Ping</th>
                      <th className="py-3 px-4">Pemeriksaan Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {summary.offline_list.map((dev) => (
                      <tr key={dev.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200">{dev.name}</td>
                        <td className="py-3 px-4 font-mono text-cyan-400">{dev.ip_address}</td>
                        <td className="py-3 px-4 text-slate-400">{dev.device_type}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={dev.ping_status} />
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {dev.last_ping_time ? new Date(dev.last_ping_time).toLocaleString() : 'Belum diuji'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Seluruh perangkat terpantau normal atau belum ada host offline.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
