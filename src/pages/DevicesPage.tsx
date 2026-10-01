import React, { useEffect, useState } from 'react';
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Terminal,
  Activity,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  Info,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { Device, DeviceType, PingResult, SnmpResult } from '../types/nms';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';

interface DevicesPageProps {
  onSelectDevice: (deviceId: number) => void;
  isAddOpen: boolean;
  onCloseAdd: () => void;
  onOpenAdd: () => void;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  onSelectDevice,
  isAddOpen,
  onCloseAdd,
  onOpenAdd
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Ping Modal State
  const [pingModalDevice, setPingModalDevice] = useState<Device | null>(null);
  const [pingRunning, setPingRunning] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  // SNMP Poll State
  const [snmpPollDevice, setSnmpPollDevice] = useState<Device | null>(null);
  const [snmpRunning, setSnmpRunning] = useState(false);
  const [snmpResult, setSnmpResult] = useState<SnmpResult | null>(null);

  // Add/Edit State
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formName, setFormName] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formType, setFormType] = useState<DeviceType>('ROUTER');
  const [formVendor, setFormVendor] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formCommunity, setFormCommunity] = useState('public');
  const [formPort, setFormPort] = useState(161);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  const fetchDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data.devices || []);
    } catch (err: any) {
      console.error('Gagal mengambil daftar perangkat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setFormName('');
    setFormIp('');
    setFormType('ROUTER');
    setFormVendor('');
    setFormModel('');
    setFormLocation('');
    setFormCommunity('public');
    setFormPort(161);
    setFormError(null);
    onOpenAdd();
  };

  const handleOpenEdit = (dev: Device) => {
    setEditingDevice(dev);
    setFormName(dev.name);
    setFormIp(dev.ip_address);
    setFormType(dev.device_type);
    setFormVendor(dev.vendor === 'Tidak tersedia' ? '' : dev.vendor);
    setFormModel(dev.model === 'Tidak tersedia' ? '' : dev.model);
    setFormLocation(dev.location === 'Tidak ditentukan' ? '' : dev.location);
    setFormCommunity(dev.snmp_community);
    setFormPort(dev.snmp_port);
    setFormError(null);
    onOpenAdd();
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingDevice) {
        await api.updateDevice(editingDevice.id, {
          name: formName,
          device_type: formType,
          vendor: formVendor || 'Tidak tersedia',
          model: formModel || 'Tidak tersedia',
          location: formLocation || 'Tidak ditentukan',
          snmp_community: formCommunity,
          snmp_port: formPort
        });
      } else {
        await api.createDevice({
          name: formName,
          ip_address: formIp,
          device_type: formType,
          vendor: formVendor || 'Tidak tersedia',
          model: formModel || 'Tidak tersedia',
          location: formLocation || 'Tidak ditentukan',
          snmp_community: formCommunity,
          snmp_port: formPort
        });
      }
      onCloseAdd();
      fetchDevices();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan perangkat');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    try {
      await api.deleteDevice(deletingDevice.id);
      setDeletingDevice(null);
      fetchDevices();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus perangkat');
    }
  };

  // Run Real Ping
  const handleRunPing = async (dev: Device) => {
    setPingModalDevice(dev);
    setPingRunning(true);
    setPingResult(null);

    try {
      const res = await api.testDevicePing(dev.id, 4);
      setPingResult(res.ping);
      fetchDevices(); // update status in table
    } catch (err: any) {
      setPingResult({
        success: false,
        status: 'OFFLINE',
        ip_address: dev.ip_address,
        packet_loss: 100,
        latency_ms: null,
        latency_min_ms: null,
        latency_max_ms: null,
        output: err.message || 'Gagal menjalankan ICMP ping'
      });
    } finally {
      setPingRunning(false);
    }
  };

  // Run Real SNMP Poll
  const handleRunSnmp = async (dev: Device) => {
    setSnmpPollDevice(dev);
    setSnmpRunning(true);
    setSnmpResult(null);

    try {
      const res = await api.pollDeviceSnmp(dev.id);
      setSnmpResult(res.snmp);
      fetchDevices();
    } catch (err: any) {
      setSnmpResult({
        success: false,
        status: 'ERROR',
        error: err.message || 'Gagal menjalankan query SNMP'
      });
    } finally {
      setSnmpRunning(false);
    }
  };

  // Filtered Devices
  const filtered = devices.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address.includes(search) ||
      d.location.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || d.device_type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || d.ping_status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Manajemen Perangkat Jaringan</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Inventaris router, switch, OLT, dan server ISP Transdata dengan monitoring ICMP & SNMP
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-900/30 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Perangkat Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama perangkat, IP, atau lokasi..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Tipe Perangkat</option>
            <option value="ROUTER">Router</option>
            <option value="SWITCH">Switch</option>
            <option value="OLT">OLT</option>
            <option value="ONT">ONT / CPE</option>
            <option value="SERVER">Server</option>
            <option value="OTHER">Lainnya</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Status Ping</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Belum Diuji (Unknown)</option>
          </select>

          <button
            onClick={fetchDevices}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
            title="Refresh daftar perangkat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Device List Table / Empty State */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mr-2" />
          <span>Memuat inventaris perangkat...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={devices.length === 0 ? 'Belum Ada Perangkat Terdaftar' : 'Tidak Ada Perangkat yang Cocok'}
          description={
            devices.length === 0
              ? 'Transdata NMS tidak menggunakan dummy data. Tambahkan router, switch, atau OLT operasional Anda.'
              : 'Ubah kueri pencarian atau filter untuk menemukan perangkat yang dicari.'
          }
          actionLabel={devices.length === 0 ? 'Tambah Perangkat Pertama' : undefined}
          onAction={devices.length === 0 ? handleOpenAdd : undefined}
          icon={<Server className="w-6 h-6 text-slate-400" />}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Nama Perangkat</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Tipe & Vendor</th>
                  <th className="py-3.5 px-4">Status Ping (ICMP)</th>
                  <th className="py-3.5 px-4">Status SNMP</th>
                  <th className="py-3.5 px-4">Pemeriksaan Terakhir</th>
                  <th className="py-3.5 px-4 text-right">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Name & Location */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{dev.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{dev.location}</div>
                    </td>

                    {/* IP */}
                    <td className="py-3 px-4 font-mono font-medium text-cyan-400">
                      {dev.ip_address}
                    </td>

                    {/* Type & Vendor */}
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-medium">{dev.device_type}</div>
                      <div className="text-[11px] text-slate-400">{dev.vendor} {dev.model !== 'Tidak tersedia' ? `(${dev.model})` : ''}</div>
                    </td>

                    {/* Ping Status */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={dev.ping_status} />
                        {dev.ping_latency_ms !== null && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {dev.ping_latency_ms} ms ({dev.ping_packet_loss_pct}% loss)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SNMP Status */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={dev.snmp_status} />
                        {dev.snmp_uptime && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={dev.snmp_uptime}>
                            Up: {dev.snmp_uptime}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Check */}
                    <td className="py-3 px-4 text-slate-400">
                      <div className="text-[11px]">
                        {dev.last_ping_time ? new Date(dev.last_ping_time).toLocaleTimeString() : 'Belum diuji'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {dev.last_ping_time ? new Date(dev.last_ping_time).toLocaleDateString() : '-'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Real Ping Button */}
                        <button
                          onClick={() => handleRunPing(dev)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                          title="Jalankan ICMP Ping Nyata"
                        >
                          Ping
                        </button>

                        {/* Real SNMP Poll Button */}
                        <button
                          onClick={() => handleRunSnmp(dev)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                          title="Polling SNMP Nyata"
                        >
                          SNMP
                        </button>

                        {/* View Detail Button */}
                        <button
                          onClick={() => onSelectDevice(dev.id)}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md"
                          title="Detail Perangkat & Trafik Interface"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(dev)}
                          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-md"
                          title="Edit Perangkat"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeletingDevice(dev)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md"
                          title="Hapus Perangkat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Tambah / Edit Perangkat */}
      <Modal
        isOpen={isAddOpen}
        onClose={onCloseAdd}
        title={editingDevice ? `Edit Perangkat: ${editingDevice.name}` : 'Tambah Perangkat Jaringan Baru'}
      >
        <form onSubmit={handleSaveDevice} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Perangkat *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="cth. Router-Core-CCR2004"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Alamat IP Manajemen *</label>
              <input
                type="text"
                required
                disabled={!!editingDevice}
                value={formIp}
                onChange={(e) => setFormIp(e.target.value)}
                placeholder="cth. 192.168.88.1"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipe Perangkat *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as DeviceType)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="ROUTER">Router</option>
                <option value="SWITCH">Switch</option>
                <option value="OLT">OLT</option>
                <option value="ONT">ONT / CPE</option>
                <option value="SERVER">Server</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Vendor (Opsional)</label>
              <input
                type="text"
                value={formVendor}
                onChange={(e) => setFormVendor(e.target.value)}
                placeholder="cth. MikroTik / ZTE"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Model (Opsional)</label>
              <input
                type="text"
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="cth. CCR2004-16G-2S+"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lokasi / POP / Rack</label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="cth. POP Transdata Gedung A Rack 02"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <h4 className="text-xs font-semibold text-cyan-400 mb-2">Konfigurasi SNMP Monitoring</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">SNMP Community</label>
                <input
                  type="text"
                  value={formCommunity}
                  onChange={(e) => setFormCommunity(e.target.value)}
                  placeholder="public"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Port SNMP (Default: 161)</label>
                <input
                  type="number"
                  value={formPort}
                  onChange={(e) => setFormPort(parseInt(e.target.value, 10) || 161)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onCloseAdd}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {formSubmitting ? 'Menyimpan...' : 'Simpan Perangkat'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Hasil Uji Ping Nyata */}
      <Modal
        isOpen={!!pingModalDevice}
        onClose={() => setPingModalDevice(null)}
        title={`Hasil ICMP Ping Nyata: ${pingModalDevice?.name} (${pingModalDevice?.ip_address})`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 font-medium">Status Respon:</span>
              {pingRunning ? (
                <span className="text-xs text-amber-400 font-medium animate-pulse">Menjalankan 4 ICMP packets...</span>
              ) : pingResult ? (
                <StatusBadge status={pingResult.status} />
              ) : null}
            </div>

            {pingResult && pingResult.latency_ms !== null && (
              <div className="text-xs font-mono text-cyan-300">
                Avg: {pingResult.latency_ms} ms | Loss: {pingResult.packet_loss}%
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Terminal Output (/bin/ping):</span>
              {pingResult && (
                <span className="text-[11px]">
                  Min: {pingResult.latency_min_ms ?? '-'}ms / Max: {pingResult.latency_max_ms ?? '-'}ms
                </span>
              )}
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
              {pingRunning
                ? 'Mengirim 4 paket ICMP echo request dari backend server Transdata...'
                : pingResult?.output || 'Tidak ada output'}
            </pre>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => pingModalDevice && handleRunPing(pingModalDevice)}
              disabled={pingRunning}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Uji Ulang Ping
            </button>
            <button
              onClick={() => setPingModalDevice(null)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Hasil Polling SNMP Nyata */}
      <Modal
        isOpen={!!snmpPollDevice}
        onClose={() => setSnmpPollDevice(null)}
        title={`Polling SNMP Nyata: ${snmpPollDevice?.name}`}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Community: <span className="font-mono text-cyan-400">{snmpPollDevice?.snmp_community}</span> | Versi:{' '}
              <span className="font-mono text-cyan-400">{snmpPollDevice?.snmp_version}</span>
            </div>
            {snmpRunning ? (
              <span className="text-xs text-amber-400 animate-pulse">Menjalankan snmpget...</span>
            ) : snmpResult ? (
              <StatusBadge status={snmpResult.status} />
            ) : null}
          </div>

          {snmpResult?.success ? (
            <div className="space-y-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs">
              <div>
                <span className="text-slate-400">sysDescr (1.3.6.1.2.1.1.1.0):</span>
                <div className="mt-1 font-mono text-slate-200 bg-slate-900 p-2 rounded border border-slate-800">
                  {snmpResult.sys_descr}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400">sysUpTime (1.3.6.1.2.1.1.3.0):</span>
                  <div className="mt-1 font-mono text-cyan-300 font-semibold">{snmpResult.sys_uptime}</div>
                </div>
                <div>
                  <span className="text-slate-400">Identifikasi Vendor:</span>
                  <div className="mt-1 text-slate-200 font-semibold">{snmpResult.vendor}</div>
                </div>
              </div>
            </div>
          ) : snmpResult?.error ? (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              <div className="font-semibold text-rose-200 mb-1">Respon Error SNMP:</div>
              <div className="font-mono text-[11px]">{snmpResult.error}</div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => snmpPollDevice && handleRunSnmp(snmpPollDevice)}
              disabled={snmpRunning}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Polling Ulang
            </button>
            <button
              onClick={() => setSnmpPollDevice(null)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={!!deletingDevice}
        onClose={() => setDeletingDevice(null)}
        title="Konfirmasi Hapus Perangkat"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-300">
            Apakah Anda yakin ingin menghapus perangkat{' '}
            <span className="font-semibold text-white">{deletingDevice?.name}</span> ({deletingDevice?.ip_address})?
            Tindakan ini akan menghapus riwayat pemeriksaan dan dicatat di audit log.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeletingDevice(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteDevice}
              className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
            >
              Hapus Perangkat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
