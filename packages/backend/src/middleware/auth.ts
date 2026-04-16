import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  getEnrollmentRequestByDeviceId,
  getDeviceTokenByDeviceId,
  getDeviceTokenByToken,
  touchDeviceTokenUsed,
  updateDeviceTokenMetadata,
  upsertDeviceToken,
  upsertEnrollmentRequest,
} from "../db";
import type {
  DeviceInfo,
  DevicePlatform,
  DeviceTokenRecord,
  EnrollmentRequestRecord,
} from "../types";

const tokenMap = new Map<string, DeviceInfo>();
const envDeviceMap = new Map<string, { token: string } & DeviceInfo>();
const VALID_PLATFORMS = new Set<DevicePlatform>(["windows", "android", "macos"]);
const ENROLL_SECRET = (process.env.ENROLL_SECRET || "").trim();
const ADMIN_SECRET = (process.env.ADMIN_SECRET || "").trim();
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_RATE_LIMIT_MAX_FAILURES = 8;
const adminSessions = new Map<string, number>();
const adminFailures = new Map<string, { count: number; resetAt: number }>();

function isValidPlatform(value: unknown): value is DevicePlatform {
  return typeof value === "string" && VALID_PLATFORMS.has(value as DevicePlatform);
}

function toDeviceInfo(record: Pick<DeviceTokenRecord, "device_id" | "device_name" | "platform">): DeviceInfo {
  return {
    device_id: record.device_id,
    device_name: record.device_name,
    platform: record.platform,
  };
}

function getDbTokenByToken(token: string): DeviceTokenRecord | null {
  const row = getDeviceTokenByToken.get(token) as DeviceTokenRecord | null;
  return row ?? null;
}

function getDbTokenByDeviceId(deviceId: string): DeviceTokenRecord | null {
  const row = getDeviceTokenByDeviceId.get(deviceId) as DeviceTokenRecord | null;
  return row ?? null;
}

function getDbEnrollmentRequestByDeviceId(deviceId: string): EnrollmentRequestRecord | null {
  const row = getEnrollmentRequestByDeviceId.get(deviceId) as EnrollmentRequestRecord | null;
  return row ?? null;
}

// Parse DEVICE_TOKEN_N env vars: "token:device_id:device_name:platform"
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("DEVICE_TOKEN_") && value) {
    const parts = value.split(":");
    if (parts.length >= 4) {
      const [token, device_id, device_name, platform] = [
        parts[0],
        parts[1],
        parts.slice(2, -1).join(":"), // device_name may contain colons
        parts[parts.length - 1],
      ];
      if (
        token &&
        device_id &&
        device_name &&
        isValidPlatform(platform)
      ) {
        const info = { token, device_id, device_name, platform };
        tokenMap.set(token, toDeviceInfo(info));
        envDeviceMap.set(device_id, info);
      }
    }
  }
}

if (tokenMap.size === 0) {
  console.warn("[auth] No device tokens configured. Set DEVICE_TOKEN_N env vars.");
}

console.log(`[auth] Loaded ${tokenMap.size} device token(s)`);

export function authenticateToken(authHeader: string | null): DeviceInfo | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  return authenticateRawToken(match[1]);
}

export function authenticateRawToken(token: string): DeviceInfo | null {
  const envDevice = tokenMap.get(token);
  if (envDevice) return envDevice;

  const dbDevice = getDbTokenByToken(token);
  if (!dbDevice || dbDevice.enabled !== 1) return null;
  touchDeviceTokenUsed.run(token);
  return toDeviceInfo(dbDevice);
}

export function enrollmentEnabled(): boolean {
  return ENROLL_SECRET.length > 0;
}

