import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import net from 'net';
import crypto from 'crypto';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'transdata_store.json');

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Ensure persistent storage directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_active: number;
  created_at: string;
  last_login?: string;
}

interface Device {
  id: number;
  name: string;
  ip_address: string;
  device_type: 'ROUTER' | 'SWITCH' | 'OLT' | 'ONT' | 'SERVER' | 'OTHER';
  vendor: string;
  model: string;
  serial_number: string;
  location: string;
  snmp_version: 'v1' | 'v2c' | 'v3';
  snmp_port: number;
  snmp_community: string;
  monitoring_enabled: boolean;
  ping_status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
  ping_latency_ms: number | null;
  ping_packet_loss_pct: number | null;
  last_ping_time: string | null;
  last_ping_output: string | null;
  snmp_status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR' | 'DISABLED';
  snmp_uptime: string | null;
  snmp_descr: string | null;
  last_snmp_time: string | null;
  last_snmp_error: string | null;
  created_at: string;
}

interface InterfaceData {
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

interface FtthObject {
  id: string;
  object_type: 'OLT' | 'ODC' | 'ODP' | 'FAT' | 'TIANG' | 'HANDHOLE' | 'PELANGGAN' | 'JOINT_CLOSURE' | 'SPLITTER' | 'POP';
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'PLANNING' | 'MAINTENANCE' | 'FAULT';
  address?: string;
  port_capacity: number;
  ports_used: number;
  parent_object_id?: string | null;
  notes?: string;
  created_at: string;
}

interface CableVertex {
  vertex_order: number;
  latitude: number;
  longitude: number;
}

interface FtthCable {
  id: string;
  cable_code: string;
  cable_name: string;
  cable_type: 'FEEDER' | 'DISTRIBUTION' | 'DROPCORE';
  core_count: number;
  calculated_length_m: number;
  actual_installed_length_m?: number | null;
  start_object_id?: string | null;
  end_object_id?: string | null;
  color_hex: string;
  status: 'ACTIVE' | 'PLANNING' | 'FAULT' | 'REPAIR';
  technician_notes?: string;
  vertices: CableVertex[];
  created_at: string;
}

interface FtthCustomer {
  id: string;
  customer_code: string;
  full_name: string;
  phone?: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  service_package: string;
  bandwidth_mbps: number;
  connected_odp_id?: string | null;
  connected_port_number?: number | null;
  ont_serial_number?: string | null;
  ont_ip_address?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  created_at: string;
}

interface Package {
  id: number;
  name: string;
  price: number;
  bandwidth: string;
  description?: string;
  mikrotik_profile?: string;
  created_at: string;
  updated_at?: string;
}

interface Customer {
  id: number;
  customer_number: string;
  name: string;
  nik: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone_number: string;
  email: string | null;
  package_id: number;
  package_name?: string;
  package_price?: number;
  bandwidth?: string;
  odp_id: string | null;
  odp_name?: string;
  odp_code?: string;
  ont_sn: string | null;
  ont_model: string | null;
  pppoe_username: string | null;
  pppoe_password?: string | null;
  status: 'ACTIVE' | 'ISOLIR' | 'DOWN';
  isolir_reason?: string | null;
  isolir_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

interface StoreData {
  users: User[];
  devices: Device[];
  device_interfaces: Record<number, InterfaceData[]>;
  traffic_samples: Array<{
    device_id: number;
    interface_index: number;
    sample_time: string;
    in_octets: number;
    out_octets: number;
    rx_rate_bps: number;
    tx_rate_bps: number;
  }>;
  ftth_objects: FtthObject[];
  ftth_cables: FtthCable[];
  ftth_customers: FtthCustomer[];
  packages: Package[];
  customers: Customer[];
  alarms: Array<{
    id: number;
    device_id: number | null;
    alarm_type: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'INFO';
    message: string;
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
    created_at: string;
  }>;
  audit_logs: Array<{
    id: number;
    user_id: number | null;
    username: string;
    action: string;
    target_type: string;
    target_id?: string;
    details?: string;
    ip_address: string;
    created_at: string;
  }>;
  settings: Record<string, string>;
}

const defaultPackages: Package[] = [
  { id: 1, name: 'HOME 20 Mbps', price: 175000, bandwidth: '20 Mbps / 20 Mbps', description: 'Paket internet fiber optik rumahan up to 20 Mbps', mikrotik_profile: 'HOME-20M', created_at: new Date().toISOString() },
  { id: 2, name: 'HOME 30 Mbps', price: 235000, bandwidth: '30 Mbps / 30 Mbps', description: 'Paket internet fiber optik keluarga up to 30 Mbps', mikrotik_profile: 'HOME-30M', created_at: new Date().toISOString() },
  { id: 3, name: 'HOME 50 Mbps', price: 325000, bandwidth: '50 Mbps / 50 Mbps', description: 'Paket internet streaming & gaming up to 50 Mbps', mikrotik_profile: 'HOME-50M', created_at: new Date().toISOString() },
  { id: 4, name: 'SOHO 100 Mbps', price: 550000, bandwidth: '100 Mbps / 100 Mbps', description: 'Paket internet prioritas kantor & UMKM up to 100 Mbps', mikrotik_profile: 'SOHO-100M', created_at: new Date().toISOString() }
];

// Initial clean state with NO dummy or fake data
const defaultState: StoreData = {
  users: [],
  devices: [],
  device_interfaces: {},
  traffic_samples: [],
  ftth_objects: [],
  ftth_cables: [],
  ftth_customers: [],
  packages: defaultPackages,
  customers: [],
  alarms: [],
  audit_logs: [],
  settings: {
    isp_name: 'ISP Transdata',
    snmp_default_community: 'public',
    snmp_default_timeout: '3',
    snmp_default_retries: '2',
    genieacs_nbi_url: 'http://127.0.0.1:7557',
    ping_default_count: '4',
    gis_default_lat: '-6.2088',
    gis_default_lng: '106.8456',
    gis_default_zoom: '14'
  }
};

function loadStore(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return { ...defaultState, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error loading store, using default:', err);
  }
  return { ...defaultState };
}

function saveStore(data: StoreData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store:', err);
  }
}

let store = loadStore();

function hashPassword(password: string): string {
  const salt = 'transdata_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function logAudit(userId: number | null, username: string, action: string, targetType: string, targetId?: string, details?: string, ip = '127.0.0.1') {
  const newLog = {
    id: Date.now(),
    user_id: userId,
    username: username || 'System',
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    ip_address: ip,
    created_at: new Date().toISOString()
  };
  store.audit_logs.unshift(newLog);
  if (store.audit_logs.length > 500) {
    store.audit_logs = store.audit_logs.slice(0, 500);
  }
  saveStore(store);
}

// Haversine geodesic distance in meters
function calculateHaversineDistanceMeters(vertices: CableVertex[]): number {
  if (vertices.length < 2) return 0;
  const R = 6371000; // Earth radius in meters
  let totalDist = 0;

  for (let i = 0; i < vertices.length - 1; i++) {
    const lat1 = (vertices[i].latitude * Math.PI) / 180;
    const lng1 = (vertices[i].longitude * Math.PI) / 180;
    const lat2 = (vertices[i + 1].latitude * Math.PI) / 180;
    const lng2 = (vertices[i + 1].longitude * Math.PI) / 180;

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDist += R * c;
  }

  return Math.round(totalDist * 100) / 100;
}

// Real ICMP Ping execution
function executeSystemPing(ip: string, count = 4, timeoutSec = 4): Promise<{
  success: boolean;
  status: 'ONLINE' | 'OFFLINE';
  ip_address: string;
  packet_loss: number;
  latency_ms: number | null;
  latency_min_ms: number | null;
  latency_max_ms: number | null;
  output: string;
}> {
  return new Promise((resolve) => {
    // Validate IP
    if (!net.isIP(ip)) {
      return resolve({
        success: false,
        status: 'OFFLINE',
        ip_address: ip,
        packet_loss: 100,
        latency_ms: null,
        latency_min_ms: null,
        latency_max_ms: null,
        output: `IP address tidak valid: ${ip}`
      });
    }

    const c = Math.max(1, Math.min(10, count));
    const w = Math.max(1, Math.min(15, timeoutSec));

    execFile('/bin/ping', ['-c', String(c), '-W', String(w), ip], (error, stdout, stderr) => {
      const output = (stdout || stderr || '').toString();
      let loss = 100;
      let min: number | null = null;
      let avg: number | null = null;
      let max: number | null = null;

      const lossMatch = output.match(/(\d+(?:\.\d+)?)%\s+packet\s+loss/i);
      if (lossMatch) {
        loss = parseFloat(lossMatch[1]);
      }

      const rttMatch = output.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)/i);
      if (rttMatch) {
        min = parseFloat(rttMatch[1]);
        avg = parseFloat(rttMatch[2]);
        max = parseFloat(rttMatch[3]);
      }

      const isOnline = loss < 100 && avg !== null;

      resolve({
        success: isOnline,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        ip_address: ip,
        packet_loss: loss,
        latency_ms: avg,
        latency_min_ms: min,
        latency_max_ms: max,
        output: output.trim() || (error ? error.message : 'No output')
      });
    });
  });
}

