import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  getDeviceTokenByDeviceId,
  getDeviceTokenByToken,
  updateDeviceTokenMetadata,
  upsertDeviceToken,
} from "../db";
import type { DeviceInfo, DevicePlatform, DeviceTokenRecord } from "../types";

const tokenMap = new Map<string, DeviceInfo>();
const envDeviceMap = new Map<string, { token: string } & DeviceInfo>();
const VALID_PLATFORMS = new Set<DevicePlatform>(["windows", "android", "macos"]);
const ENROLL_SECRET = (process.env.ENROLL_SECRET || "").trim();

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
  return dbDevice ? toDeviceInfo(dbDevice) : null;
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
