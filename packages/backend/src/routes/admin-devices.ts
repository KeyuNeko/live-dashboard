import { randomBytes } from "node:crypto";
import {
  deleteDeviceToken,
  listDeviceTokens,
  renameDeviceState,
  renameDeviceToken,
  rotateDeviceToken,
  setDeviceTokenEnabled,
} from "../db";
import {
  adminEnabled,
  clearAdminAuthFailures,
  isAdminRateLimited,
  recordAdminAuthFailure,
  listEnvDeviceTokens,
  verifyAdminRequest,
} from "../middleware/auth";
import type { AdminDeviceRecord } from "../types";

function authorizeAdmin(req: Request): Response | null {
  if (!adminEnabled()) return Response.json({ error: "Admin disabled" }, { status: 404 });
  if (isAdminRateLimited(req)) return Response.json({ error: "Too many attempts" }, { status: 429 });
  if (!verifyAdminRequest(req)) {
    recordAdminAuthFailure(req);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  clearAdminAuthFailures(req);
  return null;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function handleAdminDevices(req: Request): Response {
  const auth = authorizeAdmin(req);
  if (auth) return auth;

  const dbDevices = (listDeviceTokens.all() as AdminDeviceRecord[]).map((device) => ({
    ...device,
    source: "db" as const,
  }));
  const dbDeviceIds = new Set(dbDevices.map((device) => device.device_id));
  const envDevices = listEnvDeviceTokens()
    .filter((item) => !dbDeviceIds.has(item.device.device_id))
    .map((item) => ({
      token: item.token,
      ...item.device,
      source: "env" as const,
      enabled: 1,
      revoked_at: "",
      last_used_at: "",
      created_at: "",
      updated_at: "",
      last_seen_at: "",
      is_online: 0,
    }));
  return Response.json({ devices: [...envDevices, ...dbDevices] });
}

export async function handleAdminDeviceAction(
  req: Request,
  action: "disable" | "enable" | "rotate-token" | "delete" | "rename",
): Promise<Response> {
  const auth = authorizeAdmin(req);
  if (auth) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = cleanText(body?.device_id, 64);
  if (!deviceId) return Response.json({ error: "device_id required" }, { status: 400 });
  const source = cleanText(body?.source, 16);
  if (source === "env") {
    return Response.json({ error: "Env devices cannot be modified here" }, { status: 400 });
  }

  if (action === "disable") {
    setDeviceTokenEnabled.run(0, 0, deviceId);
    return Response.json({ ok: true });
  }
  if (action === "enable") {
    setDeviceTokenEnabled.run(1, 1, deviceId);
    return Response.json({ ok: true });
  }
  if (action === "rotate-token") {
    const token = randomBytes(16).toString("hex");
    rotateDeviceToken.run(token, deviceId);
    return Response.json({ ok: true, token });
  }
  if (action === "delete") {
    deleteDeviceToken.run(deviceId);
    return Response.json({ ok: true });
  }

  const deviceName = cleanText(body?.device_name, 64);
  if (!deviceName) return Response.json({ error: "device_name required" }, { status: 400 });
  renameDeviceToken.run(deviceName, deviceId);
  renameDeviceState.run(deviceName, deviceId);
  return Response.json({ ok: true });
}
