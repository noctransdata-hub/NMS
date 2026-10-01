import {
  SystemStatus,
  User,
  Device,
  DeviceInterface,
  PingResult,
  SnmpResult,
  GenieAcsDevice,
  Alarm,
  AuditLog,
  DashboardSummary
} from '../types/nms';
import { FtthObject, FtthCable, TopologyTraceResult } from '../types/gis';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('transdata_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  return data as T;
}

export const api = {
  // System Status & Diagnostic
  getSystemStatus: () => request<SystemStatus>('/system/status'),
  setupFirstAdmin: (payload: { username: string; email: string; password: string; full_name: string }) =>
    request<{ success: boolean; message: string; user: User }>('/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  login: (payload: { username: string; password: string }) =>
    request<{ success: boolean; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getMe: () => request<{ success: boolean; user: User }>('/auth/me'),

  // Dashboard Summary
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  // Devices
  getDevices: () => request<{ success: boolean; count: number; devices: Device[] }>('/devices'),
  getDevice: (id: number) => request<{ success: boolean; device: Device; interfaces: DeviceInterface[] }>(`/devices/${id}`),
  createDevice: (payload: Partial<Device>) =>
    request<{ success: boolean; message: string; device: Device }>('/devices', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateDevice: (id: number, payload: Partial<Device>) =>
    request<{ success: boolean; device: Device }>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteDevice: (id: number) =>
    request<{ success: boolean; message: string }>(`/devices/${id}`, {
      method: 'DELETE'
    }),

  // Diagnostics: Real ICMP Ping & Net-SNMP
  testDevicePing: (id: number, count = 4) =>
    request<{ success: boolean; ping: PingResult }>(`/devices/${id}/ping`, {
      method: 'POST',
      body: JSON.stringify({ count })
    }),
  pollDeviceSnmp: (id: number) =>
    request<{ success: boolean; snmp: SnmpResult }>(`/devices/${id}/poll-snmp`, {
      method: 'POST'
    }),

  // MikroTik
  testMikrotik: (host: string, port = 8728) =>
    request<{ success: boolean; status: string; latency_ms: number | null; message: string }>('/mikrotik/test-connection', {
      method: 'POST',
      body: JSON.stringify({ host, port })
    }),

  // GenieACS NBI
  getGenieAcsDevices: () =>
    request<{ success: boolean; count: number; nbi_url: string; error?: string; devices: GenieAcsDevice[] }>('/genieacs/devices'),

  // GIS FTTH
  getGisObjects: () => request<{ success: boolean; count: number; objects: FtthObject[] }>('/gis/objects'),
  saveGisObject: (payload: Partial<FtthObject>) =>
    request<{ success: boolean; object: FtthObject }>('/gis/objects', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteGisObject: (id: string) =>
    request<{ success: boolean; message: string }>(`/gis/objects/${id}`, {
      method: 'DELETE'
    }),
  getGisCables: () => request<{ success: boolean; count: number; cables: FtthCable[] }>('/gis/cables'),
  saveGisCable: (payload: Partial<FtthCable>) =>
    request<{ success: boolean; cable: FtthCable }>('/gis/cables', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteGisCable: (id: string) =>
    request<{ success: boolean; message: string }>(`/gis/cables/${id}`, {
      method: 'DELETE'
    }),
  traceTopologyImpact: (objectId: string) =>
    request<TopologyTraceResult>(`/gis/topology/trace/${objectId}`),

  // Alarms & Audit Logs
  getAlarms: () => request<{ success: boolean; alarms: Alarm[] }>('/alarms'),
  acknowledgeAlarm: (id: number) =>
    request<{ success: boolean; alarm: Alarm }>(`/alarms/${id}/acknowledge`, {
      method: 'POST'
    }),
  getAuditLogs: () => request<{ success: boolean; logs: AuditLog[] }>('/audit-logs'),

  // Settings
  getSettings: () => request<{ success: boolean; settings: Record<string, string> }>('/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request<{ success: boolean; settings: Record<string, string> }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    })
};
