import { enrollmentEnabled, issueDeviceToken, verifyEnrollSecret } from "../middleware/auth";
import type { DevicePlatform } from "../types";

const VALID_PLATFORMS = new Set<DevicePlatform>(["windows", "android", "macos"]);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function handleEnrollToken(req: Request): Promise<Response> {
  if (!enrollmentEnabled()) {
    return Response.json({ error: "Enrollment disabled" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enrollSecret = cleanText(body?.enroll_secret, 256);
  if (!verifyEnrollSecret(enrollSecret)) {
    return Response.json({ error: "Invalid enrollment secret" }, { status: 403 });
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
    const result = issueDeviceToken(deviceId, deviceName, platform);
    return Response.json({
      ok: true,
      token: result.token,
      reused: result.reused,
      source: result.source,
      device: result.device,
    });
  } catch (error) {
    console.error("[enroll-token] Failed to issue token:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
