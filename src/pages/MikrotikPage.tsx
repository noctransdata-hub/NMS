import React, { useState, useEffect } from 'react';
import {
  Router,
  Activity,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  RefreshCw,
  Cpu,
  Layers,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { Device } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const MikrotikPage: React.FC = () => {
  const [routers, setRouters] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Connection Test Form
  const [testHost, setTestHost] = useState('');
  const [testPort, setTestPort] = useState('8728');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    latency_ms: number | null;
    message: string;
  } | null>(null);

  const fetchRouters = async () => {
    try {
      const data = await api.getDevices();
      const mRouters = (data.devices || []).filter(
        (d) => d.device_type === 'ROUTER' || d.vendor.toLowerCase().includes('mikrotik')
      );
      setRouters(mRouters);
      if (mRouters.length > 0 && !testHost) {
        setTestHost(mRouters[0].ip_address);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testHost) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.testMikrotik(testHost, parseInt(testPort, 10) || 8728);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'UNREACHABLE',
        latency_ms: null,
        message: err.message || 'Koneksi ke port API MikroTik gagal'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Integrasi MikroTik RouterOS</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Uji koneksi RouterOS API (Port 8728 / 8729 SSL), status resource, dan aturan isolir pelanggan
          </p>
        </div>
      </div>

      {/* Grid: Connection Tester and Policy Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Test Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Router className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Uji Handshake Socket TCP MikroTik API</h2>
          </div>

          <form onSubmit={handleTestConnection} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">IP Router MikroTik *</label>
                <input
                  type="text"
                  required
                  value={testHost}
                  onChange={(e) => setTestHost(e.target.value)}
                  placeholder="cth. 192.168.88.1"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Port API (Default: 8728)</label>
                <input
                  type="number"
                  value={testPort}
                  onChange={(e) => setTestPort(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Pemeriksaan menguji respon TCP port manajemen langsung dari backend.
              </span>
              <button
                type="submit"
                disabled={testing || !testHost}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{testing ? 'Menguji...' : 'Tes Koneksi API'}</span>
              </button>
            </div>
          </form>

          {/* Test Result Output */}
          {testResult && (
            <div className={`mt-5 p-4 rounded-xl border text-xs ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  <span>Status: {testResult.status}</span>
                </div>
                {testResult.latency_ms !== null && (
                  <span className="font-mono text-[11px] bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                    Handshake: {testResult.latency_ms} ms
                  </span>
                )}
              </div>
              <p className="mt-1 text-slate-300">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Isolation Policy Guidelines */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Prosedur Isolir Pelanggan</h3>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-2">
            <p className="font-semibold text-cyan-300">Aturan Eksekusi Transdata NMS:</p>
            <p>
              Tindakan isolasi (suspend) dan buka isolasi hanya dieksekusi setelah metode isolasi aktual (Address-List firewall filter atau PPPoE profile swap) dikonfigurasi pada router terkait.
            </p>
            <p className="text-amber-400">
              Sistem tidak akan menampilkan status berhasil jika perintah API tidak benar-benar dieksekusi di RouterOS.
            </p>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="font-medium text-slate-300">Parameter yang Didukung:</div>
            <div>• <code className="text-cyan-400">/ip firewall address-list</code> (ISOLIR_LIST)</div>
            <div>• <code className="text-cyan-400">/ppp secret</code> (profile: ISOLIR_PROFILE)</div>
            <div>• <code className="text-cyan-400">/system resource print</code> (CPU, RAM, Uptime)</div>
          </div>
        </div>
      </div>

      {/* Registered Routers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Router className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Daftar Router MikroTik Terdaftar</h2>
          </div>
          <span className="text-xs text-slate-400">{routers.length} router di database</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-500" />
            <span>Memuat data router...</span>
          </div>
        ) : routers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum Ada Router MikroTik Terdaftar"
              description="Daftarkan router operasional Anda melalui menu Perangkat (Devices) dengan memilih tipe ROUTER."
              icon={<Router className="w-6 h-6 text-slate-400" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Nama Router</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Model & Vendor</th>
                  <th className="py-3.5 px-4">Status Ping</th>
                  <th className="py-3.5 px-4">Status SNMP</th>
                  <th className="py-3.5 px-4">Aksi Uji API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {routers.map((router) => (
                  <tr key={router.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200">{router.name}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">{router.ip_address}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {router.vendor} ({router.model})
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={router.ping_status} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={router.snmp_status} />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setTestHost(router.ip_address);
                          setTestPort('8728');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-cyan-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
                      >
                        Pilih untuk Uji API
                      </button>
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
