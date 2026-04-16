import {
  createEnrollmentRequest,
  findExistingDeviceToken,
} from "../middleware/auth";
import type { DevicePlatform } from "../types";

const VALID_PLATFORMS = new Set<DevicePlatform>(["windows", "android", "macos"]);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function handleDeviceEnrollmentRequest(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = cleanText(body?.device_id, 64);
  const deviceName = cleanText(body?.device_name, 64);
  const platform = cleanText(body?.platform, 16) as DevicePlatform;

  if (!deviceId) {
    return Response.json({ error: "device_id required" }, { status: 400 });
  }
  if (!deviceName) {
    return Response.json({ error: "device_name required" }, { status: 400 });
  }
  if (!VALID_PLATFORMS.has(platform)) {
    return Response.json({ error: "platform invalid" }, { status: 400 });
  }

  try {
    const existing = findExistingDeviceToken(deviceId);
    if (existing) {
      return Response.json({
        ok: true,
        status: "approved",
        token: existing.token,
        reused: true,
        device: existing.device,
      });
    }
  } catch {
    // ignore and continue with request creation
  }

  try {
    const result = createEnrollmentRequest(deviceId, deviceName, platform);
    return Response.json({
      ok: true,
      status: "pending",
      request_key: result.requestKey,
      reused: result.reused,
      message: "Request submitted and waiting for admin approval",
    });
  } catch (error) {
    console.error("[device-enrollment-request] Failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
