export type DeviceType = 'ROUTER' | 'SWITCH' | 'OLT' | 'ONT' | 'SERVER' | 'OTHER';
export type PingStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
export type SnmpStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR' | 'DISABLED';
export type AlarmSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'INFO';
export type AlarmStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';

export interface SystemStatus {
  success: boolean;
  system_name: string;
  version: string;
  has_admin_user: boolean;
  net_snmp_installed: boolean;
  snmp_notice: string;
  server_time: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_active: number;
  created_at: string;
  last_login?: string;
}

export interface Device {
  id: number;
  name: string;
  ip_address: string;
  device_type: DeviceType;
  vendor: string;
  model: string;
  serial_number: string;
  location: string;
  snmp_version: 'v1' | 'v2c' | 'v3';
  snmp_port: number;
  snmp_community: string;
  monitoring_enabled: boolean;
  ping_status: PingStatus;
  ping_latency_ms: number | null;
  ping_packet_loss_pct: number | null;
  last_ping_time: string | null;
  last_ping_output: string | null;
  snmp_status: SnmpStatus;
  snmp_uptime: string | null;
  snmp_descr: string | null;
  last_snmp_time: string | null;
  last_snmp_error: string | null;
  created_at: string;
}

export interface DeviceInterface {
  if_index: number;
  if_name: string;
  if_descr: string;
  if_oper_status: string;
  is_monitored: boolean;
  last_in_octets: number | null;
  last_out_octets: number | null;
  last_sample_time: string | null;
  current_rx_rate_bps: number | null;
  current_tx_rate_bps: number | null;
}

export interface PingResult {
  success: boolean;
  status: 'ONLINE' | 'OFFLINE';
  ip_address: string;
  packet_loss: number;
  latency_ms: number | null;
  latency_min_ms: number | null;
  latency_max_ms: number | null;
  output: string;
}

export interface SnmpResult {
  success: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  sys_descr?: string;
  sys_uptime?: string;
  vendor?: string;
  model?: string;
  error?: string;
}

export interface GenieAcsDevice {
  device_id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  wan_ip: string;
  optical_rx: string;
  optical_tx: string;
  last_inform: string;
  is_online: boolean;
}

export interface Alarm {
  id: number;
  device_id: number | null;
  alarm_type: string;
  severity: AlarmSeverity;
  message: string;
  status: AlarmStatus;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: string;
  ip_address: string;
  created_at: string;
}

export interface DashboardSummary {
  success: boolean;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  unknown_devices: number;
  active_alarms: number;
  offline_list: Device[];
  recent_alarms: Alarm[];
  timestamp: string;
}
