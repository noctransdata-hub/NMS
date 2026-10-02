import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  ArrowUpDown,
  Filter,
  Phone,
  Mail,
  MapPin,
  Lock,
  Unlock,
  MessageSquare,
  Edit2,
  Trash2,
  ExternalLink,
  Package as PackageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  CreditCard,
  Wifi,
  Radio,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { Customer, Package, CustomerStatus } from '../types/nms';
import { FtthObject } from '../types/gis';
import { Modal } from '../components/Modal';

interface CustomersPageProps {
  onNavigateToMap?: (targetId?: string, lat?: number, lng?: number) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigateToMap }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [odpList, setOdpList] = useState<FtthObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, filter, and sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [packageFilter, setPackageFilter] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<keyof Customer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isPackagesModalOpen, setIsPackagesModalOpen] = useState(false);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [selectedCustomerForWa, setSelectedCustomerForWa] = useState<Customer | null>(null);
  const [waMessageData, setWaMessageData] = useState<{ phone: string; text: string; url: string } | null>(null);

  // Form states for customer registration & edit
  const [formData, setFormData] = useState({
    name: '',
    nik: '',
    address: '',
    latitude: '',
    longitude: '',
    phone_number: '',
    email: '',
    package_id: '',
    odp_id: '',
    ont_sn: '',
    ont_model: '',
    pppoe_username: '',
    pppoe_password: '',
    notes: ''
  });

  // Package Form state
  const [packageForm, setPackageForm] = useState({
    id: null as number | null,
    name: '',
    price: '',
    bandwidth: '',
    description: '',
    mikrotik_profile: ''
  });
  const [packageFormLoading, setPackageFormLoading] = useState(false);

  // Password visibility toggle per row
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  // Action status loading
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    actionText: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const showToast = (msg: string, isError: boolean = false) => {
    setToast({ message: msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [custRes, pkgRes, gisRes] = await Promise.all([
        api.getCustomers(searchTerm),
        api.getPackages(),
        api.getGisObjects()
      ]);

      setCustomers(custRes.customers || []);
      setPackages(pkgRes.packages || []);
      const odps = (gisRes.objects || []).filter((o) => o.object_type === 'ODP' || o.object_type === 'FAT');
      setOdpList(odps);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data pelanggan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Sorting helper
  const handleSort = (column: keyof Customer) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtered and sorted customers
  const filteredCustomers = customers
    .filter((c) => {
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchPackage = packageFilter === 'ALL' || String(c.package_id) === packageFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.nik.toLowerCase().includes(q) ||
        c.phone_number.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.pppoe_username && c.pppoe_username.toLowerCase().includes(q)) ||
        (c.ont_sn && c.ont_sn.toLowerCase().includes(q)) ||
        (c.customer_number && c.customer_number.toLowerCase().includes(q));
      return matchStatus && matchPackage && matchSearch;
    })
    .sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string') {
        return sortDirection === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

  // Open Add Modal
  const openAddModal = () => {
    setFormData({
      name: '',
      nik: '',
      address: '',
      latitude: '-6.2088',
      longitude: '106.8456',
      phone_number: '',
      email: '',
      package_id: packages[0]?.id ? String(packages[0].id) : '',
      odp_id: odpList[0]?.id || '',
      ont_sn: `ZTEGC${Math.floor(10000000 + Math.random() * 90000000)}`,
      ont_model: 'F609 / GPON ONT',
      pppoe_username: '',
      pppoe_password: '',
      notes: ''
    });
    setEditingCustomer(null);
    setIsAddCustomerOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name,
      nik: cust.nik,
      address: cust.address,
      latitude: cust.latitude !== null && cust.latitude !== undefined ? String(cust.latitude) : '',
      longitude: cust.longitude !== null && cust.longitude !== undefined ? String(cust.longitude) : '',
      phone_number: cust.phone_number,
      email: cust.email || '',
      package_id: String(cust.package_id),
      odp_id: cust.odp_id || '',
      ont_sn: cust.ont_sn || '',
      ont_model: cust.ont_model || '',
      pppoe_username: cust.pppoe_username || '',
      pppoe_password: cust.pppoe_password || '',
      notes: cust.notes || ''
    });
    setIsAddCustomerOpen(true);
  };

  // Submit Customer (Create or Update)
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik || !formData.address || !formData.phone_number || !formData.package_id) {
      showToast('Nama, NIK, Alamat, No WhatsApp, dan Paket Layanan wajib diisi.', true);
      return;
    }

    try {
      const payload: Partial<Customer> = {
        name: formData.name,
        nik: formData.nik,
        address: formData.address,
        phone_number: formData.phone_number,
        email: formData.email || null,
        package_id: parseInt(formData.package_id, 10),
        odp_id: formData.odp_id || null,
        ont_sn: formData.ont_sn || null,
        ont_model: formData.ont_model || null,
        pppoe_username: formData.pppoe_username || null,
        pppoe_password: formData.pppoe_password || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        notes: formData.notes || null
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
        showToast(`Data pelanggan '${formData.name}' berhasil diperbarui.`);
      } else {
        await api.createCustomer(payload);
        showToast(`Pelanggan baru '${formData.name}' berhasil didaftarkan dan terhubung ke FTTH GIS.`);
      }

      setIsAddCustomerOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data pelanggan', true);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = (cust: Customer) => {
    setConfirmModal({
      title: `Hapus Pelanggan: ${cust.name}`,
      description: `Apakah Anda yakin ingin menghapus pelanggan "${cust.name}" (${cust.customer_number})? Semua histori dan node ONT terkait akan dihapus dari database.`,
      actionText: 'Hapus Pelanggan',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteCustomer(cust.id);
          showToast(`Pelanggan '${cust.name}' berhasil dihapus.`);
          setConfirmModal(null);
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus pelanggan', true);
        }
      }
    });
  };

  // Action: Isolir Customer via Mikrotik API
  const handleIsolir = (cust: Customer) => {
    setConfirmModal({
      title: `Konfirmasi ISOLIR: ${cust.name}`,
      description: `Profile pelanggan di MikroTik akan diubah menjadi 'isolir' dan koneksi PPPoE aktif akan diputus secara instan.`,
      actionText: 'Isolir Pelanggan',
      variant: 'warning',
      onConfirm: async () => {
        try {
          setActionLoadingId(cust.id);
          const res = await api.isolirCustomer(cust.id);
          showToast(res.message);
          setConfirmModal(null);
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal mengisolir pelanggan', true);
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // Action: Buka Isolir Customer via Mikrotik API
  const handleBukaIsolir = (cust: Customer) => {
    setConfirmModal({
      title: `Konfirmasi BUKA ISOLIR: ${cust.name}`,
      description: `Profile PPPoE di MikroTik akan dikembalikan ke paket layanan normal (${cust.package_name || 'normal'}).`,
      actionText: 'Buka Isolir',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setActionLoadingId(cust.id);
          const res = await api.bukaIsolirCustomer(cust.id);
          showToast(res.message);
          setConfirmModal(null);
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal membuka isolir pelanggan', true);
        } finally {
          setActionLoadingId(null);
        }
      }
    });
  };

  // Action: WhatsApp Reminder
  const handleOpenWaReminder = async (cust: Customer) => {
    setSelectedCustomerForWa(cust);
    try {
      const res = await api.sendWaReminder(cust.id);
      setWaMessageData({
        phone: res.phone,
        text: res.message_text,
        url: res.wa_url
      });
      setIsWaModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat pesan WhatsApp', true);
    }
  };

  // Service Package CRUD
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageForm.name || !packageForm.price || !packageForm.bandwidth) {
      showToast('Nama paket, tarif tagihan, dan kapasitas bandwidth wajib diisi.', true);
      return;
    }
    try {
      setPackageFormLoading(true);
      const payload: Partial<Package> = {
        name: packageForm.name,
        price: parseFloat(packageForm.price),
        bandwidth: packageForm.bandwidth,
        description: packageForm.description,
        mikrotik_profile: packageForm.mikrotik_profile || packageForm.name
      };

      if (packageForm.id) {
        await api.updatePackage(packageForm.id, payload);
        showToast(`Paket '${packageForm.name}' berhasil diperbarui.`);
      } else {
        await api.createPackage(payload);
        showToast(`Paket '${packageForm.name}' berhasil ditambahkan.`);
      }

      setPackageForm({ id: null, name: '', price: '', bandwidth: '', description: '', mikrotik_profile: '' });
      const pkgRes = await api.getPackages();
      setPackages(pkgRes.packages || []);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan paket', true);
    } finally {
      setPackageFormLoading(false);
    }
  };

  const handleDeletePackage = (pkg: Package) => {
    setConfirmModal({
      title: `Hapus Paket: ${pkg.name}`,
      description: `Apakah Anda yakin ingin menghapus paket layanan "${pkg.name}" dari database?`,
      actionText: 'Hapus Paket',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deletePackage(pkg.id);
          showToast(`Paket '${pkg.name}' berhasil dihapus.`);
          setConfirmModal(null);
          const pkgRes = await api.getPackages();
          setPackages(pkgRes.packages || []);
          fetchData();
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus paket', true);
        }
      }
    });
  };

  // Formatting Rupiah
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  // Metrics summary
  const totalCustomers = customers.length;
  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const isolirCount = customers.filter((c) => c.status === 'ISOLIR').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.package_price || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-sm animate-in fade-in slide-in-from-top-2 border ${
            toast.isError
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Data & Manajemen Pelanggan</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Integrasi PPPoE MikroTik, isolir otomatis, pemetaan ODP GIS, dan notifikasi WhatsApp
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPackagesModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-white text-xs font-medium transition shadow-sm"
          >
            <PackageIcon className="w-4 h-4 text-cyan-400" />
            <span>Setting Paket Layanan</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Registrasi Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Pelanggan</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{totalCustomers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Terdaftar di sistem database ISP</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pelanggan Aktif</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">{activeCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Koneksi PPPoE aktif & online</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pelanggan Terisolir</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">{isolirCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Profil MikroTik isolir / tagihan tertunda</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Estimasi Tagihan</span>
            <CreditCard className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-300 tracking-tight">{formatRupiah(totalRevenue)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Potensi pendapatan bulanan aktif</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama, NIK, alamat, WhatsApp, PPPoE user, atau Serial Number ONT..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-24 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="ISOLIR">Isolir</option>
            <option value="DOWN">Down</option>
          </select>

          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Semua Paket</option>
            {packages.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 cursor-pointer hover:text-white transition" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">
                    <span>Pelanggan / NIK</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Alamat & Lokasi</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white transition" onClick={() => handleSort('phone_number')}>
                  <div className="flex items-center gap-1.5">
                    <span>WhatsApp / HP</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white transition" onClick={() => handleSort('package_id')}>
                  <div className="flex items-center gap-1.5">
                    <span>Layanan / Paket</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">PPPoE MikroTik</th>
                <th className="py-3 px-4">Distribusi ODP & ONT</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white transition" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Aksi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-600" />
                      <span>Tidak ada data pelanggan yang sesuai dengan pencarian atau filter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const isPasswordShown = !!visiblePasswords[cust.id];
                  const isLoadingAction = actionLoadingId === cust.id;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-800/40 transition group">
                      {/* Name & NIK */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                          {cust.name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-cyan-400/90">{cust.customer_number}</span>
                          <span>•</span>
                          <span>NIK: {cust.nik}</span>
                        </div>
                      </td>

                      {/* Address & Coordinates */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-slate-300 line-clamp-1" title={cust.address}>
                          {cust.address}
                        </div>
                        {cust.latitude && cust.longitude ? (
                          <button
                            onClick={() => onNavigateToMap && onNavigateToMap(`ONT-${cust.id}`, cust.latitude || 0, cust.longitude || 0)}
                            className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline mt-0.5"
                          >
                            <MapPin className="w-3 h-3 text-cyan-400" />
                            <span>
                              {cust.latitude.toFixed(5)}, {cust.longitude.toFixed(5)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600 italic">Koordinat belum diset</span>
                        )}
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{cust.phone_number}</span>
                        </div>
                        {cust.email && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{cust.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Package & Billing */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{cust.package_name || 'Paket ID ' + cust.package_id}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="text-cyan-300 font-semibold">{formatRupiah(cust.package_price || 0)}</span>
                          {cust.bandwidth && (
                            <>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                                {cust.bandwidth}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* PPPoE Credentials */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-cyan-400 font-medium">
                          {cust.pppoe_username || '-'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-400">
                            {isPasswordShown ? cust.pppoe_password || '-' : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setVisiblePasswords((prev) => ({ ...prev, [cust.id]: !prev[cust.id] }))
                            }
                            className="text-slate-500 hover:text-slate-300"
                            title="Tampilkan password"
                          >
                            {isPasswordShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      {/* ODP & ONT */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/50 text-[11px] text-emerald-300 font-medium">
                          <Radio className="w-3 h-3" />
                          <span>{cust.odp_name ? `${cust.odp_code || ''} (${cust.odp_name})` : 'Belum Terhubung ODP'}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <span className="text-slate-500">SN:</span>
                          <span>{cust.ont_sn || '-'}</span>
                          {cust.ont_model && <span className="text-slate-500 text-[10px]">({cust.ont_model})</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {cust.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Aktif
                          </span>
                        )}
                        {cust.status === 'ISOLIR' && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[11px] font-semibold">
                              <Lock className="w-3 h-3 text-amber-400" />
                              Isolir
                            </span>
                            {cust.isolir_at && (
                              <div className="text-[10px] text-amber-400/80 mt-1">
                                {new Date(cust.isolir_at).toLocaleDateString('id-ID')}
                              </div>
                            )}
                          </div>
                        )}
                        {cust.status === 'DOWN' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-800/80 text-rose-300 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            LOS / Down
                          </span>
                        )}
                      </td>

                      {/* Operational Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Isolir / Buka Isolir Button */}
                          {cust.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleIsolir(cust)}
                              disabled={isLoadingAction}
                              title="Isolir Layanan (Ganti profil MikroTik ke isolir & putus sesi aktif)"
                              className="p-1.5 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300 hover:bg-amber-900/60 transition active:scale-95 disabled:opacity-50"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBukaIsolir(cust)}
                              disabled={isLoadingAction}
                              title="Buka Isolir (Kembalikan ke profil layanan normal)"
                              className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 transition active:scale-95 disabled:opacity-50"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* WhatsApp Reminder Button */}
                          <button
                            onClick={() => handleOpenWaReminder(cust)}
                            title="Kirim Pengingat Tagihan WhatsApp"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/60 hover:border-emerald-700/60 text-slate-300 hover:text-emerald-300 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* View Map Location */}
                          {cust.latitude && cust.longitude && (
                            <button
                              onClick={() => onNavigateToMap && onNavigateToMap(`ONT-${cust.id}`, cust.latitude || 0, cust.longitude || 0)}
                              title="Tampilkan Lokasi di Map FTTH"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950/60 hover:border-cyan-700/60 text-slate-300 hover:text-cyan-300 transition"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit Customer */}
                          <button
                            onClick={() => openEditModal(cust)}
                            title="Edit Data Pelanggan"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Customer */}
                          <button
                            onClick={() => handleDeleteCustomer(cust)}
                            title="Hapus Pelanggan"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/60 text-slate-300 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: REGISTRASI & EDIT PELANGGAN                      */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title={editingCustomer ? 'Edit Data Pelanggan' : 'Registrasi Pelanggan Baru'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCustomerSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Lengkap Pelanggan <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Budi Santoso"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nomor KTP / NIK (Format Angka) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nik}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                placeholder="16 digit NIK KTP"
                maxLength={16}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alamat Lengkap Rumah Pelanggan <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Jl. Merdeka No. 12, RT 02 / RW 05, Kelurahan..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nomor WhatsApp / HP (Numeric) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/[^\d+]/g, '') })}
                placeholder="08123456789 atau 628123..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Pelanggan (Tidak Wajib)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="budi@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Layanan / Paket Internet <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={formData.package_id}
                onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Pilih Paket Layanan --</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={String(pkg.id)}>
                    {pkg.name} — {formatRupiah(pkg.price)} ({pkg.bandwidth})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Distribusi ODP (Dari Map FTTH GIS)
              </label>
              <select
                value={formData.odp_id}
                onChange={(e) => setFormData({ ...formData, odp_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Pilih Titik ODP / FAT Terdekat --</option>
                {odpList.map((odp) => (
                  <option key={odp.id} value={odp.id}>
                    {odp.code} - {odp.name} ({odp.ports_used}/{odp.port_capacity} port)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Serial Number (SN) ONT
              </label>
              <input
                type="text"
                value={formData.ont_sn}
                onChange={(e) => setFormData({ ...formData, ont_sn: e.target.value.toUpperCase() })}
                placeholder="Contoh: ZTEGC1234567 / HWTC..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Model ONT / Tipe Perangkat
              </label>
              <input
                type="text"
                value={formData.ont_model}
                onChange={(e) => setFormData({ ...formData, ont_model: e.target.value })}
                placeholder="Contoh: ZTE F609, F670L, HG8245H5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Username PPPoE MikroTik
              </label>
              <input
                type="text"
                value={formData.pppoe_username}
                onChange={(e) => setFormData({ ...formData, pppoe_username: e.target.value.toLowerCase().trim() })}
                placeholder="Otomatis jika dikosongkan (td_nama...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password PPPoE MikroTik
              </label>
              <input
                type="text"
                value={formData.pppoe_password}
                onChange={(e) => setFormData({ ...formData, pppoe_password: e.target.value })}
                placeholder="Otomatis jika dikosongkan (td@...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Coordinates Picker helper */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">Koordinat Peta Google Maps</span>
              <span className="text-[11px] text-cyan-400">Untuk plotting jalur dropcore FTTH</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="Latitude (-6.2088...)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Longitude (106.8456...)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition"
            >
              {editingCustomer ? 'Simpan Perubahan' : 'Registrasikan Pelanggan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: SETTING PAKET LAYANAN INTERNET                   */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPackagesModalOpen}
        onClose={() => setIsPackagesModalOpen(false)}
        title="Setting Paket Layanan Internet"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Form Create / Edit Package */}
          <form onSubmit={handleSavePackage} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              {packageForm.id ? 'Edit Paket Layanan' : 'Tambah Paket Baru'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nama Paket *</label>
                <input
                  type="text"
                  required
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                  placeholder="Contoh: HOME 20 Mbps"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Tagihan (Rp Angka) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={packageForm.price}
                  onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                  placeholder="Contoh: 175000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Kapasitas Bandwidth *</label>
                <input
                  type="text"
                  required
                  value={packageForm.bandwidth}
                  onChange={(e) => setPackageForm({ ...packageForm, bandwidth: e.target.value })}
                  placeholder="20 Mbps / 20 Mbps"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Profile MikroTik (Opsional)</label>
                <input
                  type="text"
                  value={packageForm.mikrotik_profile}
                  onChange={(e) => setPackageForm({ ...packageForm, mikrotik_profile: e.target.value })}
                  placeholder="Nama profile di ppp profile (default sama dengan nama)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Deskripsi Paket</label>
                <input
                  type="text"
                  value={packageForm.description}
                  onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  placeholder="Keterangan layanan..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {packageForm.id && (
                <button
                  type="button"
                  onClick={() => setPackageForm({ id: null, name: '', price: '', bandwidth: '', description: '', mikrotik_profile: '' })}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                disabled={packageFormLoading}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {packageForm.id ? 'Perbarui Paket' : 'Simpan Paket Baru'}
              </button>
            </div>
          </form>

          {/* List of Existing Packages */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Daftar Paket Layanan di Database
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div>
                    <div className="font-semibold text-white text-xs">{pkg.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="text-cyan-400 font-semibold">{formatRupiah(pkg.price)}</span>
                      <span>•</span>
                      <span>{pkg.bandwidth}</span>
                      {pkg.mikrotik_profile && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-500">Profile: {pkg.mikrotik_profile}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setPackageForm({
                          id: pkg.id,
                          name: pkg.name,
                          price: String(pkg.price),
                          bandwidth: pkg.bandwidth,
                          description: pkg.description || '',
                          mikrotik_profile: pkg.mikrotik_profile || ''
                        })
                      }
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Edit Paket"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-400 transition"
                      title="Hapus Paket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: KIRIM PENGINGAT TAGIHAN WHATSAPP                 */}
      {/* ======================================================== */}
      <Modal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        title="Kirim Pengingat Tagihan via WhatsApp"
        maxWidth="lg"
      >
        {selectedCustomerForWa && waMessageData && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold text-emerald-300">
                  {selectedCustomerForWa.name} ({waMessageData.phone})
                </div>
                <div className="text-slate-400 mt-0.5">
                  Nomor telah distandarisasi ke format internasional (62xxx).
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Preview Teks Pesan Pengingat:
              </label>
              <textarea
                readOnly
                rows={9}
                value={waMessageData.text}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none selection:bg-cyan-500/30"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(waMessageData.text);
                  showToast('Teks pesan berhasil disalin ke clipboard!');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks</span>
              </button>

              <a
                href={waMessageData.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsWaModalOpen(false)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka WhatsApp & Kirim</span>
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* Action Confirmation Modal */}
      {confirmModal && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
        >
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-300">
              {confirmModal.description}
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmSubmitting}
                onClick={async () => {
                  setConfirmSubmitting(true);
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setConfirmSubmitting(false);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                }`}
              >
                {confirmSubmitting ? 'Memproses...' : confirmModal.actionText}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
