import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, UserCheck, Lock, Mail, User as UserIcon, Radio } from 'lucide-react';
import { api } from '../services/api';

interface SetupAdminPageProps {
  onSetupSuccess: () => void;
}

export const SetupAdminPage: React.FC<SetupAdminPageProps> = ({ onSetupSuccess }) => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    if (password.length < 8) {
      setError('Password minimal harus 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      await api.setupFirstAdmin({
        username,
        full_name: fullName,
        email,
        password
      });
      onSetupSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat akun superadmin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-xl shadow-cyan-900/30 mb-4">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">TRANSDATA NMS</h1>
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mt-1">
            Network Management System & GIS FTTH
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 p-3.5 mb-6 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <div className="font-semibold text-amber-200">Inisialisasi Keamanan Pertama</div>
              <div className="text-amber-300/80 mt-0.5">
                Database terpasang bersih. Buat kredensial Superadmin utama untuk mengelola NMS.
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 mb-5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="cth. NOC Transdata Admin"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username Administrator</label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cth. nocadmin"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Alamat Email NOC</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="noc@transdata.net.id"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password Superadmin (Min. 8 Karakter)</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Memproses Inisialisasi...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aktifkan Superadmin Transdata</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
