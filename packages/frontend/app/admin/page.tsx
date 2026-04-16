"use client";

import { useEffect, useMemo, useState } from "react";
import {
  decideEnrollmentRequest,
  fetchEnrollmentRequests,
  type EnrollmentRequestRecord,
} from "@/lib/api";

const STORAGE_KEY = "live_dashboard_admin_secret";

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [requests, setRequests] = useState<EnrollmentRequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionNote, setActionNote] = useState<Record<number, string>>({});

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) || "";
    setAdminSecret(saved);
  }, []);

  async function loadRequests(secret = adminSecret) {
    if (!secret.trim()) {
      setError("请先输入管理员密钥");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await fetchEnrollmentRequests(secret.trim());
      setRequests(rows);
      window.localStorage.setItem(STORAGE_KEY, secret.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: number, action: "approve" | "reject") {
    if (!adminSecret.trim()) {
      setError("请先输入管理员密钥");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await decideEnrollmentRequest(
        adminSecret.trim(),
        action,
        id,
        actionNote[id] || "",
      );
      setRequests((prev) => prev.map((item) => (item.id === id ? updated : item)));
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
              审批设备接入申请，批准后客户端即可领取 token。
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
              placeholder="输入 ADMIN_SECRET"
            />
          </div>
          <button
            onClick={() => loadRequests()}
            className="pill-btn text-xs"
            disabled={loading}
          >
            {loading ? "加载中..." : "加载申请列表"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-3">{error}</p>
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          当前待审批：{pendingCount} 台设备
        </p>
      </section>

      <section className="space-y-3">
        {requests.length === 0 ? (
          <div className="vn-bubble">
            <p className="text-sm">还没有设备申请记录。</p>
          </div>
        ) : (
          requests.map((item) => (
            <article key={item.id} className="card-decorated rounded-xl p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">设备：</span>{item.device_name}</p>
                  <p><span className="font-semibold">ID：</span><code>{item.device_id}</code></p>
                  <p><span className="font-semibold">平台：</span>{item.platform}</p>
                  <p><span className="font-semibold">状态：</span>{item.status}</p>
                  <p><span className="font-semibold">申请时间：</span>{item.created_at}</p>
                  {item.admin_note && (
                    <p><span className="font-semibold">备注：</span>{item.admin_note}</p>
                  )}
                </div>

                <div className="lg:w-80 w-full">
                  <label className="block text-xs font-medium mb-1">审批备注</label>
                  <textarea
                    value={actionNote[item.id] ?? item.admin_note ?? ""}
                    onChange={(e) =>
                      setActionNote((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="w-full min-h-24 rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none"
                    placeholder="可选：填写审批说明"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAction(item.id, "approve")}
                      className="pill-btn text-xs"
                      disabled={loading || item.status === "approved"}
                    >
                      批准
                    </button>
                    <button
                      onClick={() => handleAction(item.id, "reject")}
                      className="pill-btn text-xs"
                      disabled={loading || item.status === "rejected"}
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
