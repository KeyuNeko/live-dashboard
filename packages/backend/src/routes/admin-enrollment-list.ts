import { listEnrollmentRequests } from "../db";
import {
  adminEnabled,
  getAdminSecretFromRequest,
  verifyAdminSecret,
} from "../middleware/auth";
import type { EnrollmentRequestRecord } from "../types";

export function handleAdminEnrollmentList(req: Request): Response {
  if (!adminEnabled()) {
    return Response.json({ error: "Admin disabled" }, { status: 404 });
  }

  const secret = getAdminSecretFromRequest(req);
  if (!verifyAdminSecret(secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = listEnrollmentRequests.all() as EnrollmentRequestRecord[];
  return Response.json({ requests: rows });
}
