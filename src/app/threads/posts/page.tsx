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
  filesToDataUrls,
  DRAFT_STATUS_LABELS,
  THREADS_EDU_TYPES,
  eduColor,
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
  eduTags: string;
  createdAt: string;
  updatedAt: string;
}

interface EduBalance {
  totalPosts: number;
  taggedPosts: number;
  untaggedPosts: number;
  balance: { tag: string; count: number; avgViews: number; avgLikes: number }[];
}

function parseEduTags(json: string | undefined): string[] {
  try {
    const p = JSON.parse(json || "[]");
    return Array.isArray(p) ? (p.filter((t) => typeof t === "string") as string[]) : [];
  } catch {
    return [];
  }
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
  const [eduBalance, setEduBalance] = useState<EduBalance | null>(null);

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

  const loadEduBalance = useCallback(async () => {
    if (!accountId) return;
    try {
      setEduBalance(await api<EduBalance>(`/api/threads/stats/edu-balance?accountId=${accountId}`));
    } catch {
      // ignore
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadEduBalance();
  }, [loadEduBalance]);

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

      {/* 教育バランス（投稿済みで実施した教育の配分） */}
      <EduBalancePanel data={eduBalance} />

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
                    {(() => {
                      const tags = parseEduTags(d.eduTags);
                      if (tags.length === 0) return null;
                      return (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {tags.map((t) => {
                            const idx = THREADS_EDU_TYPES.indexOf(t as (typeof THREADS_EDU_TYPES)[number]);
                            return (
                              <span
                                key={t}
                                className="text-[9px] px-1.5 py-0.5 rounded-full text-black font-bold"
                                style={{ backgroundColor: eduColor(idx >= 0 ? idx : 0) }}
                              >
                                {t}
                              </span>
                            );
                          })}
                        </span>
                      );
                    })()}
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
            await loadEduBalance();
          }}
        />
      )}
    </main>
  );
}