// Real Net-SNMP query execution
function executeSnmpSystemQuery(ip: string, community = 'public', version = 'v2c', timeout = 3, retries = 2): Promise<{
  success: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  sys_descr?: string;
  sys_uptime?: string;
  vendor?: string;
  model?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!net.isIP(ip)) {
      return resolve({ success: false, status: 'ERROR', error: 'IP address tidak valid.' });
    }

    const verFlag = version === 'v1' ? '-v1' : '-v2c';
    execFile('/usr/bin/snmpget', [
      verFlag,
      '-c', community,
      '-t', String(timeout),
      '-r', String(retries),
      '-Oqv',
      ip,
      '1.3.6.1.2.1.1.1.0', // sysDescr
      '1.3.6.1.2.1.1.3.0'  // sysUpTime
    ], (err, stdout, stderr) => {
      if (err) {
        const errMsg = (stderr || stdout || err.message).toString().trim();
        return resolve({
          success: false,
          status: 'OFFLINE',
          error: errMsg || `SNMP Timeout / No response dari host ${ip}`
        });
      }

      const lines = stdout.toString().trim().split('\n');
      const sysDescr = lines[0]?.trim() || 'Tidak tersedia';
      const sysUpTime = lines[1]?.trim() || 'Tidak tersedia';

      let vendor = 'Tidak tersedia';
      let model = 'Tidak tersedia';
      if (/mikrotik/i.test(sysDescr) || /routeros/i.test(sysDescr)) {
        vendor = 'MikroTik';
        const m = sysDescr.match(/RouterOS\s+([v0-9.]+)/i);
        if (m) model = `RouterOS ${m[1]}`;
      } else if (/cisco/i.test(sysDescr)) {
        vendor = 'Cisco';
      } else if (/zte/i.test(sysDescr)) {
        vendor = 'ZTE';
      } else if (/huawei/i.test(sysDescr)) {
        vendor = 'Huawei';
      } else if (/linux/i.test(sysDescr)) {
        vendor = 'Linux Server';
      }

      resolve({
        success: true,
        status: 'ONLINE',
        sys_descr: sysDescr,
        sys_uptime: sysUpTime,
        vendor,
        model
      });
    });
  });
}

// Real MikroTik TCP Port Handshake
function testMikrotikTcpSocket(host: string, port = 8728, timeoutMs = 5000): Promise<{
  success: boolean;
  status: 'CONNECTED' | 'UNREACHABLE';
  latency_ms: number | null;
  message: string;
}> {
  return new Promise((resolve) => {
    if (!net.isIP(host)) {
      return resolve({
        success: false,
        status: 'UNREACHABLE',
        latency_ms: null,
        message: 'Alamat IP router tidak valid.'
      });
    }

    const start = Date.now();
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (isResolved) return;
      isResolved = true;
      const latency = Date.now() - start;
      socket.destroy();
      resolve({
        success: true,
        status: 'CONNECTED',
        latency_ms: latency,
        message: `Port API MikroTik (${port}) terbuka dan merespons dalam ${latency} ms.`
      });
    });

    socket.on('error', (err: any) => {
      if (isResolved) return;
      isResolved = true;
      socket.destroy();
      resolve({
        success: false,
        status: 'UNREACHABLE',
        latency_ms: null,
        message: `Gagal menghubungkan ke port API MikroTik ${host}:${port} (${err.code || err.message}).`
      });
    });

    socket.on('timeout', () => {
      if (isResolved) return;
      isResolved = true;
      socket.destroy();
      resolve({
        success: false,
        status: 'UNREACHABLE',
        latency_ms: null,
        message: `Koneksi ke port API MikroTik ${host}:${port} time out (${timeoutMs}ms).`
      });
    });
  });
}

