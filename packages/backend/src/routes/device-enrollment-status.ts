import { getEnrollmentRequestByRequestKey } from "../db";
import { issueDeviceToken } from "../middleware/auth";
import type { EnrollmentRequestRecord } from "../types";

export function handleDeviceEnrollmentStatus(url: URL): Response {
  const requestKey = url.searchParams.get("request_key")?.trim() || "";
  if (!requestKey) {
    return Response.json({ error: "request_key required" }, { status: 400 });
  }

  const request = getEnrollmentRequestByRequestKey.get(requestKey) as EnrollmentRequestRecord | null;
  if (!request) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (request.status === "approved") {
    try {
      const issued = issueDeviceToken(request.device_id, request.device_name, request.platform);
      return Response.json({
        ok: true,
        status: "approved",
        token: issued.token,
        device: issued.device,
        admin_note: request.admin_note,
      });
    } catch (error) {
      console.error("[device-enrollment-status] Failed to issue token:", error);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }

  return Response.json({
    ok: true,
    status: request.status,
    admin_note: request.admin_note,
    device: {
      device_id: request.device_id,
      device_name: request.device_name,
      platform: request.platform,
    },
  });
}
