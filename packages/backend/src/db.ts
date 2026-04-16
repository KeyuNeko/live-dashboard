import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH || "./live-dashboard.db";

export const db = new Database(DB_PATH, { create: true });

// Performance pragmas
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");
db.run("PRAGMA synchronous = NORMAL");

// Activities table
db.run(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    window_title TEXT DEFAULT '',
    title_hash TEXT NOT NULL DEFAULT '',
    time_bucket INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Dedup unique constraint
db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup
  ON activities(device_id, app_id, title_hash, time_bucket)
`);

// Query indexes
db.run(`
  CREATE INDEX IF NOT EXISTS idx_activities_device_started
  ON activities(device_id, started_at DESC)
`);
db.run(`
  CREATE INDEX IF NOT EXISTS idx_activities_started
  ON activities(started_at DESC)
`);
db.run(`
  CREATE INDEX IF NOT EXISTS idx_activities_created
  ON activities(created_at)
`);

// Device states table
db.run(`
  CREATE TABLE IF NOT EXISTS device_states (
    device_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    window_title TEXT DEFAULT '',
    last_seen_at TEXT NOT NULL,
    is_online INTEGER DEFAULT 1
  )
`);

// Device tokens table
db.run(`
  CREATE TABLE IF NOT EXISTS device_tokens (
    token TEXT PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    revoked_at TEXT NOT NULL DEFAULT '',
    last_used_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS device_enrollment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_key TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT NOT NULL DEFAULT '',
    client_version TEXT NOT NULL DEFAULT '',
    os_version TEXT NOT NULL DEFAULT '',
    hostname TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    client_ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT NOT NULL DEFAULT '',
    rejected_at TEXT NOT NULL DEFAULT ''
  )
`);

// ── Schema migration: add display_title + extra columns ──

const KNOWN_TABLES = new Set(["activities", "device_states", "device_tokens", "device_enrollment_requests"]);

function columnExists(table: string, column: string): boolean {
  if (!KNOWN_TABLES.has(table)) {
    throw new Error(`columnExists: unknown table "${table}"`);
  }
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

// activities.display_title
if (!columnExists("activities", "display_title")) {
  db.run("ALTER TABLE activities ADD COLUMN display_title TEXT DEFAULT ''");
}

// device_states.display_title
if (!columnExists("device_states", "display_title")) {
  db.run("ALTER TABLE device_states ADD COLUMN display_title TEXT DEFAULT ''");
}

// device_states.extra (JSON string for battery, etc.)
if (!columnExists("device_states", "extra")) {
  db.run("ALTER TABLE device_states ADD COLUMN extra TEXT DEFAULT '{}'");
}

// device_tokens management columns
for (const [column, definition] of [
  ["enabled", "INTEGER NOT NULL DEFAULT 1"],
  ["revoked_at", "TEXT NOT NULL DEFAULT ''"],
  ["last_used_at", "TEXT NOT NULL DEFAULT ''"],
] as const) {
  if (!columnExists("device_tokens", column)) {
    db.run(`ALTER TABLE device_tokens ADD COLUMN ${column} ${definition}`);
  }
}

// device_enrollment_requests metadata columns
for (const [column, definition] of [
  ["client_version", "TEXT NOT NULL DEFAULT ''"],
  ["os_version", "TEXT NOT NULL DEFAULT ''"],
  ["hostname", "TEXT NOT NULL DEFAULT ''"],
  ["username", "TEXT NOT NULL DEFAULT ''"],
  ["client_ip", "TEXT NOT NULL DEFAULT ''"],
  ["user_agent", "TEXT NOT NULL DEFAULT ''"],
  ["expires_at", "TEXT NOT NULL DEFAULT ''"],
] as const) {
  if (!columnExists("device_enrollment_requests", column)) {
    db.run(`ALTER TABLE device_enrollment_requests ADD COLUMN ${column} ${definition}`);
  }
}

// ── Health records table ──

db.run(`
  CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    end_time TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_id, type, recorded_at, end_time)
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_health_records_recorded
  ON health_records(recorded_at)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_health_records_type
  ON health_records(type, recorded_at)
