const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export interface DeviceState {
  device_id: string;
  device_name: string;
  platform: string;
  app_id: string;
  app_name: string;
  display_title?: string;
  last_seen_at: string;
  is_online: number;
  extra?: {
    battery_percent?: number;
    battery_charging?: boolean;
    music?: {
      title?: string;
      artist?: string;
      app?: string;
    };
  };
}

export interface ActivityRecord {
  id: number;
  device_id: string;
  device_name: string;
  platform: string;
  app_id: string;
  app_name: string;
  display_title?: string;
  started_at: string;
}

export interface TimelineSegment {
  app_name: string;
  app_id: string;
  display_title?: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  device_id: string;
  device_name: string;
}

export interface CurrentResponse {
  devices: DeviceState[];
  recent_activities: ActivityRecord[];
  server_time: string;
  viewer_count: number;
}

export interface TimelineResponse {
  date: string;
  segments: TimelineSegment[];
  summary: Record<string, Record<string, number>>;
}

export async function fetchCurrent(signal?: AbortSignal): Promise<CurrentResponse> {
  const res = await fetch(`${API_BASE}/api/current`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTimeline(date: string, signal?: AbortSignal): Promise<TimelineResponse> {
  const tz = new Date().getTimezoneOffset(); // e.g. -480 for UTC+8
  const url = `${API_BASE}/api/timeline?date=${encodeURIComponent(date)}&tz=${tz}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Health data types
export interface HealthRecord {
  device_id: string;
  type: string;
  value: number;
  unit: string;
  recorded_at: string;
  end_time: string;
}

export interface HealthDataResponse {
  date: string;
  records: HealthRecord[];
}

export interface EnrollmentRequestRecord {
  id: number;
  request_key: string;
  device_id: string;
  device_name: string;
  platform: string;
  status: "pending" | "approved" | "rejected";
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

export interface AdminDeviceRecord {
  token: string;
  device_id: string;
  device_name: string;
  platform: string;
  source: "env" | "db";
  enabled: number;
  revoked_at: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  is_online: number;
}

// Site config
export interface SiteConfig {
  displayName: string;
  siteTitle: string;
  siteDescription: string;
  siteFavicon: string;
}

const defaultConfig: SiteConfig = {
  displayName: "Monika",
  siteTitle: "Monika Now",
  siteDescription: "What is Monika doing right now?",
  siteFavicon: "/favicon.ico",
};

export { defaultConfig };

function isValidFaviconUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchConfig(signal?: AbortSignal): Promise<SiteConfig> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  if (signal?.aborted) { clearTimeout(timeout); return defaultConfig; }
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(`${API_BASE}/api/config`, { signal: controller.signal });
    if (!res.ok) return defaultConfig;
    const data = await res.json();
    const favicon = typeof data.siteFavicon === "string" && isValidFaviconUrl(data.siteFavicon)
      ? data.siteFavicon : defaultConfig.siteFavicon;
    return {
      displayName: typeof data.displayName === "string" ? data.displayName : defaultConfig.displayName,
      siteTitle: typeof data.siteTitle === "string" ? data.siteTitle : defaultConfig.siteTitle,
      siteDescription: typeof data.siteDescription === "string" ? data.siteDescription : defaultConfig.siteDescription,
      siteFavicon: favicon,
    };
  } catch {
    return defaultConfig;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchHealthData(date: string, signal?: AbortSignal, deviceId?: string): Promise<HealthDataResponse> {
  const tz = new Date().getTimezoneOffset();
  let url = `${API_BASE}/api/health-data?date=${encodeURIComponent(date)}&tz=${tz}`;
  if (deviceId) url += `&device_id=${encodeURIComponent(deviceId)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchEnrollmentRequests(
  adminSession: string,
  signal?: AbortSignal,
): Promise<EnrollmentRequestRecord[]> {
  const res = await fetch(`${API_BASE}/api/admin/enrollment-requests`, {
    signal,
    headers: {
      "X-Admin-Session": adminSession,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function decideEnrollmentRequest(
  adminSession: string,
  action: "approve" | "reject",
  id: number,
  adminNote: string,
): Promise<EnrollmentRequestRecord> {
  const res = await fetch(`${API_BASE}/api/admin/enrollment-requests/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Session": adminSession,
    },
    body: JSON.stringify({
      id,
      admin_note: adminNote,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.request;
}

export async function createAdminSession(adminSecret: string): Promise<{ session: string; expires_at: string }> {
  const res = await fetch(`${API_BASE}/api/admin/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_secret: adminSecret }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { session: data.session, expires_at: data.expiresAt };
}

export async function fetchAdminDevices(adminSession: string, signal?: AbortSignal): Promise<AdminDeviceRecord[]> {
  const res = await fetch(`${API_BASE}/api/admin/devices`, {
    signal,
    headers: { "X-Admin-Session": adminSession },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.devices) ? data.devices : [];
}

export async function adminDeviceAction(
  adminSession: string,
  action: "disable" | "enable" | "rotate-token" | "delete" | "rename",
  deviceId: string,
  deviceName?: string,
  source?: "env" | "db",
): Promise<{ ok: boolean; token?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/devices/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Session": adminSession,
    },
    body: JSON.stringify({
      device_id: deviceId,
      device_name: deviceName,
      source,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
