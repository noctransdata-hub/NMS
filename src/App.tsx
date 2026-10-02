/**
 * Transdata NMS - Real ISP Network Management System & GIS FTTH
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { SystemStatus, User } from './types/nms';
import { Navbar } from './components/Navbar';
import { Sidebar, NavItem } from './components/Sidebar';
import { SetupAdminPage } from './pages/SetupAdminPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { MikrotikPage } from './pages/MikrotikPage';
import { GenieAcsPage } from './pages/GenieAcsPage';
import { GisFtthPage } from './pages/GisFtthPage';
import { CustomersPage } from './pages/CustomersPage';
import { PackagesPage } from './pages/PackagesPage';
import { AlarmsPage } from './pages/AlarmsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [gisTarget, setGisTarget] = useState<{ id?: string; lat?: number; lng?: number } | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [activeAlarmCount, setActiveAlarmCount] = useState(0);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // 1. Initial System Status Check
  const checkStatus = async () => {
    try {
      const status = await api.getSystemStatus();
      setSystemStatus(status);

      // Check stored token if user is not already logged in
      const token = localStorage.getItem('transdata_token');
      if (status.has_admin_user && token) {
        try {
          const meRes = await api.getMe();
          if (meRes.user) {
            setCurrentUser(meRes.user);
          }
        } catch {
          localStorage.removeItem('transdata_token');
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil status sistem:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Poll alarms count periodically
  useEffect(() => {
    if (!currentUser) return;
    const fetchAlarms = async () => {
      try {
        const res = await api.getAlarms();
        const active = (res.alarms || []).filter((a) => a.status === 'ACTIVE').length;
        setActiveAlarmCount(active);
      } catch (err) {
        // silent catch
      }
    };
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('transdata_token');
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
          <span className="text-sm font-medium">Memulai Sistem Operasional Transdata NMS...</span>
        </div>
      </div>
    );
  }

  // If no admin user exists, show First Superadmin Setup Wizard
  if (systemStatus && !systemStatus.has_admin_user) {
    return (
      <SetupAdminPage
        onSetupSuccess={() => {
          checkStatus();
        }}
      />
    );
  }

  // If not authenticated, show Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  // Authenticated NMS Operational Interface
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Navbar
        user={currentUser}
        systemStatus={systemStatus}
        activeAlarmCount={activeAlarmCount}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onOpenAlarms={() => {
          setSelectedDeviceId(null);
          setCurrentTab('alarms');
        }}
      />

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setSelectedDeviceId(null);
            setCurrentTab(tab);
          }}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          activeAlarmCount={activeAlarmCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          {selectedDeviceId !== null ? (
            <DeviceDetailPage
              deviceId={selectedDeviceId}
              onBack={() => setSelectedDeviceId(null)}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardPage
                  onNavigate={(tab) => {
                    setSelectedDeviceId(null);
                    setCurrentTab(tab);
                  }}
                  onOpenAddDevice={() => {
                    setCurrentTab('devices');
                    setIsAddDeviceOpen(true);
                  }}
                />
              )}

              {currentTab === 'customers' && (
                <CustomersPage
                  onNavigateToMap={(targetId, lat, lng) => {
                    setSelectedDeviceId(null);
                    setGisTarget({ id: targetId, lat, lng });
                    setCurrentTab('gis');
                  }}
                />
              )}

              {currentTab === 'packages' && <PackagesPage />}

              {currentTab === 'devices' && (
                <DevicesPage
                  onSelectDevice={(id) => setSelectedDeviceId(id)}
                  isAddOpen={isAddDeviceOpen}
                  onOpenAdd={() => setIsAddDeviceOpen(true)}
                  onCloseAdd={() => setIsAddDeviceOpen(false)}
                />
              )}

              {currentTab === 'mikrotik' && <MikrotikPage />}

              {currentTab === 'genieacs' && <GenieAcsPage />}

              {currentTab === 'gis' && (
                <GisFtthPage
                  targetFocus={gisTarget}
                  onClearTarget={() => setGisTarget(null)}
                />
              )}

              {currentTab === 'alarms' && <AlarmsPage />}

              {currentTab === 'audit' && <AuditLogsPage />}

              {currentTab === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