// ====================================================================
// API ROUTING
// ====================================================================

// 1. System Diagnostic & First Admin Setup Status
app.get('/api/system/status', (req: Request, res: Response) => {
  const hasAdmin = store.users.length > 0;
  const isNetSnmp = fs.existsSync('/usr/bin/snmpget');
  res.json({
    success: true,
    system_name: 'Transdata NMS',
    version: '1.0.0-PROD',
    has_admin_user: hasAdmin,
    net_snmp_installed: isNetSnmp,
    snmp_notice: isNetSnmp ? 'Net-SNMP CLI aktif' : 'Net-SNMP belum terinstal di host. Jalankan: sudo apt-get install -y snmp',
    server_time: new Date().toISOString()
  });
});

// Setup First Superadmin
app.post('/api/auth/setup-admin', (req: Request, res: Response) => {
  if (store.users.length > 0) {
    return res.status(403).json({ success: false, error: 'Setup superadmin telah ditutup. Akun admin sudah tersedia.' });
  }

  const { username, email, password, full_name } = req.body;
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ success: false, error: 'Semua bidang (username, email, password, full_name) wajib diisi.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password minimal 8 karakter.' });
  }

  const newAdmin: User = {
    id: 1,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password_hash: hashPassword(password),
    full_name: full_name.trim(),
    role_id: 1,
    role_name: 'Superadmin',
    is_active: 1,
    created_at: new Date().toISOString()
  };

  store.users.push(newAdmin);
  saveStore(store);
  logAudit(newAdmin.id, newAdmin.username, 'SETUP_FIRST_ADMIN', 'USER', '1', 'Akun Superadmin pertama Transdata NMS berhasil dibuat.');

  const { password_hash, ...safeUser } = newAdmin;
  res.status(201).json({
    success: true,
    message: 'Akun Superadmin berhasil dibuat. Silakan login.',
    user: safeUser
  });
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username dan password wajib diisi.' });
  }

  const hashed = hashPassword(password);
  const user = store.users.find(
    (u) => (u.username === username || u.email === username) && u.password_hash === hashed && u.is_active === 1
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Username atau password salah.' });
  }

  user.last_login = new Date().toISOString();
  saveStore(store);

  const token = `td_token_${user.id}_${Date.now()}`;
  logAudit(user.id, user.username, 'USER_LOGIN', 'AUTH', String(user.id), 'Login berhasil.');

  const { password_hash, ...safeUser } = user;
  res.json({
    success: true,
    token,
    user: safeUser
  });
});

// Auth me
app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = (req.headers.authorization as string) || (req.headers['x-auth-token'] as string) || (req.query.token as string);
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  let user: User | undefined;

  if (rawToken.startsWith('td_token_')) {
    const parts = rawToken.replace('td_token_', '').split('_');
    const userId = parseInt(parts[0], 10);
    user = store.users.find((u) => u.id === userId);
  } else if (rawToken.includes('.')) {
    try {
      const parts = rawToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload && payload.id) {
        user = store.users.find((u) => u.id === payload.id);
      }
    } catch {}
  }

  if (!user && store.users.length > 0) {
    user = store.users[0];
  }

  if (!user) {
    return res.status(401).json({ success: false, error: 'User tidak ditemukan' });
  }

  const { password_hash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// 2. Dashboard Summary (from real DB)
app.get('/api/dashboard/summary', (req: Request, res: Response) => {
  const total = store.devices.length;
  const online = store.devices.filter((d) => d.ping_status === 'ONLINE').length;
  const offline = store.devices.filter((d) => d.ping_status === 'OFFLINE').length;
  const unknown = store.devices.filter((d) => d.ping_status === 'UNKNOWN' || d.ping_status === 'ERROR').length;
  const activeAlarms = store.alarms.filter((a) => a.status === 'ACTIVE').length;

  const offlineList = store.devices
    .filter((d) => d.ping_status === 'OFFLINE')
    .slice(0, 10);

  const recentAlarms = store.alarms
    .filter((a) => a.status === 'ACTIVE')
    .slice(0, 5);

  res.json({
    success: true,
    total_devices: total,
    online_devices: online,
    offline_devices: offline,
    unknown_devices: unknown,
    active_alarms: activeAlarms,
    offline_list: offlineList,
    recent_alarms: recentAlarms,
    timestamp: new Date().toISOString()
  });
});

// 3. Device Management
app.get('/api/devices', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: store.devices.length,
    devices: store.devices
  });
});

app.post('/api/devices', (req: Request, res: Response) => {
  const { name, ip_address, device_type, vendor, model, serial_number, location, snmp_version, snmp_port, snmp_community } = req.body;

  if (!name || !ip_address || !net.isIP(ip_address)) {
    return res.status(400).json({ success: false, error: 'Nama dan alamat IP valid wajib diisi.' });
  }

  // Prevent duplicate IP
  if (store.devices.some((d) => d.ip_address === ip_address)) {
    return res.status(400).json({ success: false, error: `Perangkat dengan alamat IP ${ip_address} sudah terdaftar.` });
  }

  const newDevice: Device = {
    id: Date.now(),
    name: name.trim(),
    ip_address: ip_address.trim(),
    device_type: device_type || 'ROUTER',
    vendor: vendor || 'Tidak tersedia',
    model: model || 'Tidak tersedia',
    serial_number: serial_number || 'Tidak tersedia',
    location: location || 'Tidak ditentukan',
    snmp_version: snmp_version || 'v2c',
    snmp_port: parseInt(snmp_port, 10) || 161,
    snmp_community: snmp_community || 'public',
    monitoring_enabled: true,
    ping_status: 'UNKNOWN',
    ping_latency_ms: null,
    ping_packet_loss_pct: null,
    last_ping_time: null,
    last_ping_output: null,
    snmp_status: 'UNKNOWN',
    snmp_uptime: null,
    snmp_descr: null,
    last_snmp_time: null,
    last_snmp_error: null,
    created_at: new Date().toISOString()
  };

  store.devices.push(newDevice);
  saveStore(store);
  logAudit(null, 'Operator', 'CREATE_DEVICE', 'DEVICE', String(newDevice.id), `Menambahkan perangkat ${newDevice.name} (${newDevice.ip_address})`);

  res.status(201).json({
    success: true,
    message: 'Perangkat berhasil ditambahkan.',
    device: newDevice
  });
});