// 教育バランス: 実施した教育の配分を横棒グラフで表示
function EduBalancePanel({ data }: { data: EduBalance | null }) {
  if (!data || data.totalPosts === 0) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-neutral-200">🎓 教育バランス</span>
          <span className="text-[11px] text-neutral-500">投稿済みで実施した教育の配分</span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          まだ実績がありません。作成時に「行った教育」を選んで保存し、投稿済みにすると、ここに配分が表示されます。
        </p>
      </div>
    );
  }
  // 表示順は11教育型の定義順に揃える（未実施も薄く並べてバランスの偏りを見やすく）
  const countMap = new Map(data.balance.map((b) => [b.tag, b]));
  const maxCount = Math.max(1, ...data.balance.map((b) => b.count));
  const rows: { tag: string; index: number; count: number; avgViews: number; avgLikes: number }[] =
    THREADS_EDU_TYPES.map((tag, i) => ({
      tag,
      index: i,
      count: countMap.get(tag)?.count ?? 0,
      avgViews: countMap.get(tag)?.avgViews ?? 0,
      avgLikes: countMap.get(tag)?.avgLikes ?? 0,
    }));
  // 定義外のタグ（自由入力等）も末尾に足す
  for (const b of data.balance) {
    if (!THREADS_EDU_TYPES.includes(b.tag as (typeof THREADS_EDU_TYPES)[number])) {
      rows.push({ tag: b.tag, index: rows.length, count: b.count, avgViews: b.avgViews, avgLikes: b.avgLikes });
    }
  }
  const doneKinds = data.balance.length;

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-neutral-200">🎓 教育バランス</span>
        <span className="text-[11px] text-neutral-500">投稿済みで実施した教育の配分</span>
        <span className="ml-auto text-[11px] text-neutral-400">
          投稿済 {data.totalPosts}件 / 教育タグ付き {data.taggedPosts}件・{doneKinds}種
          {data.untaggedPosts > 0 && <span className="text-neutral-600">（未タグ {data.untaggedPosts}件）</span>}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.tag} className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-300 w-28 shrink-0 text-right truncate" title={r.tag}>{r.tag}</span>
            <div className="flex-1 h-5 bg-neutral-950 rounded overflow-hidden relative">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(r.count / maxCount) * 100}%`,
                  backgroundColor: r.count > 0 ? eduColor(r.index) : "transparent",
                  opacity: r.count > 0 ? 0.85 : 1,
                }}
              />
            </div>
            <span className="text-[11px] text-neutral-300 w-8 shrink-0 tabular-nums">{r.count}</span>
            <span className="text-[10px] text-neutral-500 w-24 shrink-0 tabular-nums hidden sm:block">
              {r.count > 0 ? `👁${fmtNum(r.avgViews)}/❤️${fmtNum(r.avgLikes)}` : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-neutral-600">
        棒＝実施した投稿数。右の数値は平均（表示回数/いいね）。偏り（やっていない教育）が一目で分かります。
      </p>
    </div>
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
  const [eduTags, setEduTags] = useState<string[]>(parseEduTags(draft.eduTags));
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [metricMsg, setMetricMsg] = useState("");
  // 画像（一覧APIは軽量化のためmediaUrlsを持たないので、詳細から取得）
  const [images, setImages] = useState<string[]>([]);
  const [imageStyle, setImageStyle] = useState("");
  const [imageMsg, setImageMsg] = useState("");

  const loadImages = useCallback(async () => {
    try {
      const detail = await api<{ mediaUrls: string }>(`/api/threads/drafts/${draft.id}`);
      setImages(JSON.parse(detail.mediaUrls || "[]") as string[]);
    } catch {
      // ignore
    }
  }, [draft.id]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const genImage = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setImageMsg("エラー: AI APIキーが未設定です");
      return;
    }
    setBusy("image");
    setImageMsg("");
    try {
      const res = await api<{ image: string; description: string }>(`/api/threads/drafts/${draft.id}/image`, {
        method: "POST",
        body: JSON.stringify({ aiApiKey, model: getThreadsModel(), styleInstruction: imageStyle }),
      });
      setImages((prev) => [...prev, res.image]);
      setImageMsg(`✅ 生成しました: ${res.description}`);
    } catch (e) {
      setImageMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const removeImage = async (index: number) => {
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    await api(`/api/threads/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ mediaUrls: JSON.stringify(next) }) });
  };

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

  // 実施した教育タグをトグル（即PATCH保存）
  const toggleEdu = async (edu: string) => {
    const next = eduTags.includes(edu) ? eduTags.filter((t) => t !== edu) : [...eduTags, edu];
    setEduTags(next);
    await patch({ eduTags: next }, "edu");
  };

  // 投稿後のスクショから実績を読み取って各フィールドに反映
  const readMetricsFromScreenshot = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setMetricMsg("エラー: AI APIキーが未設定です（設定画面で登録）");
      return;
    }
    setBusy("read-metrics");
    setMetricMsg("");
    try {
      const images = await filesToDataUrls(Array.from(files), 1600, 6);
      const res = await api<{ views: number; likes: number; replies: number; reposts: number }>(
        `/api/threads/drafts/${draft.id}/read-metrics`,
        { method: "POST", body: JSON.stringify({ aiApiKey, model: getThreadsModel(), images }) },
      );
      setMetrics({ views: res.views, likes: res.likes, replies: res.replies, reposts: res.reposts });
      setMetricMsg(`✅ 読み取りました（👁${fmtNum(res.views)} ❤️${fmtNum(res.likes)} 💬${fmtNum(res.replies)} 🔁${fmtNum(res.reposts)}）。内容を確認して「実績を保存」を押してください。`);
    } catch (e) {
      setMetricMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
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

        {/* 画像生成 */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
          <span className="text-xs font-bold text-neutral-300">🎨 画像（投稿と一緒にアップする用）</span>
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((src, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`画像${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-neutral-700" />
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1.5 bg-black/60 rounded-lg">
                    <a
                      href={src}
                      download={`threads-image-${i + 1}.jpg`}
                      className="text-[10px] px-2 py-1 rounded bg-white text-black font-bold"
                    >
                      保存
                    </a>
                    <button onClick={() => removeImage(i)} className="text-[10px] px-2 py-1 rounded bg-rose-600 text-white font-bold">
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={imageStyle}
              onChange={(e) => setImageStyle(e.target.value)}
              className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs"
              placeholder="スタイル指定（任意）例: 温かい写真調 / 和風イラスト"
            />
            <button
              onClick={genImage}
              disabled={busy === "image"}
              className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-50 whitespace-nowrap"
            >
              {busy === "image" ? "生成中...（1分弱）" : "🎨 画像を生成"}
            </button>
          </div>
          {imageMsg && (
            <p className={`text-[11px] ${imageMsg.startsWith("✅") ? "text-emerald-300" : "text-rose-300"}`}>{imageMsg}</p>
          )}
          <p className="text-[10px] text-neutral-600">投稿本文からAIが画像プロンプトを作り、OpenAI（設定画面のキー）で生成します。スマホ投稿時は「保存」して一緒にアップしてください。</p>
        </div>

        {/* 参考投稿 */}
        {refA && refBlock("A", refA)}
        {refB && refBlock("B", refB)}

        {/* 実施した教育タグ（教育バランスに反映） */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
          <span className="text-xs font-bold text-neutral-300">🎓 この投稿で行った教育（複数可）</span>
          <div className="flex flex-wrap gap-1.5">
            {THREADS_EDU_TYPES.map((edu, i) => {
              const on = eduTags.includes(edu);
              return (
                <button
                  key={edu}
                  type="button"
                  disabled={busy === "edu"}
                  onClick={() => toggleEdu(edu)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                    on ? "text-black font-bold border-transparent" : "text-neutral-400 border-neutral-700 hover:border-neutral-500"
                  }`}
                  style={on ? { backgroundColor: eduColor(i) } : undefined}
                >
                  {edu}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-600">選ぶと即保存。教育バランス（上部グラフ）に反映されます。</p>
        </div>

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
            {/* スクショから自動読み取り */}
            <label className={`flex items-center justify-center gap-2 w-full text-xs py-2 rounded-lg border border-dashed border-sky-500/40 text-sky-300 hover:bg-sky-500/10 cursor-pointer ${busy === "read-metrics" ? "opacity-50 pointer-events-none" : ""}`}>
              {busy === "read-metrics" ? "読み取り中..." : "📸 投稿後のスクショから表示回数を読み取る"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  readMetricsFromScreenshot(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {metricMsg && (
              <p className={`text-[11px] ${metricMsg.startsWith("✅") ? "text-emerald-300" : "text-rose-300"}`}>{metricMsg}</p>
            )}
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
