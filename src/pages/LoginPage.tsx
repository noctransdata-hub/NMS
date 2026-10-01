import React, { useState } from 'react';
import { Lock, User, Radio, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types/nms';

interface LoginPageProps {
  onLoginSuccess: (user: UserType, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ username, password });
      localStorage.setItem('transdata_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Login gagal. Periksa username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-xl shadow-cyan-900/30 mb-4">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">TRANSDATA NMS</h1>
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mt-1">
            ISP Operations & Network Monitoring
          </p>
        </div>

        {/* Login form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-100">Masuk ke Sistem</h2>
            <p className="text-xs text-slate-400 mt-0.5">Kredensial operator NOC atau Engineer</p>
          </div>

          {error && (
            <div className="p-3 mb-5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username atau Email</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username NOC"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                <span>Memverifikasi...</span>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Terproteksi RBAC & Enkripsi Sesi</span>
          </div>
        </div>
      </div>
    </div>
  );
};