export function verifyEnrollSecret(secret: string): boolean {
  if (!enrollmentEnabled()) return false;
  const provided = Buffer.from(secret.trim(), "utf-8");
  const expected = Buffer.from(ENROLL_SECRET, "utf-8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function issueDeviceToken(
  deviceId: string,
  deviceName: string,
  platform: DevicePlatform,
): { token: string; device: DeviceInfo; source: "env" | "db"; reused: boolean } {
  const envDevice = envDeviceMap.get(deviceId);
  if (envDevice) {
    return {
      token: envDevice.token,
      device: toDeviceInfo(envDevice),
      source: "env",
      reused: true,
    };
  }

  const existing = getDbTokenByDeviceId(deviceId);
  if (existing) {
    if (existing.enabled !== 1) {
      upsertDeviceToken.run(existing.token, deviceId, deviceName, platform);
    }
    if (existing.device_name !== deviceName || existing.platform !== platform) {
      updateDeviceTokenMetadata.run(deviceName, platform, deviceId);
    }
    return {
      token: existing.token,
      device: { device_id: deviceId, device_name: deviceName, platform },
      source: "db",
      reused: true,
    };
  }

  for (let i = 0; i < 5; i += 1) {
    const token = randomBytes(16).toString("hex");
    try {
      upsertDeviceToken.run(token, deviceId, deviceName, platform);
      return {
        token,
        device: { device_id: deviceId, device_name: deviceName, platform },
        source: "db",
        reused: false,
      };
    } catch (error) {
      console.error("[auth] Failed to issue device token:", error);
    }
  }

  throw new Error("Failed to issue device token");
}

export function findExistingDeviceToken(
  deviceId: string,
): { token: string; device: DeviceInfo; source: "env" | "db" } | null {
  const envDevice = envDeviceMap.get(deviceId);
  if (envDevice) {
    return {
      token: envDevice.token,
      device: toDeviceInfo(envDevice),
      source: "env",
    };
  }

  const existing = getDbTokenByDeviceId(deviceId);
  if (!existing || existing.enabled !== 1) return null;
  return {
    token: existing.token,
    device: toDeviceInfo(existing),
    source: "db",
  };
}

export function listEnvDeviceTokens(): Array<{ token: string; device: DeviceInfo }> {
  return Array.from(envDeviceMap.values()).map((item) => ({
    token: item.token,
    device: toDeviceInfo(item),
  }));
}

export function adminEnabled(): boolean {
  return ADMIN_SECRET.length > 0;
}

export function verifyAdminSecret(secret: string): boolean {
  if (!adminEnabled()) return false;
  const provided = Buffer.from(secret.trim(), "utf-8");
  const expected = Buffer.from(ADMIN_SECRET, "utf-8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function getAdminSecretFromRequest(req: Request): string {
  const headerValue =
    req.headers.get("x-admin-secret") ||
    req.headers.get("x_admin_secret") ||
    "";
  if (headerValue) return headerValue.trim();

  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function getAdminSessionFromRequest(req: Request): string {
  const headerValue =
    req.headers.get("x-admin-session") ||
    req.headers.get("x_admin_session") ||
    "";
  if (headerValue) return headerValue.trim();

  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^AdminSession\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function getRequestIdentity(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isAdminRateLimited(req: Request): boolean {
  const key = getRequestIdentity(req);
  const now = Date.now();
  const state = adminFailures.get(key);
  if (!state || state.resetAt <= now) {
    adminFailures.delete(key);
    return false;
  }
  return state.count >= ADMIN_RATE_LIMIT_MAX_FAILURES;
}

export function recordAdminAuthFailure(req: Request): void {
  const key = getRequestIdentity(req);
  const now = Date.now();
  const state = adminFailures.get(key);
  if (!state || state.resetAt <= now) {
    adminFailures.set(key, { count: 1, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS });
    return;
  }
  state.count += 1;
}

export function clearAdminAuthFailures(req: Request): void {
  adminFailures.delete(getRequestIdentity(req));
}

export function createAdminSession(): { session: string; expiresAt: string } {
  const session = randomBytes(24).toString("hex");
  const expiresAtMs = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(session, expiresAtMs);
  return { session, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function verifyAdminSession(session: string): boolean {
  if (!session) return false;
  const expiresAt = adminSessions.get(session);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(session);
    return false;
  }
  return true;
}

export function verifyAdminRequest(req: Request): boolean {
  const session = getAdminSessionFromRequest(req);
  if (verifyAdminSession(session)) return true;

  const secret = getAdminSecretFromRequest(req);
  if (verifyAdminSecret(secret)) return true;
  return false;
}

export function createEnrollmentRequest(
  deviceId: string,
  deviceName: string,
  platform: DevicePlatform,
  metadata: {
    clientVersion?: string;
    osVersion?: string;
    hostname?: string;
    username?: string;
    clientIp?: string;
    userAgent?: string;
  } = {},
): { requestKey: string; reused: boolean } {
  const existing = getDbEnrollmentRequestByDeviceId(deviceId);
  const reused =
    !!existing &&
    existing.status === "pending" &&
    existing.device_name === deviceName &&
    existing.platform === platform;
  const requestKey = reused ? existing.request_key : randomBytes(12).toString("hex");
  upsertEnrollmentRequest.run(
    requestKey,
    deviceId,
    deviceName,
    platform,
    metadata.clientVersion || "",
    metadata.osVersion || "",
    metadata.hostname || "",
    metadata.username || "",
    metadata.clientIp || "",
    metadata.userAgent || "",
  );
  return { requestKey, reused };
}
