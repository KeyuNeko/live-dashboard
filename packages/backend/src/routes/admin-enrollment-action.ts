import {
  approveEnrollmentRequest,
  getEnrollmentRequestById,
  rejectEnrollmentRequest,
} from "../db";
import {
  adminEnabled,
  getAdminSecretFromRequest,
  verifyAdminSecret,
} from "../middleware/auth";
import type { EnrollmentRequestRecord } from "../types";

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function handleAdminEnrollmentAction(req: Request, action: "approve" | "reject"): Promise<Response> {
  if (!adminEnabled()) {
    return Response.json({ error: "Admin disabled" }, { status: 404 });
  }

  const secret = getAdminSecretFromRequest(req);
  if (!verifyAdminSecret(secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "id invalid" }, { status: 400 });
  }

  const adminNote = cleanText(body?.admin_note, 256);
  const existing = getEnrollmentRequestById.get(id) as EnrollmentRequestRecord | null;
  if (!existing) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (action === "approve") {
    approveEnrollmentRequest.run(adminNote, id);
  } else {
    rejectEnrollmentRequest.run(adminNote, id);
  }

  const updated = getEnrollmentRequestById.get(id) as EnrollmentRequestRecord | null;
  return Response.json({ ok: true, request: updated });
}
