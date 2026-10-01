import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Search, Clock, User, Terminal } from 'lucide-react';
import { api } from '../services/api';
import { AuditLog } from '../types/nms';
import { EmptyState } from '../components/EmptyState';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.username.toLowerCase().includes(search.toLowerCase()) ||
      (l.details && l.details.toLowerCase().includes(search.toLowerCase())) ||
      l.target_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Audit Trail & Riwayat Operasi</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Pencatatan aktivitas administrator, perubahan konfigurasi perangkat, dan event keamanan
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Log</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari aksi, pengguna, atau rincian..."
          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Memuat catatan audit log...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum Ada Catatan Log"
          description="Log tindakan operator dan perubahan sistem akan otomatis tersimpan di sini."
          icon={<ShieldCheck className="w-6 h-6 text-slate-400" />}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Waktu</th>
                  <th className="py-3.5 px-4">Operator</th>
                  <th className="py-3.5 px-4">Aksi</th>
                  <th className="py-3.5 px-4">Target</th>
                  <th className="py-3.5 px-4">Rincian Kejadian</th>
                  <th className="py-3.5 px-4 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                      {log.username}
                    </td>
                    <td className="py-3 px-4 text-cyan-400 font-bold text-[11px]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {log.target_type} {log.target_id ? `(#${log.target_id})` : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-sm break-words">
                      {log.details || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {log.ip_address}
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
