import React from 'react';
import {
  LayoutDashboard,
  Server,
  Activity,
  Router,
  Radio,
  MapPin,
  Bell,
  ShieldCheck,
  Settings,
  Users,
  X
} from 'lucide-react';

export type NavItem =
  | 'dashboard'
  | 'customers'
  | 'devices'
  | 'mikrotik'
  | 'genieacs'
  | 'gis'
  | 'alarms'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  activeAlarmCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  activeAlarmCount
}) => {
  const menuItems = [
    { id: 'dashboard' as NavItem, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers' as NavItem, label: 'Data Pelanggan', icon: Users },
    { id: 'devices' as NavItem, label: 'Perangkat (Devices)', icon: Server },
    { id: 'mikrotik' as NavItem, label: 'MikroTik RouterOS', icon: Router },
    { id: 'genieacs' as NavItem, label: 'GenieACS (ONT/CPE)', icon: Radio },
    { id: 'gis' as NavItem, label: 'GIS FTTH (Peta Fiber)', icon: MapPin },
    { id: 'alarms' as NavItem, label: 'Alarm & Insiden', icon: Bell, badge: activeAlarmCount },
    { id: 'audit' as NavItem, label: 'Audit Logs', icon: ShieldCheck },
    { id: 'settings' as NavItem, label: 'Pengaturan Sistem', icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Mobile Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 md:hidden">
        <span className="text-sm font-semibold text-white">Menu Navigasi NMS</span>
        <button
          onClick={onCloseMobile}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Operasional Jaringan
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="font-semibold text-slate-300">ISP TRANSDATA</div>
        <div className="mt-0.5">Engine: PHP 8.3 & Linux Net-SNMP</div>
        <div className="text-[10px] text-slate-400 mt-1">Strict Real Data Active</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16">
        {content}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