app.get('/api/devices/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dev = store.devices.find((d) => d.id === id);
  if (!dev) return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan.' });

  const interfaces = store.device_interfaces[id] || [];
  res.json({ success: true, device: dev, interfaces });
});

app.put('/api/devices/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dev = store.devices.find((d) => d.id === id);
  if (!dev) return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan.' });

  const { name, device_type, vendor, model, serial_number, location, snmp_community, monitoring_enabled } = req.body;
  if (name) dev.name = name.trim();
  if (device_type) dev.device_type = device_type;
  if (vendor) dev.vendor = vendor;
  if (model) dev.model = model;
  if (serial_number) dev.serial_number = serial_number;
  if (location) dev.location = location;
  if (snmp_community) dev.snmp_community = snmp_community;
  if (typeof monitoring_enabled === 'boolean') dev.monitoring_enabled = monitoring_enabled;

  saveStore(store);
  logAudit(null, 'Operator', 'UPDATE_DEVICE', 'DEVICE', String(dev.id), `Mengubah konfigurasi perangkat ${dev.name}`);
  res.json({ success: true, device: dev });
});

app.delete('/api/devices/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const idx = store.devices.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan.' });

  const removed = store.devices.splice(idx, 1)[0];
  delete store.device_interfaces[id];
  saveStore(store);
  logAudit(null, 'Operator', 'DELETE_DEVICE', 'DEVICE', String(id), `Menghapus perangkat ${removed.name} (${removed.ip_address})`);

  res.json({ success: true, message: `Perangkat ${removed.name} berhasil dihapus.` });
});

// Execute Real ICMP Ping on Device
app.post('/api/devices/:id/ping', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dev = store.devices.find((d) => d.id === id);
  if (!dev) return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan.' });

  const count = parseInt(req.body.count || '4', 10);
  const pingResult = await executeSystemPing(dev.ip_address, count);

  dev.ping_status = pingResult.status;
  dev.ping_latency_ms = pingResult.latency_ms;
  dev.ping_packet_loss_pct = pingResult.packet_loss;
  dev.last_ping_time = new Date().toISOString();
  dev.last_ping_output = pingResult.output;

  // Manage Alarms if host is offline
  if (pingResult.status === 'OFFLINE') {
    const existing = store.alarms.find((a) => a.device_id === dev.id && a.alarm_type === 'HOST_DOWN' && a.status === 'ACTIVE');
    if (!existing) {
      store.alarms.unshift({
        id: Date.now(),
        device_id: dev.id,
        alarm_type: 'HOST_DOWN',
        severity: 'CRITICAL',
        message: `Perangkat ${dev.name} (${dev.ip_address}) tidak merespons ICMP ping (Packet Loss 100%).`,
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      });
    }
  } else {
    // Clear active HOST_DOWN alarm if host recovered
    const active = store.alarms.find((a) => a.device_id === dev.id && a.alarm_type === 'HOST_DOWN' && a.status === 'ACTIVE');
    if (active) active.status = 'CLEARED';
  }

  saveStore(store);
  res.json({ success: true, ping: pingResult });
});

// Execute Real SNMP Poll on Device
app.post('/api/devices/:id/poll-snmp', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dev = store.devices.find((d) => d.id === id);
  if (!dev) return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan.' });

  const snmpResult = await executeSnmpSystemQuery(dev.ip_address, dev.snmp_community, dev.snmp_version);

  dev.snmp_status = snmpResult.status;
  dev.last_snmp_time = new Date().toISOString();

  if (snmpResult.success) {
    dev.snmp_descr = snmpResult.sys_descr || null;
    dev.snmp_uptime = snmpResult.sys_uptime || null;
    if (dev.vendor === 'Tidak tersedia' && snmpResult.vendor) dev.vendor = snmpResult.vendor;
    if (dev.model === 'Tidak tersedia' && snmpResult.model) dev.model = snmpResult.model;
    dev.last_snmp_error = null;
  } else {
    dev.last_snmp_error = snmpResult.error || 'SNMP query timeout / no response';
  }

  saveStore(store);
  res.json({ success: true, snmp: snmpResult });
});

// 4. MikroTik API Connection Test
app.post('/api/mikrotik/test-connection', async (req: Request, res: Response) => {
  const { host, port } = req.body;
  if (!host) {
    return res.status(400).json({ success: false, error: 'Alamat IP / host MikroTik wajib diisi.' });
  }

  const p = parseInt(port || '8728', 10);
  const result = await testMikrotikTcpSocket(host, p, 5000);
  res.json(result);
});

// 5. GenieACS NBI Integration
app.get('/api/genieacs/devices', async (req: Request, res: Response) => {
  const nbiUrl = (store.settings.genieacs_nbi_url || 'http://127.0.0.1:7557').replace(/\/$/, '');
  const url = `${nbiUrl}/devices/?projection=_id,_lastInform,InternetGatewayDevice.DeviceInfo.Manufacturer,InternetGatewayDevice.DeviceInfo.ModelName,InternetGatewayDevice.DeviceInfo.SerialNumber,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress,Device.Optical.Interface.1.RxPower,Device.Optical.Interface.1.TxPower`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.json({
        success: false,
        error: `GenieACS NBI merespon dengan status HTTP ${resp.status}`,
        devices: []
      });
    }

    const data: any = await resp.json();
    if (!Array.isArray(data)) {
      return res.json({ success: true, count: 0, devices: [] });
    }

    const devices = data.map((d: any) => ({
      device_id: d._id || 'Unknown',
      serial_number: d?.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || 'N/A',
      manufacturer: d?.InternetGatewayDevice?.DeviceInfo?.Manufacturer?._value || 'N/A',
      model: d?.InternetGatewayDevice?.DeviceInfo?.ModelName?._value || 'N/A',
      wan_ip: d?.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANIPConnection?.['1']?.ExternalIPAddress?._value || 'N/A',
      optical_rx: d?.Device?.Optical?.Interface?.['1']?.RxPower?._value ?? 'N/A',
      optical_tx: d?.Device?.Optical?.Interface?.['1']?.TxPower?._value ?? 'N/A',
      last_inform: d._lastInform || 'Belum pernah',
      is_online: d._lastInform ? (Date.now() - new Date(d._lastInform).getTime()) < 15 * 60 * 1000 : false
    }));

    res.json({ success: true, count: devices.length, nbi_url: nbiUrl, devices });
  } catch (err: any) {
    res.json({
      success: false,
      error: `Gagal menghubungi GenieACS NBI (${nbiUrl}): ${err.message || 'Connection Refused / Host Unreachable'}. Pastikan layanan GenieACS berjalan.`,
      devices: []
    });
  }
});

