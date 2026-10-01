import React from 'react';
import { Radio, Bell, LogOut, Menu, Terminal, User as UserIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { User, SystemStatus } from '../types/nms';

interface NavbarProps {
  user: User | null;
  systemStatus: SystemStatus | null;
  activeAlarmCount: number;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onOpenAlarms: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  systemStatus,
  activeAlarmCount,
  onLogout,
  onToggleMobileMenu,
  onOpenAlarms
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-200 md:hidden rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Buka navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-900/30">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">TRANSDATA</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                NMS
              </span>
            </div>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
              Network Management & GIS FTTH
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 md:gap-4">
        {/* System Diagnostic Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Net-SNMP:</span>
          {systemStatus?.net_snmp_installed ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Tersedia (CLI)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Perlu Diinstal
            </span>
          )}
        </div>

        {/* Alarms trigger */}
        <button
          onClick={onOpenAlarms}
          className={`relative p-2 rounded-lg border transition-colors cursor-pointer ${
            activeAlarmCount > 0
              ? 'bg-rose-950/50 border-rose-800/60 text-rose-300 hover:bg-rose-900/50'
              : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={`${activeAlarmCount} Alarm Aktif`}
        >
          <Bell className="w-4 h-4" />
          {activeAlarmCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
              {activeAlarmCount}
            </span>
          )}
        </button>

        {/* Operator Profile */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 leading-tight">{user.full_name}</div>
              <div className="text-[10px] text-cyan-400 font-medium">{user.role_name}</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 ml-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <UserIcon className="w-4 h-4" />
            <span>Mode Setup</span>
          </div>
        )}
      </div>
    </header>
  );
};
