"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useThreadsAccountId } from "@/lib/threads-account";
import {
  api,
  fmtDate,
  fmtNum,
  getAiKey,
  getThreadsModel,
  parseSnapshot,
  toLocalInputValue,
  DRAFT_STATUS_LABELS,
  type RefSnapshotView,
} from "@/lib/threads-client";

interface DraftRow {
  id: string;
  content: string;
  refASnapshot: string;
  refBSnapshot: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  postUrl: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  metricsUpdatedAt: string | null;
  insight: string;
  ownerComment: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "approved", label: "承認済" },
  { value: "scheduled", label: "予約中" },
  { value: "published", label: "投稿済" },
  { value: "rejected", label: "却下" },
];

function PostsContent() {
  const [accountId] = useThreadsAccountId();
  const searchParams = useSearchParams();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(searchParams.get("draftId"));
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const params = new URLSearchParams({ accountId, page: String(page) });
      if (status) params.set("status", status);
      const res = await api<{ total: number; drafts: DraftRow[] }>(`/api/threads/drafts?${params}`);
      setDrafts(res.drafts);
      setTotal(res.total);
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [accountId, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openDraft = drafts.find((d) => d.id === openId) ?? null;

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">投稿管理</h2>
          <p className="text-sm text-gray-600 mt-1">承認 → 予定日時セット → スマホで手動投稿 → URL登録 → 実績入力、の流れで管理します。</p>
        </div>
        <Link href="/threads/create" className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
          + 新規作成
        </Link>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${status === f.value ? "bg-gray-900 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 self-center ml-auto">{total}件</span>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
          {message}
        </div>
      )}

      {/* テーブル（PCは表、モバイルはカード） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left px-3 py-2.5 font-medium">状態</th>
              <th className="text-left px-3 py-2.5 font-medium w-[36%]">投稿案</th>
              <th className="text-left px-3 py-2.5 font-medium">参考A / B</th>
              <th className="text-left px-3 py-2.5 font-medium">予定日時</th>
              <th className="text-right px-3 py-2.5 font-medium">実績（表示/❤️/💬/🔁）</th>
              <th className="text-left px-3 py-2.5 font-medium">考察</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const refA = parseSnapshot(d.refASnapshot);
              const refB = parseSnapshot(d.refBSnapshot);
              const st = DRAFT_STATUS_LABELS[d.status] ?? DRAFT_STATUS_LABELS.draft;
              return (
                <tr key={d.id} onClick={() => setOpenId(d.id)} className="border-b border-gray-100 hover:bg-teal-50/40 cursor-pointer align-top">
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-800">
                    <span className="line-clamp-2 whitespace-pre-wrap">{d.content || "（本文なし）"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {refA ? (
                      <span title={refA.content}>A: @{refA.authorHandle} ❤️{fmtNum(refA.likes ?? 0)}</span>
                    ) : (
                      <span>—</span>
                    )}
                    {refB && (
                      <>
                        <br />
                        <span title={refB.content}>B: @{refB.authorHandle} ❤️{fmtNum(refB.likes ?? 0)}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {fmtDate(d.scheduledAt)}
                    {d.publishedAt && <div className="text-emerald-600">済 {fmtDate(d.publishedAt)}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
                    {d.status === "published" ? (
                      <>
                        {fmtNum(d.views)} / {fmtNum(d.likes)} / {fmtNum(d.replies)} / {fmtNum(d.reposts)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    <span className="line-clamp-2">{d.insight || d.ownerComment || "—"}</span>
                  </td>
                </tr>
              );
            })}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                  投稿案がありません。<Link href="/threads/create" className="text-teal-600 underline">作成画面</Link>から作りましょう。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">← 前</button>
          <span className="text-gray-500">{page} / {Math.ceil(total / 50)}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">次 →</button>
        </div>
      )}

      {openDraft && (
        <DraftDrawer
          draft={openDraft}
          onClose={() => setOpenId(null)}
          onChanged={async (msg) => {
            if (msg) setMessage(msg);
            await load();
          }}
        />
      )}
    </main>
  );
}

// 詳細ドロワー: フィールド単位で保存（同時編集で消えない）
function DraftDrawer({
  draft,
  onClose,
  onChanged,
}: {
  draft: DraftRow;
  onClose: () => void;
  onChanged: (msg?: string) => Promise<void>;
}) {
  const [content, setContent] = useState(draft.content);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(draft.scheduledAt));
  const [postUrl, setPostUrl] = useState(draft.postUrl);
  const [metrics, setMetrics] = useState({
    views: draft.views,
    likes: draft.likes,
    replies: draft.replies,
    reposts: draft.reposts,
  });
  const [insight, setInsight] = useState(draft.insight);
  const [ownerComment, setOwnerComment] = useState(draft.ownerComment);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const refA = parseSnapshot(draft.refASnapshot);
  const refB = parseSnapshot(draft.refBSnapshot);
  const st = DRAFT_STATUS_LABELS[draft.status] ?? DRAFT_STATUS_LABELS.draft;

  const patch = async (data: Record<string, unknown>, label: string) => {
    setBusy(label);
    try {
      await api(`/api/threads/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify(data) });
      await onChanged();
    } catch (e) {
      await onChanged(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const genInsight = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) return;
    setBusy("insight-ai");
    try {
      const res = await api<{ insight: string }>(`/api/threads/drafts/${draft.id}/insight`, {
        method: "POST",
        body: JSON.stringify({ aiApiKey, model: getThreadsModel() }),
      });
      setInsight(res.insight);
      await api(`/api/threads/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ insight: res.insight }) });
      await onChanged();
    } catch (e) {
      await onChanged(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const removeDraft = async () => {
    if (!confirm("この投稿案を削除しますか？")) return;
    await api(`/api/threads/drafts/${draft.id}`, { method: "DELETE" });
    await onChanged("✅ 削除しました");
    onClose();
  };

  const refBlock = (label: string, r: RefSnapshotView) => (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
        <span className="font-bold">参考{label}: @{r.authorHandle}</span>
        <span>👁{fmtNum(r.views ?? 0)}</span>
        <span>❤️{fmtNum(r.likes ?? 0)}</span>
        <span>💬{fmtNum(r.replies ?? 0)}</span>
        <span>🔁{fmtNum(r.reposts ?? 0)}</span>
        {r.postedAt && <span>{fmtDate(r.postedAt)}</span>}
        {r.postUrl && (
          <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">元投稿↗</a>
        )}
      </div>
      <p className="text-xs text-gray-700 mt-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto">{r.content}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.cls}`}>{st.label}</span>
            <span className="text-[11px] text-gray-400">作成 {fmtDate(draft.createdAt)}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* 本文 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">投稿本文</span>
            <div className="flex gap-2">
              <button onClick={copyContent} className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-700">
                {copied ? "✅ コピーしました" : "📋 本文をコピー"}
              </button>
              <Link href={`/threads/create?draftId=${draft.id}`} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                💬 壁打ち
              </Link>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => content !== draft.content && patch({ content }, "content")}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-gray-400">{content.length}文字（編集は自動保存）</p>
        </div>

        {/* 参考投稿 */}
        {refA && refBlock("A", refA)}
        {refB && refBlock("B", refB)}

        {/* 運用: 承認 → 予定 → 投稿済み */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          <span className="text-xs font-bold text-gray-700">運用ステータス</span>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={["approved", "scheduled", "published"].includes(draft.status)}
                disabled={draft.status === "published" || busy !== ""}
                onChange={(e) => patch({ status: e.target.checked ? "approved" : "draft" }, "status")}
              />
              投稿可（承認）
            </label>
            {draft.status !== "published" && (
              <button
                onClick={() => patch({ status: "rejected" }, "status")}
                className="text-xs px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                却下
              </button>
            )}
          </div>

          <div className="flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="text-[11px] text-gray-500">投稿予定日時</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-0.5 block border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={() =>
                patch(
                  {
                    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
                    ...(scheduledAt && ["approved", "scheduled"].includes(draft.status) ? { status: "scheduled" } : {}),
                  },
                  "schedule",
                )
              }
              className="text-xs px-3 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600"
            >
              予定をセット
            </button>
          </div>

          {draft.status !== "published" ? (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-teal-900 font-bold">📱 スマホで投稿したら:</p>
              <div className="flex gap-2">
                <input
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                  placeholder="投稿URLを貼り付け"
                />
                <button
                  onClick={() => patch({ status: "published", postUrl }, "publish")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 whitespace-nowrap"
                >
                  投稿済みにする
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              ✅ {fmtDate(draft.publishedAt)} に投稿済み
              {draft.postUrl && (
                <a href={draft.postUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">投稿を見る↗</a>
              )}
            </div>
          )}
        </div>

        {/* 実績入力 */}
        {draft.status === "published" && (
          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">実績（Threadsアプリの数字を入力）</span>
              {draft.metricsUpdatedAt && <span className="text-[10px] text-gray-400">最終更新 {fmtDate(draft.metricsUpdatedAt)}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                ["views", "👁 表示"],
                ["likes", "❤️ いいね"],
                ["replies", "💬 コメント"],
                ["reposts", "🔁 リポスト"],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[10px] text-gray-500">{label}</span>
                  <input
                    type="number"
                    value={metrics[key]}
                    onChange={(e) => setMetrics({ ...metrics, [key]: Number(e.target.value) })}
                    className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => patch(metrics, "metrics")}
              disabled={busy !== ""}
              className="w-full text-xs py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
            >
              実績を保存（履歴に記録されます）
            </button>
          </div>
        )}

        {/* 考察・オーナーコメント */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">考察</span>
              {draft.status === "published" && (
                <button onClick={genInsight} disabled={busy === "insight-ai"} className="text-[11px] px-2 py-1 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                  {busy === "insight-ai" ? "生成中..." : "🤖 AIに下書きさせる"}
                </button>
              )}
            </div>
            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              onBlur={() => insight !== draft.insight && patch({ insight }, "insight")}
              rows={3}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="なぜ伸びた/伸びなかったか、次に活かすこと"
            />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700">オーナーコメント</span>
            <textarea
              value={ownerComment}
              onChange={(e) => setOwnerComment(e.target.value)}
              onBlur={() => ownerComment !== draft.ownerComment && patch({ ownerComment }, "ownerComment")}
              rows={2}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="オーナーからのフィードバック"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button onClick={removeDraft} className="text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
            この投稿案を削除
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ThreadsPostsPage() {
  return (
    <Suspense fallback={<main className="px-6 py-6 text-sm text-gray-500">読み込み中...</main>}>
      <PostsContent />
    </Suspense>
  );
}