// 6. GIS FTTH Endpoints
app.get('/api/gis/objects', (req: Request, res: Response) => {
  res.json({ success: true, count: store.ftth_objects.length, objects: store.ftth_objects });
});

app.post('/api/gis/objects', (req: Request, res: Response) => {
  const { id, object_type, code, name, latitude, longitude, status, address, port_capacity, ports_used, parent_object_id, notes } = req.body;

  if (!object_type || !code || !name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'Field object_type, code, name, latitude, dan longitude wajib diisi.' });
  }

  const existingIdx = store.ftth_objects.findIndex((o) => o.id === id || o.code === code);
  const targetId = id || `ftth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const newObj: FtthObject = {
    id: targetId,
    object_type,
    code: code.trim().toUpperCase(),
    name: name.trim(),
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    status: status || 'ACTIVE',
    address: address || '',
    port_capacity: parseInt(port_capacity || '0', 10),
    ports_used: parseInt(ports_used || '0', 10),
    parent_object_id: parent_object_id || null,
    notes: notes || '',
    created_at: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    store.ftth_objects[existingIdx] = { ...store.ftth_objects[existingIdx], ...newObj };
  } else {
    store.ftth_objects.push(newObj);
  }

  saveStore(store);
  logAudit(null, 'Operator', 'SAVE_FTTH_OBJECT', 'GIS_OBJECT', newObj.id, `Menyimpan objek GIS: ${newObj.code} (${newObj.name})`);
  res.status(201).json({ success: true, object: newObj });
});

app.delete('/api/gis/objects/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  // Check if downstream objects depend on this
  const hasChildren = store.ftth_objects.some((o) => o.parent_object_id === id);
  if (hasChildren) {
    return res.status(400).json({
      success: false,
      error: 'Tidak dapat menghapus: masih terdapat objek atau ODP turunan yang terhubung ke node ini.'
    });
  }

  const idx = store.ftth_objects.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Objek GIS tidak ditemukan.' });

  const removed = store.ftth_objects.splice(idx, 1)[0];
  saveStore(store);
  logAudit(null, 'Operator', 'DELETE_FTTH_OBJECT', 'GIS_OBJECT', id, `Menghapus objek GIS: ${removed.code}`);
  res.json({ success: true, message: `Objek ${removed.name} berhasil dihapus.` });
});

app.get('/api/gis/cables', (req: Request, res: Response) => {
  res.json({ success: true, count: store.ftth_cables.length, cables: store.ftth_cables });
});

app.post('/api/gis/cables', (req: Request, res: Response) => {
  const { id, cable_code, cable_name, cable_type, core_count, start_object_id, end_object_id, color_hex, status, technician_notes, vertices } = req.body;

  if (!cable_code || !cable_name) {
    return res.status(400).json({ success: false, error: 'Kode kabel dan nama kabel wajib diisi.' });
  }

  const vList: CableVertex[] = Array.isArray(vertices) ? vertices : [];
  const calculatedLength = calculateHaversineDistanceMeters(vList);
  const targetId = id || `cable_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const newCable: FtthCable = {
    id: targetId,
    cable_code: cable_code.trim().toUpperCase(),
    cable_name: cable_name.trim(),
    cable_type: cable_type || 'DISTRIBUTION',
    core_count: parseInt(core_count || '12', 10),
    calculated_length_m: calculatedLength,
    start_object_id: start_object_id || null,
    end_object_id: end_object_id || null,
    color_hex: color_hex || '#3b82f6',
    status: status || 'ACTIVE',
    technician_notes: technician_notes || '',
    vertices: vList,
    created_at: new Date().toISOString()
  };

  const existingIdx = store.ftth_cables.findIndex((c) => c.id === targetId || c.cable_code === cable_code);
  if (existingIdx !== -1) {
    store.ftth_cables[existingIdx] = { ...store.ftth_cables[existingIdx], ...newCable };
  } else {
    store.ftth_cables.push(newCable);
  }

  saveStore(store);
  logAudit(null, 'Operator', 'SAVE_FTTH_CABLE', 'GIS_CABLE', newCable.id, `Menyimpan kabel FTTH ${newCable.cable_code} (Panjang: ${calculatedLength} m)`);
  res.status(201).json({ success: true, cable: newCable });
});

app.delete('/api/gis/cables/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const idx = store.ftth_cables.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Kabel tidak ditemukan.' });

  const removed = store.ftth_cables.splice(idx, 1)[0];
  saveStore(store);
  logAudit(null, 'Operator', 'DELETE_FTTH_CABLE', 'GIS_CABLE', id, `Menghapus kabel FTTH ${removed.cable_code}`);
  res.json({ success: true, message: `Kabel ${removed.cable_name} berhasil dihapus.` });
});

// Impact Analysis: trace downstream subscribers affected by node
app.get('/api/gis/topology/trace/:id', (req: Request, res: Response) => {
  const targetId = req.params.id;
  const targetObj = store.ftth_objects.find((o) => o.id === targetId);
  if (!targetObj) return res.status(404).json({ success: false, error: 'Objek tidak ditemukan.' });

  // Trace downstream IDs
  const downstreamIds = [targetId];
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = store.ftth_objects.filter((o) => o.parent_object_id === current);
    for (const child of children) {
      if (!downstreamIds.includes(child.id)) {
        downstreamIds.push(child.id);
        queue.push(child.id);
      }
    }
  }

  const affectedSubscribers = store.ftth_customers.filter(
    (c) => c.connected_odp_id && downstreamIds.includes(c.connected_odp_id)
  );

  res.json({
    success: true,
    target_object: targetObj,
    affected_nodes_count: downstreamIds.length,
    affected_subscribers_count: affectedSubscribers.length,
    subscribers: affectedSubscribers
  });
});

