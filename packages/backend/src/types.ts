export type DevicePlatform = "windows" | "android" | "macos";

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  platform: DevicePlatform;
}

export interface DeviceTokenRecord extends DeviceInfo {
  token: string;
  enabled: number;
  revoked_at: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export type EnrollmentRequestStatus = "pending" | "approved" | "rejected";

export interface EnrollmentRequestRecord extends DeviceInfo {
  id: number;
  request_key: string;
  status: EnrollmentRequestStatus;
  admin_note: string;
  client_version: string;
  os_version: string;
  hostname: string;
  username: string;
  client_ip: string;
  user_agent: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  approved_at: string;
  rejected_at: string;
}

export interface AdminDeviceRecord extends DeviceInfo {
  token: string;
  source: "env" | "db";
  enabled: number;
  revoked_at: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  is_online: number;
}

export interface ReportPayload {
  app_id: string;
  window_title?: string;
  timestamp?: string;
  extra?: {
    battery_percent?: number;
    battery_charging?: boolean;
  };
}

export interface ActivityRecord {
  id: number;
  device_id: string;
  device_name: string;
  platform: string;
  app_id: string;
  app_name: string;
  window_title: string;
  display_title: string;
  started_at: string;
  created_at: string;
}

export interface DeviceState {
  device_id: string;
  device_name: string;
  platform: string;
  app_id: string;
  app_name: string;
  window_title: string;
  display_title: string;
  last_seen_at: string;
  is_online: number;
  extra: string; // JSON string
}

export interface TimelineSegment {
  app_name: string;
  app_id: string;
  display_title: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  device_id: string;
  device_name: string;
}

export interface HealthRecord {
  device_id: string;
  type: string;
  value: number;
  unit: string;
  recorded_at: string;
  end_time: string;
}
