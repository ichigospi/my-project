// 履歴・承認: 生成ドラフトの一覧、承認フロー、エスカレーション案件の確認
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { categoryLabel } from "@/lib/reply-prompts";

interface DraftRecord {
  id: string;
  customerName: string;
  customerMessage: string;
  category: string;
  isEscalation: boolean;
  escalationReason: string;
  confidence: string;
  reasoning: string;
  draft: string;
  finalReply: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "すべて" },
  { value: "pending_approval", label: "承認待ち" },
  { value: "escalated", label: "🚨 本人対応" },
  { value: "sent", label: "送信済み" },
  { value: "draft", label: "下書き" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  pending_approval: { label: "承認待ち", cls: "bg-blue-100 text-blue-700" },
  approved: { label: "承認済み", cls: "bg-green-100 text-green-700" },
  sent: { label: "送信済み", cls: "bg-green-100 text-green-700" },
  escalated: { label: "🚨 本人対応", cls: "bg-red-100 text-red-700" },
};

export default function ReplyHistoryPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role || "";
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const canApprove = isLocal || role === "admin" || role === "owner";

  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reply/drafts${filter ? `?status=${filter}` : ""}`);
      const data = await res.json();
      if (res.ok) setDrafts(data);
      else setError(data.error || "読み込みに失敗しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reply/drafts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "更新に失敗しました");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("このドラフトを削除しますか？")) return;
    await fetch(`/api/reply/drafts/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {drafts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">ドラフトがありません</p>
        )}
        {drafts.map((d) => {
          const open = openId === d.id;
          const badge = STATUS_BADGE[d.status] || STATUS_BADGE.draft;
          return (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <button
                onClick={() => {
                  setOpenId(open ? null : d.id);
                  setEditText(d.finalReply || d.draft);
                }}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                    <span className="text-xs text-gray-500">{categoryLabel(d.category)}</span>
                    {d.customerName && <span className="text-xs font-medium text-gray-700">{d.customerName} さま</span>}
                    <span className="text-xs text-gray-400">
                      {new Date(d.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {d.createdByName && <span className="text-xs text-gray-400">by {d.createdByName}</span>}
                  </div>
                  <p className="text-sm text-gray-700 truncate">{d.customerMessage}</p>
                </div>
                <span className="text-gray-400 text-sm shrink-0">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">お客様のメッセージ</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{d.customerMessage}</p>
                  </div>

                  {d.isEscalation ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-bold text-red-700">🚨 オーナー本人の対応が必要</p>
                      <p className="text-sm text-red-700 mt-1">{d.escalationReason}</p>
                    </div>
                  ) : (
                    <>
                      {d.reasoning && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">判断根拠</p>
                          <p className="text-sm text-gray-600">{d.reasoning}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">返信文</p>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={8}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(editText)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          📋 コピー
                        </button>
                        {d.status === "pending_approval" && canApprove && (
                          <button
                            onClick={() => update(d.id, { finalReply: editText, status: "approved", saveAsExample: true })}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium"
                          >
                            承認する（実例集にも追加）
                          </button>
                        )}
                        {(d.status === "approved" || d.status === "draft") && (
                          <button
                            onClick={() => update(d.id, { finalReply: editText, status: "sent" })}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium"
                          >
                            送信済みにする
                          </button>
                        )}
                        <button
                          onClick={() => remove(d.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 ml-auto"
                        >
                          削除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