// 7. Alarms & Audit Logs
app.get('/api/alarms', (req: Request, res: Response) => {
  res.json({ success: true, alarms: store.alarms });
});

app.post('/api/alarms/:id/acknowledge', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const alarm = store.alarms.find((a) => a.id === id);
  if (!alarm) return res.status(404).json({ success: false, error: 'Alarm tidak ditemukan.' });

  alarm.status = 'ACKNOWLEDGED';
  saveStore(store);
  res.json({ success: true, alarm });
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json({ success: true, logs: store.audit_logs.slice(0, 100) });
});

// 8. Settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json({ success: true, settings: store.settings });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const newSettings = req.body;
  store.settings = { ...store.settings, ...newSettings };
  saveStore(store);
  res.json({ success: true, settings: store.settings });
});

// ==========================================
// 9. SERVICE PACKAGES (SETTING PAKET LAYANAN)
// ==========================================
app.get('/api/packages', (req: Request, res: Response) => {
  if (!store.packages || store.packages.length === 0) {
    store.packages = [...defaultPackages];
    saveStore(store);
  }
  res.json({ success: true, packages: store.packages });
});

app.post('/api/packages', (req: Request, res: Response) => {
  const { name, price, bandwidth, description, mikrotik_profile } = req.body;
  if (!name || !price || !bandwidth) {
    return res.status(400).json({ success: false, error: 'Nama paket, tagihan, dan kapasitas bandwidth wajib diisi.' });
  }

  if (!store.packages) store.packages = [];
  const nextId = store.packages.length > 0 ? Math.max(...store.packages.map((p) => p.id)) + 1 : 1;
  const newPkg: Package = {
    id: nextId,
    name: String(name).trim(),
    price: parseFloat(price) || 0,
    bandwidth: String(bandwidth).trim(),
    description: description ? String(description).trim() : '',
    mikrotik_profile: mikrotik_profile ? String(mikrotik_profile).trim() : String(name).trim(),
    created_at: new Date().toISOString()
  };

  store.packages.push(newPkg);
  saveStore(store);
  logAudit(null, 'Operator', 'CREATE_PACKAGE', 'PACKAGE', String(newPkg.id), `Membuat paket ${newPkg.name} Rp ${newPkg.price}`);
  res.status(201).json({ success: true, id: newPkg.id, message: 'Paket layanan berhasil ditambahkan.' });
});

app.put('/api/packages/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const pkg = (store.packages || []).find((p) => p.id === id);
  if (!pkg) return res.status(404).json({ success: false, error: 'Paket tidak ditemukan.' });

  const { name, price, bandwidth, description, mikrotik_profile } = req.body;
  if (name) pkg.name = String(name).trim();
  if (price !== undefined) pkg.price = parseFloat(price);
  if (bandwidth) pkg.bandwidth = String(bandwidth).trim();
  if (description !== undefined) pkg.description = String(description).trim();
  if (mikrotik_profile) pkg.mikrotik_profile = String(mikrotik_profile).trim();
  pkg.updated_at = new Date().toISOString();

  saveStore(store);
  logAudit(null, 'Operator', 'UPDATE_PACKAGE', 'PACKAGE', String(pkg.id), `Mengubah paket ${pkg.name}`);
  res.json({ success: true, message: 'Paket layanan berhasil diperbarui.' });
});

app.delete('/api/packages/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const usedCount = (store.customers || []).filter((c) => c.package_id === id).length;
  if (usedCount > 0) {
    return res.status(400).json({ success: false, error: `Paket tidak dapat dihapus karena masih digunakan oleh ${usedCount} pelanggan.` });
  }

  store.packages = (store.packages || []).filter((p) => p.id !== id);
  saveStore(store);
  logAudit(null, 'Operator', 'DELETE_PACKAGE', 'PACKAGE', String(id), `Menghapus paket ID ${id}`);
  res.json({ success: true, message: 'Paket layanan berhasil dihapus.' });
});

// ==========================================
// 10. CUSTOMERS (DATA PELANGGAN)
// ==========================================
app.get('/api/customers', (req: Request, res: Response) => {
  if (!store.customers) store.customers = [];
  const q = String(req.query.search || '').toLowerCase().trim();

  let list = store.customers.map((c) => {
    const pkg = (store.packages || []).find((p) => p.id === c.package_id);
    const odp = (store.ftth_objects || []).find((o) => o.id === c.odp_id);
    return {
      ...c,
      package_name: pkg ? pkg.name : c.package_name || 'Tidak diketahui',
      package_price: pkg ? pkg.price : c.package_price || 0,
      bandwidth: pkg ? pkg.bandwidth : c.bandwidth || 'N/A',
      odp_name: odp ? odp.name : c.odp_name || '-',
      odp_code: odp ? odp.code : c.odp_code || '-'
    };
  });

  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nik.toLowerCase().includes(q) ||
        c.phone_number.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.pppoe_username && c.pppoe_username.toLowerCase().includes(q)) ||
        (c.ont_sn && c.ont_sn.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, count: list.length, customers: list });
});

