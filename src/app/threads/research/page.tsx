"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, fmtDate, fmtNum, getAiKey, getThreadsModel } from "@/lib/threads-client";
import { PLAN_TYPES } from "@/lib/threads-prompts";

interface CompetitorPost {
  id: string;
  content: string;
  postUrl: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  postedAt: string | null;
  planType: string;
  hookType: string;
  structureJson: string;
  isHot: boolean;
  competitor: { handle: string; name: string };
}

interface Competitor {
  id: string;
  handle: string;
}

interface Structure {
  hook?: string;
  body?: string;
  closing?: string;
  rhythm?: string;
  whyItWorks?: string;
}

function parseStructure(json: string): Structure | null {
  try {
    const s = JSON.parse(json || "{}") as Structure;
    return s.hook || s.whyItWorks ? s : null;
  } catch {
    return null;
  }
}

function ResearchContent() {
  const [accountId] = useThreadsAccountId();
  const searchParams = useSearchParams();
  const [competitorId, setCompetitorId] = useState(searchParams.get("competitorId") ?? "");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [posts, setPosts] = useState<CompetitorPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [planType, setPlanType] = useState("");
  const [hotOnly, setHotOnly] = useState(false);
  const [sort, setSort] = useState("likes");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState("");
  // ライブラリ抽出モーダル
  const [extractFrom, setExtractFrom] = useState<CompetitorPost | null>(null);
  const [extractForm, setExtractForm] = useState({ type: "hook", title: "", content: "" });

  const loadCompetitors = useCallback(async () => {
    if (!accountId) return;
    try {
      setCompetitors(await api<Competitor[]>(`/api/threads/competitors?accountId=${accountId}`));
    } catch {
      // ignore
    }
  }, [accountId]);

  const loadPosts = useCallback(async () => {
    if (!accountId) return;
    try {
      const params = new URLSearchParams({ accountId, sort, page: String(page) });
      if (competitorId) params.set("competitorId", competitorId);
      if (planType) params.set("planType", planType);
      if (hotOnly) params.set("hot", "1");
      const res = await api<{ total: number; posts: CompetitorPost[] }>(`/api/threads/competitor-posts?${params}`);
      setPosts(res.posts);
      setTotal(res.total);
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [accountId, competitorId, planType, hotOnly, sort, page]);

  useEffect(() => {
    loadCompetitors();
  }, [loadCompetitors]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runClassify = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setMessage("エラー: AI APIキーが未設定です");
      return;
    }
    if (selected.size === 0) return;
    setClassifying(true);
    setMessage("");
    try {
      const res = await api<{ updated: number }>("/api/threads/competitor-posts/classify", {
        method: "POST",
        body: JSON.stringify({ postIds: Array.from(selected), aiApiKey, model: getThreadsModel() }),
      });
      setMessage(`✅ ${res.updated}件を分類しました`);
      setSelected(new Set());
      await loadPosts();
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClassifying(false);
    }
  };

  const toggleHot = async (p: CompetitorPost) => {
    await api(`/api/threads/competitor-posts/${p.id}`, { method: "PATCH", body: JSON.stringify({ isHot: !p.isHot }) });
    await loadPosts();
  };

  const removePost = async (p: CompetitorPost) => {
    if (!confirm("この投稿を削除しますか？")) return;
    await api(`/api/threads/competitor-posts/${p.id}`, { method: "DELETE" });
    await loadPosts();
  };

  const openExtract = (p: CompetitorPost, type: "hook" | "plan" | "cta") => {
    const s = parseStructure(p.structureJson);
    const firstLine = p.content.split("\n").find((l) => l.trim()) ?? "";
    setExtractForm({
      type,
      title: type === "hook" ? p.hookType || "フック" : type === "plan" ? p.planType || "企画" : "CTA",
      content: type === "hook" ? s?.hook || firstLine : type === "plan" ? `${p.planType}: ${s?.body ?? ""}` : s?.closing ?? "",
    });
    setExtractFrom(p);
  };

  const saveExtract = async () => {
    if (!extractFrom || !extractForm.title.trim() || !extractForm.content.trim()) return;
    await api("/api/threads/library", {
      method: "POST",
      body: JSON.stringify({
        accountId,
        type: extractForm.type,
        title: extractForm.title,
        content: extractForm.content,
        sourcePostId: extractFrom.id,
      }),
    });
    setExtractFrom(null);
    setMessage("✅ ライブラリに登録しました");
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">リサーチ</h2>
        <p className="text-sm text-neutral-400 mt-1">収集した競合投稿を企画タイプ別に探し、オマージュ元を選びます。</p>
      </div>

      {/* フィルタ */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 flex flex-wrap items-center gap-2 text-sm">
        <select value={competitorId} onChange={(e) => { setCompetitorId(e.target.value); setPage(1); }} className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs">
          <option value="">全競合</option>
          {competitors.map((c) => (
            <option key={c.id} value={c.id}>@{c.handle}</option>
          ))}
        </select>
        <select value={planType} onChange={(e) => { setPlanType(e.target.value); setPage(1); }} className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs">
          <option value="">全企画タイプ</option>
          {PLAN_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs">
          <option value="likes">いいね順</option>
          <option value="views">表示回数順</option>
          <option value="recent">新しい順</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-neutral-300">
          <input type="checkbox" checked={hotOnly} onChange={(e) => { setHotOnly(e.target.checked); setPage(1); }} />
          🔥伸びてる投稿のみ
        </label>
        <span className="text-xs text-neutral-500 ml-auto">{total}件</span>
        {selected.size > 0 && (
          <button onClick={runClassify} disabled={classifying} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50">
            {classifying ? "分類中..." : `選択${selected.size}件を再分析`}
          </button>
        )}
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
          {message}
        </div>
      )}

      {/* 投稿一覧 */}
      <div className="space-y-3">
        {posts.map((p) => {
          const s = parseStructure(p.structureJson);
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className={`bg-neutral-900 rounded-xl border p-4 ${p.isHot ? "border-orange-500/50" : "border-neutral-800"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-neutral-300">@{p.competitor.handle}</span>
                    {p.isHot && <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">🔥伸び</span>}
                    {p.planType && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{p.planType}</span>}
                    {p.hookType && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{p.hookType}</span>}
                    <span className="text-neutral-500">{fmtDate(p.postedAt)}</span>
                  </div>
                  <p className={`text-sm text-neutral-200 mt-2 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-3"}`}>{p.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 flex-wrap">
                    <span>👁 {fmtNum(p.views)}</span>
                    <span>❤️ {fmtNum(p.likes)}</span>
                    <span>💬 {fmtNum(p.replies)}</span>
                    <span>🔁 {fmtNum(p.reposts)}</span>
                    {p.postUrl && (
                      <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">元投稿↗</a>
                    )}
                  </div>

                  {isOpen && s && (
                    <div className="mt-3 bg-neutral-800/50 rounded-lg p-3 text-xs text-neutral-300 space-y-1.5">
                      {s.hook && <p><span className="font-bold">フック:</span> {s.hook}</p>}
                      {s.body && <p><span className="font-bold">展開:</span> {s.body}</p>}
                      {s.closing && <p><span className="font-bold">締め:</span> {s.closing}</p>}
                      {s.rhythm && <p><span className="font-bold">リズム:</span> {s.rhythm}</p>}
                      {s.whyItWorks && <p className="text-emerald-400"><span className="font-bold">伸びた理由:</span> {s.whyItWorks}</p>}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Link href={`/threads/create?refA=${p.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-neutral-200">
                      ✏️ この投稿から作成
                    </Link>
                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                      {isOpen ? "閉じる" : "分析を見る"}
                    </button>
                    <button onClick={() => openExtract(p, "hook")} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                      🧲 フック登録
                    </button>
                    <button onClick={() => openExtract(p, "cta")} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                      CTA登録
                    </button>
                    <button onClick={() => toggleHot(p)} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                      🔥{p.isHot ? "解除" : "伸び認定"}
                    </button>
                    <button onClick={() => removePost(p)} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">
                      削除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <div className="bg-neutral-900 rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
            投稿がありません。<Link href="/threads/competitors" className="text-sky-400 underline">ベンチマーク</Link>から取り込んでください。
          </div>
        )}
      </div>

      {/* ページネーション */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 disabled:opacity-40">← 前</button>
          <span className="text-neutral-500">{page} / {Math.ceil(total / 50)}</span>
          <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 disabled:opacity-40">次 →</button>
        </div>
      )}

      {/* ライブラリ抽出モーダル */}
      {extractFrom && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setExtractFrom(null)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-lg p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100">ライブラリに登録</h3>
            <div className="flex gap-2">
              {(["hook", "plan", "cta"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setExtractForm({ ...extractForm, type: t })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg ${extractForm.type === t ? "bg-white text-black" : "bg-neutral-800 text-neutral-400"}`}
                >
                  {t === "hook" ? "フック" : t === "plan" ? "企画" : "CTA"}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-neutral-300">タイトル</span>
              <input value={extractForm.title} onChange={(e) => setExtractForm({ ...extractForm, title: e.target.value })} className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-300">内容</span>
              <textarea value={extractForm.content} onChange={(e) => setExtractForm({ ...extractForm, content: e.target.value })} rows={5} className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setExtractFrom(null)} className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800">キャンセル</button>
              <button onClick={saveExtract} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200">登録</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ThreadsResearchPage() {
  return (
    <Suspense fallback={<main className="px-6 py-6 text-sm text-neutral-500">読み込み中...</main>}>
      <ResearchContent />
    </Suspense>
  );
}
