import { resolve, normalize, relative, sep } from "node:path";
import { realpathSync } from "node:fs";
import { realpath as realpathAsync } from "node:fs/promises";
import { handleReport } from "./routes/report";
import { handleCurrent } from "./routes/current";
import { handleTimeline } from "./routes/timeline";
import { handleHealth } from "./routes/health";
import { handleHealthData, handleHealthDataQuery } from "./routes/health-data";
import { handleHealthWebhook } from "./routes/health-webhook";
import { handleConfig } from "./routes/config";
import { handleEnrollToken } from "./routes/enroll-token";
import { handleDeviceEnrollmentRequest } from "./routes/device-enrollment-request";
import { handleDeviceEnrollmentStatus } from "./routes/device-enrollment-status";
import { handleAdminEnrollmentList } from "./routes/admin-enrollment-list";
import { handleAdminEnrollmentAction } from "./routes/admin-enrollment-action";
import { handleAdminSession } from "./routes/admin-session";
import { handleAdminDevices, handleAdminDeviceAction } from "./routes/admin-devices";
import { injectSiteConfig } from "./services/site-config";

// Start scheduled cleanup tasks (import triggers setInterval registration)
import "./services/cleanup";

const PORT = parseInt(process.env.PORT || "3000", 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[server] Invalid PORT: ${process.env.PORT}, using 3000`);
}
const LISTEN_PORT = isNaN(PORT) || PORT < 1 || PORT > 65535 ? 3000 : PORT;

const STATIC_ROOT = resolve(process.env.STATIC_DIR || "./public");

// Cache realpath of static root at startup (avoids per-request sync IO)
let REAL_STATIC_ROOT = "";
let staticEnabled = false;
try {
  REAL_STATIC_ROOT = realpathSync(STATIC_ROOT);
  staticEnabled = true;
} catch {
  console.warn(`[server] Static dir not found: ${STATIC_ROOT} — static files won't be served`);
}

async function serveStaticFile(realFile: string): Promise<Response> {
  if (realFile.endsWith(".html")) {
    const html = await Bun.file(realFile).text();
    return new Response(injectSiteConfig(html), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(Bun.file(realFile));
}

async function resolveStaticCandidate(pathname: string): Promise<string | null> {
  const decoded = decodeURIComponent(pathname);
  const safePath = normalize(decoded).replace(/^(\.\.[\/\\])+/, "");
  const normalizedPath = safePath.replace(/^[\/\\]+/, "");

  const candidates = [resolve(STATIC_ROOT, normalizedPath)];
  if (normalizedPath && !/[\\/][^\\/]*\.[^\\/]+$/.test(normalizedPath) && !normalizedPath.endsWith(".html")) {
    candidates.push(resolve(STATIC_ROOT, `${normalizedPath}.html`));
  }

  for (const candidate of candidates) {
    const rel = relative(STATIC_ROOT, candidate);
    if (rel.startsWith("..")) {
      return "__FORBIDDEN__";
    }
    try {
      const realFile = await realpathAsync(candidate);
      if (realFile !== REAL_STATIC_ROOT && !realFile.startsWith(REAL_STATIC_ROOT + sep)) {
        return "__FORBIDDEN__";
      }
      const file = Bun.file(realFile);
      if (await file.exists()) {
        return realFile;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

const server = Bun.serve({
  port: LISTEN_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    // CORS headers for development
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret, X-Admin-Session",
    };

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // API routes
    let response: Response;

    try {
      if (pathname === "/api/report" && req.method === "POST") {
        response = await handleReport(req);
      } else if (pathname === "/api/current" && req.method === "GET") {
        const clientIp =
          req.headers.get("x-real-ip") ||
          req.headers.get("cf-connecting-ip") ||
          server.requestIP(req)?.address ||
          "";
        response = handleCurrent(clientIp, req.headers.get("user-agent") || undefined);
      } else if (pathname === "/api/timeline" && req.method === "GET") {
        response = handleTimeline(url);
      } else if (pathname === "/api/health" && req.method === "GET") {
        response = handleHealth();
      } else if (pathname === "/api/health-data" && req.method === "POST") {
        response = await handleHealthData(req);
      } else if (pathname === "/api/health-data" && req.method === "GET") {
        response = handleHealthDataQuery(url);
      } else if (pathname === "/api/health-webhook" && req.method === "POST") {
        response = await handleHealthWebhook(req);
      } else if (pathname === "/api/config" && req.method === "GET") {
        response = handleConfig();
      } else if (pathname === "/api/enroll-token" && req.method === "POST") {
        response = await handleEnrollToken(req);
      } else if (pathname === "/api/device-enrollment/request" && req.method === "POST") {
        response = await handleDeviceEnrollmentRequest(req);
      } else if (pathname === "/api/device-enrollment/status" && req.method === "GET") {
        response = handleDeviceEnrollmentStatus(url);
      } else if (pathname === "/api/admin/session" && req.method === "POST") {
        response = await handleAdminSession(req);
      } else if (pathname === "/api/admin/enrollment-requests" && req.method === "GET") {
        response = handleAdminEnrollmentList(req);
      } else if (pathname === "/api/admin/enrollment-requests/approve" && req.method === "POST") {
        response = await handleAdminEnrollmentAction(req, "approve");
      } else if (pathname === "/api/admin/enrollment-requests/reject" && req.method === "POST") {
        response = await handleAdminEnrollmentAction(req, "reject");
      } else if (pathname === "/api/admin/devices" && req.method === "GET") {
        response = handleAdminDevices(req);
      } else if (pathname === "/api/admin/devices/disable" && req.method === "POST") {
        response = await handleAdminDeviceAction(req, "disable");
      } else if (pathname === "/api/admin/devices/enable" && req.method === "POST") {
        response = await handleAdminDeviceAction(req, "enable");
      } else if (pathname === "/api/admin/devices/rotate-token" && req.method === "POST") {
        response = await handleAdminDeviceAction(req, "rotate-token");
      } else if (pathname === "/api/admin/devices/delete" && req.method === "POST") {
        response = await handleAdminDeviceAction(req, "delete");
      } else if (pathname === "/api/admin/devices/rename" && req.method === "POST") {
        response = await handleAdminDeviceAction(req, "rename");
      } else if (!pathname.startsWith("/api/")) {
        // Static file serving disabled if directory doesn't exist
        if (!staticEnabled) {
          response = Response.json({ error: "Not found" }, { status: 404 });
        } else {
          try {
            const realFile = await resolveStaticCandidate(pathname);
            if (realFile === "__FORBIDDEN__") {
              response = Response.json({ error: "Forbidden" }, { status: 403 });
            } else if (realFile) {
              return serveStaticFile(realFile);
            } else {
              const indexFile = Bun.file(`${REAL_STATIC_ROOT}/index.html`);
              if (await indexFile.exists()) {
                return serveStaticFile(`${REAL_STATIC_ROOT}/index.html`);
              }
              response = Response.json({ error: "Not found" }, { status: 404 });
            }
          } catch {
            return new Response("Bad request", { status: 400 });
          }
        }
      } else {
        response = Response.json({ error: "Not found" }, { status: 404 });
      }
    } catch (e) {
      console.error("[server] Unhandled error:", e);
      response = Response.json({ error: "Internal error" }, { status: 500 });
    }

    // Append CORS headers to API responses
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }

    return response;
  },
});

console.log(`[server] Live Dashboard backend running on http://localhost:${server.port}`);