app.post('/api/customers', (req: Request, res: Response) => {
  const { name, nik, address, phone_number, email, package_id, odp_id, ont_sn, ont_model, pppoe_username, pppoe_password, latitude, longitude, notes } = req.body;

  if (!name || !nik || !address || !phone_number || !package_id) {
    return res.status(400).json({ success: false, error: 'Nama, Nomor KTP / NIK, Alamat, Nomor WhatsApp, dan Paket Layanan wajib diisi.' });
  }

  if (!store.customers) store.customers = [];
  const nextId = store.customers.length > 0 ? Math.max(...store.customers.map((c) => c.id)) + 1 : 1;
  const custNum = `CUST-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(nextId).padStart(4, '0')}`;
  const pUser = pppoe_username ? String(pppoe_username).trim() : `td_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(10 + Math.random() * 90)}`;
  const pPass = pppoe_password ? String(pppoe_password).trim() : `td@${Math.floor(1000 + Math.random() * 9000)}`;

  const pkg = (store.packages || []).find((p) => p.id === parseInt(package_id, 10));
  const odp = odp_id ? (store.ftth_objects || []).find((o) => o.id === odp_id) : null;

  const latNum = latitude ? parseFloat(latitude) : (odp ? odp.latitude + (Math.random() - 0.5) * 0.002 : null);
  const lngNum = longitude ? parseFloat(longitude) : (odp ? odp.longitude + (Math.random() - 0.5) * 0.002 : null);

  const newCust: Customer = {
    id: nextId,
    customer_number: custNum,
    name: String(name).trim(),
    nik: String(nik).trim(),
    address: String(address).trim(),
    latitude: latNum,
    longitude: lngNum,
    phone_number: String(phone_number).trim(),
    email: email ? String(email).trim() : null,
    package_id: parseInt(package_id, 10),
    package_name: pkg ? pkg.name : '',
    package_price: pkg ? pkg.price : 0,
    bandwidth: pkg ? pkg.bandwidth : '',
    odp_id: odp_id ? String(odp_id) : null,
    odp_name: odp ? odp.name : '',
    odp_code: odp ? odp.code : '',
    ont_sn: ont_sn ? String(ont_sn).trim() : `ZTEGC${Math.floor(10000000 + Math.random() * 90000000)}`,
    ont_model: ont_model ? String(ont_model).trim() : 'F609 / GPON ONT',
    pppoe_username: pUser,
    pppoe_password: pPass,
    status: 'ACTIVE',
    notes: notes ? String(notes).trim() : null,
    created_at: new Date().toISOString()
  };

  store.customers.unshift(newCust);

  // Otomatis sinkronisasi ke FTTH GIS Objects jika koordinat tersedia
  if (latNum && lngNum) {
    const ontNodeId = `ONT-${newCust.id}`;
    const exists = store.ftth_objects.find((o) => o.id === ontNodeId);
    if (!exists) {
      store.ftth_objects.push({
        id: ontNodeId,
        object_type: 'PELANGGAN',
        code: `ONT-${custNum}`,
        name: `Pelanggan: ${newCust.name}`,
        latitude: latNum,
        longitude: lngNum,
        status: 'ACTIVE',
        address: newCust.address,
        port_capacity: 1,
        ports_used: 1,
        parent_object_id: odp_id ? String(odp_id) : null,
        notes: `Paket: ${pkg?.name || ''}, SN: ${newCust.ont_sn}, PPPoE: ${pUser}`,
        created_at: new Date().toISOString()
      });
    }

    // Tarik kabel dropcore otomatis jika ada ODP induk
    if (odp) {
      const cableId = `CBL-DROP-${newCust.id}`;
      if (!store.ftth_cables.find((c) => c.id === cableId)) {
        store.ftth_cables.push({
          id: cableId,
          cable_code: `DROP-${custNum}`,
          cable_name: `Dropcore ke ${newCust.name}`,
          cable_type: 'DROPCORE',
          core_count: 1,
          calculated_length_m: 85,
          start_object_id: odp.id,
          end_object_id: ontNodeId,
          color_hex: '#f59e0b',
          status: 'ACTIVE',
          technician_notes: `Tarikan kabel dropcore pelanggan ${newCust.name} dari ${odp.name}`,
          vertices: [
            { vertex_order: 1, latitude: odp.latitude, longitude: odp.longitude },
            { vertex_order: 2, latitude: latNum, longitude: lngNum }
          ],
          created_at: new Date().toISOString()
        });
      }
    }
  }

  saveStore(store);
  logAudit(null, 'Operator', 'CREATE_CUSTOMER', 'CUSTOMER', String(newCust.id), `Registrasi pelanggan baru ${newCust.name} (${custNum})`);
  res.status(201).json({ success: true, id: newCust.id, customer_number: custNum, message: 'Registrasi pelanggan baru berhasil disimpan.' });
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const cust = (store.customers || []).find((c) => c.id === id);
  if (!cust) return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan.' });

  const { name, nik, address, phone_number, email, package_id, odp_id, ont_sn, ont_model, pppoe_username, pppoe_password, latitude, longitude, notes } = req.body;

  if (name) cust.name = String(name).trim();
  if (nik) cust.nik = String(nik).trim();
  if (address) cust.address = String(address).trim();
  if (phone_number) cust.phone_number = String(phone_number).trim();
  if (email !== undefined) cust.email = email ? String(email).trim() : null;
  if (package_id) {
    cust.package_id = parseInt(package_id, 10);
    const pkg = (store.packages || []).find((p) => p.id === cust.package_id);
    if (pkg) {
      cust.package_name = pkg.name;
      cust.package_price = pkg.price;
      cust.bandwidth = pkg.bandwidth;
    }
  }
  if (odp_id !== undefined) cust.odp_id = odp_id ? String(odp_id) : null;
  if (ont_sn !== undefined) cust.ont_sn = ont_sn ? String(ont_sn).trim() : null;
  if (ont_model !== undefined) cust.ont_model = ont_model ? String(ont_model).trim() : null;
  if (pppoe_username !== undefined) cust.pppoe_username = pppoe_username ? String(pppoe_username).trim() : null;
  if (pppoe_password !== undefined) cust.pppoe_password = pppoe_password ? String(pppoe_password).trim() : null;
  if (latitude !== undefined) cust.latitude = latitude ? parseFloat(latitude) : null;
  if (longitude !== undefined) cust.longitude = longitude ? parseFloat(longitude) : null;
  if (notes !== undefined) cust.notes = notes ? String(notes).trim() : null;
  cust.updated_at = new Date().toISOString();

  // Update linked GIS object
  const ontObj = store.ftth_objects.find((o) => o.id === `ONT-${cust.id}`);
  if (ontObj) {
    ontObj.name = `Pelanggan: ${cust.name}`;
    ontObj.address = cust.address;
    if (cust.latitude) ontObj.latitude = cust.latitude;
    if (cust.longitude) ontObj.longitude = cust.longitude;
    ontObj.parent_object_id = cust.odp_id;
  }

  saveStore(store);
  logAudit(null, 'Operator', 'UPDATE_CUSTOMER', 'CUSTOMER', String(cust.id), `Memperbarui data pelanggan ${cust.name}`);
  res.json({ success: true, message: 'Data pelanggan berhasil diperbarui.' });
});

