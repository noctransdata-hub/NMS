export type FtthObjectType =
  | 'OLT'
  | 'ODC'
  | 'ODP'
  | 'FAT'
  | 'TIANG'
  | 'HANDHOLE'
  | 'PELANGGAN'
  | 'JOINT_CLOSURE'
  | 'SPLITTER'
  | 'POP';

export type FtthObjectStatus = 'ACTIVE' | 'PLANNING' | 'MAINTENANCE' | 'FAULT';
export type CableType = 'FEEDER' | 'DISTRIBUTION' | 'DROPCORE';

export interface FtthObject {
  id: string;
  object_type: FtthObjectType;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: FtthObjectStatus;
  address?: string;
  port_capacity: number;
  ports_used: number;
  parent_object_id?: string | null;
  notes?: string;
  created_at: string;
}

export interface CableVertex {
  vertex_order: number;
  latitude: number;
  longitude: number;
}

export interface FtthCable {
  id: string;
  cable_code: string;
  cable_name: string;
  cable_type: CableType;
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

export interface FtthCustomer {
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

export interface TopologyTraceResult {
  success: boolean;
  target_object: FtthObject;
  affected_nodes_count: number;
  affected_subscribers_count: number;
  subscribers: FtthCustomer[];
}
