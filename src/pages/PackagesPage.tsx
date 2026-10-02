import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Package as PackageIcon,
  Wifi,
  Users,
  DollarSign,
  ArrowUpDown,
  Router,
  X
} from 'lucide-react';
import { Package, Customer } from '../types/nms';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

export const PackagesPage: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'price' | 'bandwidth'>('price');
  const [sortAsc, setSortAsc] = useState(true);

  // Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formBandwidth, setFormBandwidth] = useState('');
  const [formProfile, setFormProfile] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const showToast = (message: string, isError: boolean = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pkgRes, custRes] = await Promise.all([api.getPackages(), api.getCustomers()]);
      setPackages(pkgRes.packages || []);
      setCustomers(custRes.customers || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data paket layanan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const openAddModal = () => {
    setEditingPackage(null);
    setFormName('');
    setFormPrice('');
    setFormBandwidth('20 Mbps');
    setFormProfile('');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormName(pkg.name);
    setFormPrice(String(pkg.price));
    setFormBandwidth(pkg.bandwidth);
    setFormProfile(pkg.mikrotik_profile || pkg.name);
    setFormDesc(pkg.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice.trim() || !formBandwidth.trim()) {
      showToast('Nama Paket, Tagihan (Rp), dan Kapasitas Bandwidth wajib diisi.', true);
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('Nominal Tagihan harus berupa angka yang valid.', true);
      return;
    }

    try {
      setSubmitting(true);
      const payload: Partial<Package> = {
        name: formName.trim(),
        price: priceNum,
        bandwidth: formBandwidth.trim(),
        description: formDesc.trim(),
        mikrotik_profile: formProfile.trim() || formName.trim()
      };

      if (editingPackage) {
        await api.updatePackage(editingPackage.id, payload);
        showToast(`Paket layanan '${formName}' berhasil diperbarui.`);
      } else {
        await api.createPackage(payload);
        showToast(`Paket layanan baru '${formName}' berhasil ditambahkan ke database.`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan paket layanan', true);
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (pkg: Package) => {
    const subscriberCount = customers.filter((c) => c.package_id === pkg.id).length;
    if (subscriberCount > 0) {
      setDeleteWarning(
        `Paket "${pkg.name}" masih digunakan oleh ${subscriberCount} pelanggan aktif. Silakan alihkan paket pelanggan terlebih dahulu sebelum menghapus.`
      );
      setDeleteTarget(null);
    } else {
      setDeleteWarning(null);
      setDeleteTarget(pkg);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deletePackage(deleteTarget.id);
      showToast(`Paket layanan '${deleteTarget.name}' berhasil dihapus.`);
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus paket layanan', true);
    } finally {
      setDeleting(false);
    }
  };

  // Sorting and filtering
  const filteredPackages = packages
    .filter((p) => {
      const q = searchTerm.toLowerCase();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.bandwidth.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

  const handleSort = (field: 'name' | 'price' | 'bandwidth') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Stats
  const totalSubscribers = customers.length;
  const avgPrice =
    packages.length > 0
      ? Math.round(packages.reduce((acc, p) => acc + (p.price || 0), 0) / packages.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs border ${
            toast.isError
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950'
              : 'bg-slate-900/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            <span>Setting Paket Layanan Internet</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Konfigurasi tarif tagihan, alokasi bandwidth, dan pemetaan profil MikroTik RouterOS yang tersimpan di database.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Paket Layanan</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Paket Layanan</span>
            <PackageIcon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{packages.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pilihan paket aktif untuk registrasi pelanggan</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Rata-rata Tarif Tagihan</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">{formatRupiah(avgPrice)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Per bulan per pelanggan terdaftar</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pelanggan Berlangganan</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{totalSubscribers}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pelanggan terikat dengan paket database</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama paket, bandwidth, atau profil..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="underline hover:text-white cursor-pointer ml-4">
            Coba Lagi
          </button>
        </div>
      )}

      {/* Packages Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3.5">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 hover:text-cyan-400 cursor-pointer"
                  >
                    <span>Nama Paket Layanan</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3.5">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-1.5 hover:text-cyan-400 cursor-pointer"
                  >
                    <span>Tagihan (Rp / Bln)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3.5">
                  <button
                    onClick={() => handleSort('bandwidth')}
                    className="flex items-center gap-1.5 hover:text-cyan-400 cursor-pointer"
                  >
                    <span>Kapasitas Bandwidth</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3.5">Profil MikroTik RouterOS</th>
                <th className="px-4 py-3.5 text-center">Pelanggan Aktif</th>
                <th className="px-4 py-3.5">Keterangan</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && packages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    <span>Memuat data paket layanan internet...</span>
                  </td>
                </tr>
              ) : filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Tidak ada paket layanan yang sesuai filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg) => {
                  const subscribers = customers.filter((c) => c.package_id === pkg.id);
                  return (
                    <tr key={pkg.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <PackageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{pkg.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {pkg.id}</div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-400 font-mono text-sm">
                        {formatRupiah(pkg.price)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-200">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
                          <Wifi className="w-3 h-3" />
                          {pkg.bandwidth}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Router className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {pkg.mikrotik_profile || pkg.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 font-bold">
                          <Users className="w-3 h-3 text-cyan-400" />
                          {subscribers.length}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate">
                        {pkg.description || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(pkg)}
                            title="Edit Paket"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600/30 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => requestDelete(pkg)}
                            title="Hapus Paket"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-400 transition cursor-pointer"
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

      {/* Add / Edit Package Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPackage ? `Edit Paket Layanan: ${editingPackage.name}` : 'Tambah Paket Layanan Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nama Paket * <span className="text-slate-500 font-normal">(Text & Angka &gt; Masuk Database)</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="cth. HOME 20 Mbps / BISNIS 50 Mbps"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tagihan * <span className="text-slate-500 font-normal">(Rp. Angka &gt; Masuk Database)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="cth. 250000"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono font-semibold focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Kapasitas Bandwidth * <span className="text-slate-500 font-normal">(Text & Angka &gt; Masuk Database)</span>
              </label>
              <input
                type="text"
                required
                value={formBandwidth}
                onChange={(e) => setFormBandwidth(e.target.value)}
                placeholder="cth. 20 Mbps / 50 Mbps Simetris"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Profil MikroTik RouterOS <span className="text-slate-500 font-normal">(Opsional - Default sama dengan nama paket)</span>
            </label>
            <input
              type="text"
              value={formProfile}
              onChange={(e) => setFormProfile(e.target.value)}
              placeholder="cth. profile-20m / pppoe-home-20"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Digunakan saat proses Buka Isolir untuk mengembalikan profil secret PPPoE pelanggan secara otomatis.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Deskripsi Paket / Keterangan Tambahan
            </label>
            <textarea
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="cth. Paket internet unlimited rumahan FUP bebas hambatan 24/7."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-900/30 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : editingPackage ? 'Perbarui Paket Layanan' : 'Simpan Paket ke Database'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title={`Konfirmasi Hapus Paket: ${deleteTarget.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-300">
              Apakah Anda yakin ingin menghapus paket layanan <strong className="text-white font-semibold">"{deleteTarget.name}"</strong> dengan tarif <strong className="text-emerald-400 font-semibold">{formatRupiah(deleteTarget.price)}</strong> dari database?
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-900/30 transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Hapus Paket'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Warning Modal (Subscribers present) */}
      {deleteWarning && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteWarning(null)}
          title="Tidak Dapat Menghapus Paket"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>{deleteWarning}</span>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