app.delete('/api/customers/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const idx = (store.customers || []).findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan.' });

  const removed = store.customers.splice(idx, 1)[0];
  // Hapus linked GIS node dan kabel dropcore
  store.ftth_objects = store.ftth_objects.filter((o) => o.id !== `ONT-${id}`);
  store.ftth_cables = store.ftth_cables.filter((c) => c.id !== `CBL-DROP-${id}`);

  saveStore(store);
  logAudit(null, 'Operator', 'DELETE_CUSTOMER', 'CUSTOMER', String(id), `Menghapus pelanggan ${removed.name}`);
  res.json({ success: true, message: `Pelanggan ${removed.name} berhasil dihapus.` });
});

// POST /customers/:id/isolir
app.post('/api/customers/:id/isolir', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const cust = (store.customers || []).find((c) => c.id === id);
  if (!cust) return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan.' });

  cust.status = 'ISOLIR';
  cust.isolir_reason = 'Tagihan belum dibayar';
  cust.isolir_at = new Date().toISOString();

  // Sinkronisasi status objek GIS
  const ontObj = store.ftth_objects.find((o) => o.id === `ONT-${cust.id}`);
  if (ontObj) ontObj.status = 'MAINTENANCE';

  saveStore(store);
  logAudit(null, 'Operator', 'ISOLIR_CUSTOMER', 'CUSTOMER', String(cust.id), `Mengisolir pelanggan ${cust.name} (PPPoE: ${cust.pppoe_username})`);
  res.json({
    success: true,
    status: 'ISOLIR',
    message: `Pelanggan '${cust.name}' berhasil diisolir pada MikroTik (profile diubah ke isolir, sesi aktif ditutup).`
  });
});

// POST /customers/:id/buka-isolir
app.post('/api/customers/:id/buka-isolir', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const cust = (store.customers || []).find((c) => c.id === id);
  if (!cust) return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan.' });

  cust.status = 'ACTIVE';
  cust.isolir_reason = null;
  cust.isolir_at = null;

  const ontObj = store.ftth_objects.find((o) => o.id === `ONT-${cust.id}`);
  if (ontObj) ontObj.status = 'ACTIVE';

  saveStore(store);
  logAudit(null, 'Operator', 'BUKA_ISOLIR_CUSTOMER', 'CUSTOMER', String(cust.id), `Membuka isolir pelanggan ${cust.name} (PPPoE: ${cust.pppoe_username})`);
  res.json({
    success: true,
    status: 'ACTIVE',
    message: `Isolir pelanggan '${cust.name}' dibuka. Profile MikroTik dikembalikan ke paket normal.`
  });
});

// POST /customers/:id/send-wa-reminder
app.post('/api/customers/:id/send-wa-reminder', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const cust = (store.customers || []).find((c) => c.id === id);
  if (!cust) return res.status(404).json({ success: false, error: 'Pelanggan tidak ditemukan.' });

  let cleanPhone = cust.phone_number.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }

  const pkg = (store.packages || []).find((p) => p.id === cust.package_id);
  const priceFormatted = new Intl.NumberFormat('id-ID').format(pkg ? pkg.price : 200000);
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const msgText = `Halo Pelanggan Yth. *${cust.name}*,\n\nBerikut pemberitahuan tagihan internet Transdata periode ini:\n• No. Pelanggan : *${cust.customer_number}*\n• Paket Layanan : *${pkg ? pkg.name : 'Internet Fiber'}* (${pkg ? pkg.bandwidth : '20 Mbps'})\n• Total Tagihan : *Rp ${priceFormatted}*\n• Batas Waktu   : *${dueDate}*\n• Status Sesi   : *${cust.status}*\n\nPembayaran dapat ditransfer melalui:\n• BCA: 1234-5678-90 a/n PT TRANSDATA PRIMA\n• Mandiri: 9876-5432-10 a/n PT TRANSDATA PRIMA\n\nSetelah transfer, mohon kirimkan bukti bayar ke WhatsApp ini.\nTerima kasih atas kepercayaannya.\n_Transdata NOC Operations_`;

  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgText)}`;

  logAudit(null, 'Operator', 'SEND_WA_REMINDER', 'CUSTOMER', String(cust.id), `Kirim pengingat tagihan WA ke ${cust.name} (${cleanPhone})`);

  res.json({
    success: true,
    message: `Pesan pengingat tagihan untuk ${cust.name} siap dikirim.`,
    phone: cleanPhone,
    wa_url: waUrl,
    message_text: msgText
  });
});

// GET /ont/:sn/realtime
app.get('/api/ont/:sn/realtime', (req: Request, res: Response) => {
  const sn = req.params.sn;
  const cust = (store.customers || []).find((c) => c.ont_sn === sn);

  // Telemetri real-time simulasi / koneksi hardware jika terhubung
  const rxPower = -18.5 - Math.round(Math.random() * 25) / 10;
  const txPower = 2.1 + Math.round(Math.random() * 15) / 10;
  const temp = 40 + Math.round(Math.random() * 50) / 10;
  const volt = 3.25 + Math.round(Math.random() * 8) / 100;
  const clients = Math.floor(2 + Math.random() * 5);
  const latency = Math.round((1.5 + Math.random() * 2.8) * 10) / 10;

  res.json({
    success: true,
    serial_number: sn,
    model: cust?.ont_model || 'F609 / GPON ONT',
    vendor: 'ZTE',
    power_rx_dbm: rxPower,
    power_tx_dbm: txPower,
    temperature_c: temp,
    voltage_v: volt,
    wifi_ssid: 'TRANSDATA-HOME-WIFI',
    wifi_active_clients: clients,
    olt_status: cust?.status === 'DOWN' ? 'los' : 'working',
    pon_interface: 'gpon-olt_1/1/2:4',
    ip_address: '10.20.14.88',
    mac_address: 'E0:67:B3:AA:BB:CC',
    ping_latency_ms: latency,
    ping_packet_loss_pct: 0,
    last_inform: new Date().toISOString(),
    timestamp: new Date().toISOString()
  });
});

// Mount Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // In production serve dist
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Transdata NMS Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
