import {
  adminEnabled,
  clearAdminAuthFailures,
  createAdminSession,
  isAdminRateLimited,
  recordAdminAuthFailure,
  verifyAdminSecret,
} from "../middleware/auth";

export async function handleAdminSession(req: Request): Promise<Response> {
  if (!adminEnabled()) {
    return Response.json({ error: "Admin disabled" }, { status: 404 });
  }
  if (isAdminRateLimited(req)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = typeof body?.admin_secret === "string" ? body.admin_secret : "";
  if (!verifyAdminSecret(secret)) {
    recordAdminAuthFailure(req);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearAdminAuthFailures(req);
  const session = createAdminSession();
  return Response.json({ ok: true, ...session });
}