`);

// ── HMAC hash secret validation ──

const HASH_SECRET = process.env.HASH_SECRET || "";
if (!HASH_SECRET) {
  console.error("[db] FATAL: HASH_SECRET not set. This is required for privacy-safe title hashing.");
  console.error("[db] Generate one with: openssl rand -hex 32");
  process.exit(1);
}

export function hmacTitle(title: string): string {
  const hmac = new Bun.CryptoHasher("sha256", HASH_SECRET);
  hmac.update(title);
  return hmac.digest("hex");
}

// Prepared statements
export const insertActivity = db.prepare(`
  INSERT INTO activities (device_id, device_name, platform, app_id, app_name, window_title, display_title, title_hash, time_bucket, started_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(device_id, app_id, title_hash, time_bucket) DO NOTHING
`);

export const upsertDeviceState = db.prepare(`
  INSERT INTO device_states (device_id, device_name, platform, app_id, app_name, window_title, display_title, last_seen_at, extra, is_online)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(device_id) DO UPDATE SET
    device_name = excluded.device_name,
    platform = excluded.platform,
    app_id = excluded.app_id,
    app_name = excluded.app_name,
    window_title = excluded.window_title,
    display_title = excluded.display_title,
    last_seen_at = excluded.last_seen_at,
    extra = excluded.extra,
    is_online = 1
`);

export const getAllDeviceStates = db.prepare(`
  SELECT * FROM device_states ORDER BY last_seen_at DESC
`);

export const getRecentActivities = db.prepare(`
  SELECT * FROM activities ORDER BY started_at DESC LIMIT 20
`);

export const getTimelineByDate = db.prepare(`
  SELECT * FROM activities
  WHERE date(started_at) = ?
  ORDER BY started_at ASC
`);

export const getTimelineByDateAndDevice = db.prepare(`
  SELECT * FROM activities
  WHERE date(started_at) = ? AND device_id = ?
  ORDER BY started_at ASC
`);

export const markOfflineDevices = db.prepare(`
  UPDATE device_states SET is_online = 0
  WHERE is_online = 1
  AND (last_seen_at IS NULL OR last_seen_at = '' OR datetime(last_seen_at) IS NULL
       OR datetime(last_seen_at) < datetime('now', '-1 minute'))
`);

export const cleanupOldActivities = db.prepare(`
  DELETE FROM activities WHERE created_at < datetime('now', '-7 days')
`);

export const getDeviceTokenByToken = db.prepare(`
  SELECT token, device_id, device_name, platform, enabled, revoked_at, last_used_at, created_at, updated_at
  FROM device_tokens
  WHERE token = ?
  LIMIT 1
`);

export const getDeviceTokenByDeviceId = db.prepare(`
  SELECT token, device_id, device_name, platform, enabled, revoked_at, last_used_at, created_at, updated_at
  FROM device_tokens
  WHERE device_id = ?
  LIMIT 1
`);

export const upsertDeviceToken = db.prepare(`
  INSERT INTO device_tokens (token, device_id, device_name, platform, enabled, revoked_at)
  VALUES (?, ?, ?, ?, 1, '')
  ON CONFLICT(device_id) DO UPDATE SET
    token = excluded.token,
    device_name = excluded.device_name,
    platform = excluded.platform,
    enabled = 1,
    revoked_at = '',
    updated_at = datetime('now')
`);

export const updateDeviceTokenMetadata = db.prepare(`
  UPDATE device_tokens
  SET device_name = ?, platform = ?, updated_at = datetime('now')
  WHERE device_id = ?
`);

export const touchDeviceTokenUsed = db.prepare(`
  UPDATE device_tokens
  SET last_used_at = datetime('now')
  WHERE token = ?
`);

export const listDeviceTokens = db.prepare(`
  SELECT
    dt.token,
    dt.device_id,
    dt.device_name,
    dt.platform,
    dt.enabled,
    dt.revoked_at,
    dt.last_used_at,
    dt.created_at,
    dt.updated_at,
    COALESCE(ds.last_seen_at, '') AS last_seen_at,
    COALESCE(ds.is_online, 0) AS is_online
  FROM device_tokens dt
  LEFT JOIN device_states ds ON ds.device_id = dt.device_id
  ORDER BY datetime(COALESCE(NULLIF(dt.last_used_at, ''), dt.updated_at)) DESC
`);

export const setDeviceTokenEnabled = db.prepare(`
  UPDATE device_tokens
  SET enabled = ?, revoked_at = CASE WHEN ? = 1 THEN '' ELSE datetime('now') END, updated_at = datetime('now')
  WHERE device_id = ?
`);

export const rotateDeviceToken = db.prepare(`
  UPDATE device_tokens
  SET token = ?, enabled = 1, revoked_at = '', updated_at = datetime('now')
  WHERE device_id = ?
`);

export const deleteDeviceToken = db.prepare(`
  DELETE FROM device_tokens WHERE device_id = ?
`);

export const renameDeviceToken = db.prepare(`
  UPDATE device_tokens
  SET device_name = ?, updated_at = datetime('now')
  WHERE device_id = ?
`);

export const renameDeviceState = db.prepare(`
  UPDATE device_states
  SET device_name = ?
  WHERE device_id = ?
`);

export const getEnrollmentRequestByRequestKey = db.prepare(`
  SELECT id, request_key, device_id, device_name, platform, status, admin_note, client_version, os_version, hostname, username, client_ip, user_agent, expires_at, created_at, updated_at, approved_at, rejected_at
  FROM device_enrollment_requests
  WHERE request_key = ?
  LIMIT 1
`);

export const getEnrollmentRequestByDeviceId = db.prepare(`
  SELECT id, request_key, device_id, device_name, platform, status, admin_note, client_version, os_version, hostname, username, client_ip, user_agent, expires_at, created_at, updated_at, approved_at, rejected_at
  FROM device_enrollment_requests
  WHERE device_id = ?
  LIMIT 1
`);

export const getEnrollmentRequestById = db.prepare(`
  SELECT id, request_key, device_id, device_name, platform, status, admin_note, client_version, os_version, hostname, username, client_ip, user_agent, expires_at, created_at, updated_at, approved_at, rejected_at
  FROM device_enrollment_requests
  WHERE id = ?
  LIMIT 1
`);

export const upsertEnrollmentRequest = db.prepare(`
  INSERT INTO device_enrollment_requests (request_key, device_id, device_name, platform, status, admin_note, client_version, os_version, hostname, username, client_ip, user_agent, expires_at, approved_at, rejected_at)
  VALUES (?, ?, ?, ?, 'pending', '', ?, ?, ?, ?, ?, ?, datetime('now', '+24 hours'), '', '')
  ON CONFLICT(device_id) DO UPDATE SET
    request_key = excluded.request_key,
    device_name = excluded.device_name,
    platform = excluded.platform,
    status = 'pending',
    admin_note = '',
    client_version = excluded.client_version,
    os_version = excluded.os_version,
    hostname = excluded.hostname,
    username = excluded.username,
    client_ip = excluded.client_ip,
    user_agent = excluded.user_agent,
    expires_at = datetime('now', '+24 hours'),
    approved_at = '',
    rejected_at = '',
    updated_at = datetime('now')
`);

export const approveEnrollmentRequest = db.prepare(`
  UPDATE device_enrollment_requests
  SET status = 'approved',
    admin_note = ?,
    approved_at = datetime('now'),
    rejected_at = '',
    updated_at = datetime('now')
  WHERE id = ?
`);

export const rejectEnrollmentRequest = db.prepare(`
  UPDATE device_enrollment_requests
  SET status = 'rejected',
    admin_note = ?,
    rejected_at = datetime('now'),
    approved_at = '',
    updated_at = datetime('now')
  WHERE id = ?
`);

export const listEnrollmentRequests = db.prepare(`
  SELECT id, request_key, device_id, device_name, platform, status, admin_note, client_version, os_version, hostname, username, client_ip, user_agent, expires_at, created_at, updated_at, approved_at, rejected_at
  FROM device_enrollment_requests
  WHERE NOT (status = 'rejected' AND datetime(updated_at) < datetime('now', '-7 days'))
  ORDER BY
    CASE status
      WHEN 'pending' THEN 0
      WHEN 'approved' THEN 1
      ELSE 2
    END,
    datetime(updated_at) DESC
  LIMIT 100
`);

export const expireOldEnrollmentRequests = db.prepare(`
  UPDATE device_enrollment_requests
  SET status = 'rejected',
    admin_note = CASE WHEN admin_note = '' THEN 'Request expired' ELSE admin_note END,
    rejected_at = datetime('now'),
    updated_at = datetime('now')
  WHERE status = 'pending'
    AND expires_at != ''
    AND datetime(expires_at) < datetime('now')
`);

export default db;
