import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Filter } from 'lucide-react';
import { api } from '../services/api';
import { Alarm } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const AlarmsPage: React.FC = () => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED'>('ACTIVE');

  const fetchAlarms = async () => {
    try {
      const data = await api.getAlarms();
      setAlarms(data.alarms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAlarm(id);
      fetchAlarms();
    } catch (err: any) {
      alert(err.message || 'Gagal menandai alarm');
    }
  };

  const filtered = alarms.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Alarm & Insiden Jaringan</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Daftar peringatan kritis (Host Down, SNMP timeout, packet loss) berdasarkan hasil polling aktual
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ACTIVE">Alarm Aktif</option>
            <option value="ACKNOWLEDGED">Telah Diketahui (Acknowledged)</option>
            <option value="CLEARED">Terselesaikan (Cleared)</option>
            <option value="ALL">Semua Riwayat Alarm</option>
          </select>

          <button
            onClick={fetchAlarms}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Memuat data alarm...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak Ada Alarm Aktif"
          description="Seluruh pemeriksaan ICMP dan SNMP berjalan lancar tanpa indikasi kegagalan koneksi."
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Tingkat Keparahan</th>
                  <th className="py-3.5 px-4">Tipe Alarm</th>
                  <th className="py-3.5 px-4">Pesan Kejadian</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Waktu Terjadi</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((alarm) => (
                  <tr key={alarm.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <StatusBadge status={alarm.severity} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                      {alarm.alarm_type}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md">
                      {alarm.message}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={alarm.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(alarm.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {alarm.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAcknowledge(alarm.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 rounded-md transition-colors cursor-pointer"
                        >
                          Tandai Diketahui
                        </button>
                      )}
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
