import React, { useEffect, useState } from 'react';
import { Settings, Save, Server, Radio, Database, ShieldCheck, CheckCircle2, Terminal } from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    isp_name: 'ISP Transdata',
    snmp_default_community: 'public',
    snmp_default_timeout: '3',
    snmp_default_retries: '2',
    genieacs_nbi_url: 'http://127.0.0.1:7557',
    ping_default_count: '4',
    gis_default_lat: '-6.2088',
    gis_default_lng: '106.8456',
    gis_default_zoom: '14'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Pengaturan Sistem Transdata NMS</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Konfigurasi default SNMP polling, GenieACS NBI endpoint, parameter ICMP ping, dan GIS
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Pengaturan sistem berhasil disimpan ke database.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identitas ISP */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Identitas Layanan & ISP</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Resmi ISP</label>
              <input
                type="text"
                value={settings.isp_name}
                onChange={(e) => handleChange('isp_name', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Jumlah Paket Ping (Count)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.ping_default_count}
                onChange={(e) => handleChange('ping_default_count', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SNMP Defaults */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Terminal className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Konfigurasi Net-SNMP CLI</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Community String</label>
              <input
                type="text"
                value={settings.snmp_default_community}
                onChange={(e) => handleChange('snmp_default_community', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SNMP Timeout (Detik)</label>
              <input
                type="number"
                min={1}
                max={15}
                value={settings.snmp_default_timeout}
                onChange={(e) => handleChange('snmp_default_timeout', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SNMP Retries</label>
              <input
                type="number"
                min={0}
                max={5}
                value={settings.snmp_default_retries}
                onChange={(e) => handleChange('snmp_default_retries', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* GenieACS NBI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Radio className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Integrasi GenieACS NBI</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">GenieACS NBI Endpoint URL</label>
            <input
              type="text"
              value={settings.genieacs_nbi_url}
              onChange={(e) => handleChange('genieacs_nbi_url', e.target.value)}
              placeholder="http://127.0.0.1:7557"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Alamat service GenieACS Northbound Interface untuk polling TR-069 dan status optical power.
            </p>
          </div>
        </div>

        {/* GIS Default Center */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Default Titik Tengah GIS FTTH</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude Tengah</label>
              <input
                type="text"
                value={settings.gis_default_lat}
                onChange={(e) => handleChange('gis_default_lat', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude Tengah</label>
              <input
                type="text"
                value={settings.gis_default_lng}
                onChange={(e) => handleChange('gis_default_lng', e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-900/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
