"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  adminDeviceAction,
  createAdminSession,
  decideEnrollmentRequest,
  fetchAdminDevices,
  fetchEnrollmentRequests,
  type AdminDeviceRecord,
  type EnrollmentRequestRecord,
} from "@/lib/api";

const SESSION_KEY = "live_dashboard_admin_session";

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [adminSession, setAdminSession] = useState("");
  const [tab, setTab] = useState<"requests" | "devices">("requests");
  const [requests, setRequests] = useState<EnrollmentRequestRecord[]>([]);
  const [devices, setDevices] = useState<AdminDeviceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionNote, setActionNote] = useState<Record<number, string>>({});
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setAdminSession(window.localStorage.getItem(SESSION_KEY) || "");
  }, []);

  async function login() {
    if (!adminSecret.trim()) {
      setError("请输入管理员密钥");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const session = await createAdminSession(adminSecret.trim());
      setAdminSession(session.session);
      window.localStorage.setItem(SESSION_KEY, session.session);
      setAdminSecret("");
      setMessage(`登录成功，有效期至 ${session.expires_at}`);
      await loadAll(session.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll(session = adminSession) {
    if (!session.trim()) {
      setError("请先登录");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextRequests, nextDevices] = await Promise.all([
        fetchEnrollmentRequests(session.trim()),
        fetchAdminDevices(session.trim()),
      ]);
      setRequests(nextRequests);
      setDevices(nextDevices);
      setRenameDraft(Object.fromEntries(nextDevices.map((d) => [d.device_id, d.device_name])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollmentAction(id: number, action: "approve" | "reject") {
    if (!adminSession.trim()) {
      setError("请先登录");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await decideEnrollmentRequest(
        adminSession.trim(),
        action,
        id,
        actionNote[id] || "",
      );
      setRequests((prev) => prev.map((item) => (item.id === id ? updated : item)));
      await loadAll(adminSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeviceAction(
    device: AdminDeviceRecord,
    action: "disable" | "enable" | "rotate-token" | "delete" | "rename",
  ) {
    if (!adminSession.trim()) {
      setError("请先登录");
      return;
    }
    const ok = window.confirm(`确认对设备 ${device.device_id} 执行 ${action}？`);
    if (!ok) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await adminDeviceAction(
        adminSession.trim(),
        action,
        device.device_id,
        renameDraft[device.device_id],
        device.source,
      );
      if (result.token) {
        setMessage(`已轮换 token：${result.token}`);
      }
      await loadAll(adminSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "pending").length,
    [requests],
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <header className="pb-4 mb-6 separator-dashed">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold font-[var(--font-jp)]">管理员后台</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              审批设备接入申请，管理已签发 token。
            </p>
          </div>
          <a href="/" className="pill-btn text-xs">返回首页</a>
        </div>
      </header>

      <section className="card-decorated rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">管理员密钥</label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none"
              placeholder={adminSession ? "已登录，可留空" : "输入 ADMIN_SECRET 登录"}
            />
          </div>
          <button onClick={login} className="pill-btn text-xs" disabled={loading}>
            登录
          </button>
          <button onClick={() => loadAll()} className="pill-btn text-xs" disabled={loading}>
            {loading ? "加载中..." : "刷新"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        {message && <p className="text-xs text-[var(--color-secondary)] mt-3">{message}</p>}
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          状态：{adminSession ? "已登录" : "未登录"} · 待审批：{pendingCount} 台设备
        </p>
      </section>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("requests")}
          className={`pill-btn text-xs ${tab === "requests" ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : ""}`}
        >
          接入申请
        </button>
        <button
          onClick={() => setTab("devices")}
          className={`pill-btn text-xs ${tab === "devices" ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : ""}`}
        >
          设备管理
        </button>
      </div>

      {tab === "requests" ? (
        <EnrollmentRequests
          requests={requests}
          actionNote={actionNote}
          setActionNote={setActionNote}
          onAction={handleEnrollmentAction}
          loading={loading}
        />
      ) : (
        <DeviceManagement
          devices={devices}
          renameDraft={renameDraft}
          setRenameDraft={setRenameDraft}
          onAction={handleDeviceAction}
          loading={loading}
        />
      )}
    </main>
  );
}

function EnrollmentRequests({
  requests,
  actionNote,
  setActionNote,
  onAction,
  loading,
}: {
  requests: EnrollmentRequestRecord[];
  actionNote: Record<number, string>;
  setActionNote: Dispatch<SetStateAction<Record<number, string>>>;
  onAction: (id: number, action: "approve" | "reject") => void;
  loading: boolean;
}) {
  if (requests.length === 0) {
    return (
      <div className="vn-bubble">
        <p className="text-sm">还没有设备申请记录。</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {requests.map((item) => (
        <article key={item.id} className="card-decorated rounded-xl p-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">设备：</span>{item.device_name}</p>
              <p><span className="font-semibold">ID：</span><code>{item.device_id}</code></p>
              <p><span className="font-semibold">平台：</span>{item.platform}</p>
              <p><span className="font-semibold">状态：</span>{item.status}</p>
              <p><span className="font-semibold">客户端：</span>{item.client_version || "-"}</p>
              <p><span className="font-semibold">系统：</span>{item.os_version || "-"}</p>
              <p><span className="font-semibold">主机/用户：</span>{item.hostname || "-"} / {item.username || "-"}</p>
              <p><span className="font-semibold">IP：</span>{item.client_ip || "-"}</p>
              <p><span className="font-semibold">过期：</span>{item.expires_at || "-"}</p>
              {item.admin_note && <p><span className="font-semibold">备注：</span>{item.admin_note}</p>}
            </div>

            <div className="lg:w-80 w-full">
              <label className="block text-xs font-medium mb-1">审批备注</label>
              <textarea
                value={actionNote[item.id] ?? item.admin_note ?? ""}
                onChange={(e) => setActionNote((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="w-full min-h-24 rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none"
                placeholder="可选：填写审批说明"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => onAction(item.id, "approve")} className="pill-btn text-xs" disabled={loading || item.status === "approved"}>
                  批准
                </button>
                <button onClick={() => onAction(item.id, "reject")} className="pill-btn text-xs" disabled={loading || item.status === "rejected"}>
                  拒绝
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function DeviceManagement({
  devices,
  renameDraft,
  setRenameDraft,
  onAction,
  loading,
}: {
  devices: AdminDeviceRecord[];
  renameDraft: Record<string, string>;
  setRenameDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onAction: (device: AdminDeviceRecord, action: "disable" | "enable" | "rotate-token" | "delete" | "rename") => void;
  loading: boolean;
}) {
  if (devices.length === 0) {
    return (
      <div className="vn-bubble">
        <p className="text-sm">还没有数据库签发的设备 token。</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {devices.map((device) => (
        <article key={device.device_id} className="card-decorated rounded-xl p-4">
          <div className="grid lg:grid-cols-[1fr_340px] gap-4">
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">设备：</span>{device.device_name}</p>
              <p><span className="font-semibold">ID：</span><code>{device.device_id}</code></p>
              <p><span className="font-semibold">平台：</span>{device.platform}</p>
              <p><span className="font-semibold">状态：</span>{device.enabled === 1 ? "enabled" : "disabled"}</p>
              <p><span className="font-semibold">在线：</span>{device.is_online === 1 ? "online" : "offline"}</p>
              <p><span className="font-semibold">最后使用：</span>{device.last_used_at || "-"}</p>
              <p><span className="font-semibold">最后在线：</span>{device.last_seen_at || "-"}</p>
              <p><span className="font-semibold">Token：</span><code>{device.token.slice(0, 6)}...{device.token.slice(-6)}</code></p>
            </div>

            <div className="space-y-3">
              <input
                value={renameDraft[device.device_id] ?? device.device_name}
                onChange={(e) => setRenameDraft((prev) => ({ ...prev, [device.device_id]: e.target.value }))}
                className="w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onAction(device, "rename")} className="pill-btn text-xs" disabled={loading || device.source === "env"}>改名</button>
                {device.enabled === 1 ? (
                  <button onClick={() => onAction(device, "disable")} className="pill-btn text-xs" disabled={loading || device.source === "env"}>禁用</button>
                ) : (
                  <button onClick={() => onAction(device, "enable")} className="pill-btn text-xs" disabled={loading || device.source === "env"}>启用</button>
                )}
                <button onClick={() => onAction(device, "rotate-token")} className="pill-btn text-xs" disabled={loading || device.source === "env"}>轮换 Token</button>
                <button onClick={() => onAction(device, "delete")} className="pill-btn text-xs" disabled={loading || device.source === "env"}>删除</button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
