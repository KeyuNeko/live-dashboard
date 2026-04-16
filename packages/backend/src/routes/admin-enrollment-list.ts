import { expireOldEnrollmentRequests, listEnrollmentRequests } from "../db";
import {
  adminEnabled,
  isAdminRateLimited,
  recordAdminAuthFailure,
  clearAdminAuthFailures,
  verifyAdminRequest,
} from "../middleware/auth";
import type { EnrollmentRequestRecord } from "../types";

export function handleAdminEnrollmentList(req: Request): Response {
  if (!adminEnabled()) {
    return Response.json({ error: "Admin disabled" }, { status: 404 });
  }

  if (isAdminRateLimited(req)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!verifyAdminRequest(req)) {
    recordAdminAuthFailure(req);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  clearAdminAuthFailures(req);

  expireOldEnrollmentRequests.run();
  const rows = listEnrollmentRequests.all() as EnrollmentRequestRecord[];
  return Response.json({ requests: rows });
}
