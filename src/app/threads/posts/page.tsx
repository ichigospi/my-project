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
          <h2 className="text-2xl font-bold text-neutral-100">投稿管理</h2>
          <p className="text-sm text-neutral-400 mt-1">承認 → 予定日時セット → スマホで手動投稿 → URL登録 → 実績入力、の流れで管理します。</p>
        </div>
        <Link href="/threads/create" className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200">
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
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${status === f.value ? "bg-white text-black" : "bg-neutral-900 border border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-neutral-500 self-center ml-auto">{total}件</span>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
          {message}
        </div>
      )}

      {/* テーブル（PCは表、モバイルはカード） */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
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
                <tr key={d.id} onClick={() => setOpenId(d.id)} className="border-b border-neutral-800 hover:bg-neutral-800/60 cursor-pointer align-top">
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-200">
                    <span className="line-clamp-2 whitespace-pre-wrap">{d.content || "（本文なし）"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">
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
                  <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap">
                    {fmtDate(d.scheduledAt)}
                    {d.publishedAt && <div className="text-emerald-400">済 {fmtDate(d.publishedAt)}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutral-300 whitespace-nowrap">
                    {d.status === "published" ? (
                      <>
                        {fmtNum(d.views)} / {fmtNum(d.likes)} / {fmtNum(d.replies)} / {fmtNum(d.reposts)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">
                    <span className="line-clamp-2">{d.insight || d.ownerComment || "—"}</span>
                  </td>
                </tr>
              );
            })}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                  投稿案がありません。<Link href="/threads/create" className="text-sky-400 underline">作成画面</Link>から作りましょう。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 disabled:opacity-40">← 前</button>
          <span className="text-neutral-500">{page} / {Math.ceil(total / 50)}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 disabled:opacity-40">次 →</button>
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
    <div className="bg-neutral-800/50 rounded-lg p-3">
      <div className="text-[11px] text-neutral-500 flex items-center gap-2 flex-wrap">
        <span className="font-bold">参考{label}: @{r.authorHandle}</span>
        <span>👁{fmtNum(r.views ?? 0)}</span>
        <span>❤️{fmtNum(r.likes ?? 0)}</span>
        <span>💬{fmtNum(r.replies ?? 0)}</span>
        <span>🔁{fmtNum(r.reposts ?? 0)}</span>
        {r.postedAt && <span>{fmtDate(r.postedAt)}</span>}
        {r.postUrl && (
          <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">元投稿↗</a>
        )}
      </div>
      <p className="text-xs text-neutral-300 mt-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto">{r.content}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" onClick={onClose}>
      <div className="bg-neutral-900 w-full max-w-xl h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.cls}`}>{st.label}</span>
            <span className="text-[11px] text-neutral-500">作成 {fmtDate(draft.createdAt)}</span>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-xl leading-none">×</button>
        </div>

        {/* 本文 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300">投稿本文</span>
            <div className="flex gap-2">
              <button onClick={copyContent} className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200">
                {copied ? "✅ コピーしました" : "📋 本文をコピー"}
              </button>
              <Link href={`/threads/create?draftId=${draft.id}`} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                💬 壁打ち
              </Link>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => content !== draft.content && patch({ content }, "content")}
            rows={8}
            className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-neutral-500">{content.length}文字（編集は自動保存）</p>
        </div>

        {/* 参考投稿 */}
        {refA && refBlock("A", refA)}
        {refB && refBlock("B", refB)}

        {/* 運用: 承認 → 予定 → 投稿済み */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-3">
          <span className="text-xs font-bold text-neutral-300">運用ステータス</span>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
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
                className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                却下
              </button>
            )}
          </div>

          <div className="flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="text-[11px] text-neutral-500">投稿予定日時</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-0.5 block border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-sm"
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
            <div className="bg-neutral-800/60 border border-neutral-700 rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-neutral-200 font-bold">📱 スマホで投稿したら:</p>
              <div className="flex gap-2">
                <input
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs"
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
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              ✅ {fmtDate(draft.publishedAt)} に投稿済み
              {draft.postUrl && (
                <a href={draft.postUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">投稿を見る↗</a>
              )}
            </div>
          )}
        </div>

        {/* 実績入力 */}
        {draft.status === "published" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300">実績（Threadsアプリの数字を入力）</span>
              {draft.metricsUpdatedAt && <span className="text-[10px] text-neutral-500">最終更新 {fmtDate(draft.metricsUpdatedAt)}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                ["views", "👁 表示"],
                ["likes", "❤️ いいね"],
                ["replies", "💬 コメント"],
                ["reposts", "🔁 リポスト"],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[10px] text-neutral-500">{label}</span>
                  <input
                    type="number"
                    value={metrics[key]}
                    onChange={(e) => setMetrics({ ...metrics, [key]: Number(e.target.value) })}
                    className="mt-0.5 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-sm"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => patch(metrics, "metrics")}
              disabled={busy !== ""}
              className="w-full text-xs py-2 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-50"
            >
              実績を保存（履歴に記録されます）
            </button>
          </div>
        )}

        {/* 考察・オーナーコメント */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300">考察</span>
              {draft.status === "published" && (
                <button onClick={genInsight} disabled={busy === "insight-ai"} className="text-[11px] px-2 py-1 rounded-lg border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50">
                  {busy === "insight-ai" ? "生成中..." : "🤖 AIに下書きさせる"}
                </button>
              )}
            </div>
            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              onBlur={() => insight !== draft.insight && patch({ insight }, "insight")}
              rows={3}
              className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              placeholder="なぜ伸びた/伸びなかったか、次に活かすこと"
            />
          </div>
          <div>
            <span className="text-xs font-bold text-neutral-300">オーナーコメント</span>
            <textarea
              value={ownerComment}
              onChange={(e) => setOwnerComment(e.target.value)}
              onBlur={() => ownerComment !== draft.ownerComment && patch({ ownerComment }, "ownerComment")}
              rows={2}
              className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              placeholder="オーナーからのフィードバック"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800 flex justify-end">
          <button onClick={removeDraft} className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">
            この投稿案を削除
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ThreadsPostsPage() {
  return (
    <Suspense fallback={<main className="px-6 py-6 text-sm text-neutral-500">読み込み中...</main>}>
      <PostsContent />
    </Suspense>
  );
}
