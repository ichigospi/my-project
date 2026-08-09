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
  postFormat: string;
  tags: string;
  purpose: string;
  structureJson: string;
  isHot: boolean;
  multiplier: number | null;
  multiplierBasis: "views" | "likes" | null;
  competitor: { handle: string; name: string };
}

interface Competitor {
  id: string;
  handle: string;
}

interface TagCat {
  id: string;
  accountId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
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
  const [minViews, setMinViews] = useState("");
  const [tagFilter, setTagFilter] = useState(searchParams.get("tag") ?? "");
  const [sort, setSort] = useState("likes");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classifying, setClassifying] = useState(false);
  const [message, setMessage] = useState("");
  // ライブラリ抽出モーダル
  const [extractFrom, setExtractFrom] = useState<CompetitorPost | null>(null);
  const [extractForm, setExtractForm] = useState({ type: "hook", title: "", content: "" });
  // タグ分類（大/中/小）
  const [tagCats, setTagCats] = useState<TagCat[]>([]);
  const [showTagMgr, setShowTagMgr] = useState(false);
  const [openBig, setOpenBig] = useState<Set<string>>(new Set());
  const [editTagsPost, setEditTagsPost] = useState<{ id: string; tags: string[] } | null>(null);
  const [freeTag, setFreeTag] = useState("");

  const loadCats = useCallback(async () => {
    if (!accountId) return;
    try {
      const r = await api<{ categories: TagCat[] }>(`/api/threads/tag-categories?accountId=${accountId}`);
      setTagCats(r.categories);
    } catch {
      // ignore
    }
  }, [accountId]);

  const childrenOf = (pid: string | null) => tagCats.filter((c) => (c.parentId ?? null) === pid);

  const addCat = async (parentId: string | null, isBig: boolean) => {
    const name = window.prompt(isBig ? "大カテゴリ名" : parentId ? "小カテゴリ名" : "中カテゴリ名");
    if (!name?.trim()) return;
    await api("/api/threads/tag-categories", { method: "POST", body: JSON.stringify({ accountId, parentId, name: name.trim() }) });
    await loadCats();
  };
  const renameCat = async (c: TagCat) => {
    const name = window.prompt("新しい名前", c.name);
    if (!name?.trim() || name.trim() === c.name) return;
    await api(`/api/threads/tag-categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
    await loadCats();
  };
  const deleteCat = async (c: TagCat) => {
    if (!window.confirm(`「${c.name}」とその配下カテゴリを削除しますか？（投稿のタグ自体は消えません）`)) return;
    await api(`/api/threads/tag-categories/${c.id}`, { method: "DELETE" });
    await loadCats();
  };

  const openTagEdit = (p: CompetitorPost) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse(p.tags || "[]") as string[];
    } catch {
      tags = [];
    }
    setFreeTag("");
    setEditTagsPost({ id: p.id, tags });
  };
  const togglePostTag = (name: string) =>
    setEditTagsPost((e) => (e ? { ...e, tags: e.tags.includes(name) ? e.tags.filter((t) => t !== name) : [...e.tags, name] } : e));
  const savePostTags = async () => {
    if (!editTagsPost) return;
    await api(`/api/threads/competitor-posts/${editTagsPost.id}`, { method: "PATCH", body: JSON.stringify({ tags: editTagsPost.tags }) });
    setEditTagsPost(null);
    await loadPosts();
  };

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
      if (minViews && Number(minViews) > 0) params.set("minViews", String(Number(minViews)));
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      const res = await api<{ total: number; posts: CompetitorPost[] }>(`/api/threads/competitor-posts?${params}`);
      setPosts(res.posts);
      setTotal(res.total);
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [accountId, competitorId, planType, hotOnly, minViews, tagFilter, sort, page]);

  useEffect(() => {
    loadCompetitors();
    loadCats();
  }, [loadCompetitors, loadCats]);

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
          <option value="recent">新しい順</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-neutral-300">
          <input type="checkbox" checked={hotOnly} onChange={(e) => { setHotOnly(e.target.checked); setPage(1); }} />
          🔥伸びてる投稿のみ
        </label>
        {tagFilter && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-indigo-500/30 text-indigo-100">
            #{tagFilter}
            <button onClick={() => { setTagFilter(""); setPage(1); }} className="hover:text-white">×</button>
          </span>
        )}
        <span className="text-xs text-neutral-500 ml-auto">{total}件</span>
        {selected.size > 0 && (
          <button onClick={runClassify} disabled={classifying} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50">
            {classifying ? "分類中..." : `選択${selected.size}件を再分析`}
          </button>
        )}
      </div>

      {/* タグ分類で絞り込み（押すだけ検索） */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-neutral-200">🏷 タグで絞り込み</span>
          <button onClick={() => setShowTagMgr(true)} className="text-[11px] px-2 py-1 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800">
            ⚙️ タグ分類を管理
          </button>
        </div>
        {childrenOf(null).length === 0 ? (
          <p className="text-[11px] text-neutral-500">
            まだタグ分類がありません。「⚙️タグ分類を管理」で大/中/小カテゴリを作ると、ここに押すだけの検索ボタンが並びます。
          </p>
        ) : (
          <div className="space-y-1.5">
            {childrenOf(null).map((big) => {
              const opened = openBig.has(big.id);
              return (
                <div key={big.id} className="rounded-lg bg-neutral-950/50 border border-neutral-800">
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <button
                      onClick={() =>
                        setOpenBig((s) => {
                          const n = new Set(s);
                          if (n.has(big.id)) n.delete(big.id); else n.add(big.id);
                          return n;
                        })
                      }
                      className="text-[11px] text-neutral-400 hover:text-neutral-200 w-4"
                    >
                      {opened ? "▼" : "▶"}
                    </button>
                    <button
                      onClick={() => { setTagFilter(big.name); setPage(1); }}
                      className={`text-xs font-bold px-2 py-0.5 rounded ${tagFilter === big.name ? "bg-white text-black" : "text-neutral-100 hover:bg-neutral-800"}`}
                    >
                      {big.name}
                    </button>
                  </div>
                  {opened && (
                    <div className="px-3 pb-2 space-y-1.5">
                      {childrenOf(big.id).map((mid) => (
                        <div key={mid.id} className="flex items-start gap-2 flex-wrap">
                          <button
                            onClick={() => { setTagFilter(mid.name); setPage(1); }}
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${tagFilter === mid.name ? "bg-white text-black" : "text-neutral-300 hover:bg-neutral-800"}`}
                          >
                            {mid.name}
                          </button>
                          <div className="flex flex-wrap gap-1">
                            {childrenOf(mid.id).map((small) => (
                              <button
                                key={small.id}
                                onClick={() => { setTagFilter(small.name); setPage(1); }}
                                className={`text-[11px] px-2 py-0.5 rounded-full ${tagFilter === small.name ? "bg-indigo-500 text-white" : "bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/30"}`}
                              >
                                {small.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {childrenOf(big.id).length === 0 && (
                        <p className="text-[10px] text-neutral-600">（中カテゴリ未作成）</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                    {p.multiplier != null && p.multiplier >= 1.5 && (
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${p.multiplier >= 3 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}
                        title={`直近10投稿の中央値に対する${p.multiplierBasis === "views" ? "表示回数" : "いいね"}の倍率`}
                      >
                        {p.multiplierBasis === "views" ? "👁" : "❤️"}×{p.multiplier}
                      </span>
                    )}
                    {(p.postFormat === "tree" || p.postFormat === "long") && (
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
                        {p.postFormat === "tree" ? "🌳長文ツリー" : "📄長文"}
                      </span>
                    )}
                    {p.planType && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{p.planType}</span>}
                    {p.hookType && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{p.hookType}</span>}
                    <span className="text-neutral-500">{fmtDate(p.postedAt)}</span>
                  </div>
                  <p className={`text-sm text-neutral-200 mt-2 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-3"}`}>{p.content}</p>
                  {/* 企画の目的・タグ */}
                  {(() => {
                    let tagList: string[] = [];
                    try {
                      tagList = JSON.parse(p.tags || "[]") as string[];
                    } catch {
                      tagList = [];
                    }
                    if (tagList.length === 0 && !p.purpose) return null;
                    return (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {p.purpose && <span className="text-[11px] text-neutral-400">🎯{p.purpose}</span>}
                        {tagList.map((t) => (
                          <button
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(t);
                              setPage(1);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/40"
                            title="このタグで絞り込み"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 flex-wrap">
                    {/* Threadsは競合の閲覧数を公開しないため、値がある場合（手入力等）のみ表示 */}
                    {p.views > 0 && <span>👁 {fmtNum(p.views)}</span>}
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
                    <button onClick={() => openTagEdit(p)} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                      🏷 タグ編集
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

      {/* タグ分類の管理（大/中/小） */}
      {showTagMgr && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowTagMgr(false)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-2xl p-5 my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-100">タグ分類の管理</h3>
              <button onClick={() => setShowTagMgr(false)} className="text-sm text-neutral-400 hover:text-white">閉じる</button>
            </div>
            <p className="text-[11px] text-neutral-500">大 → 中 → 小 の3階層で設計できます。名前がそのままタグとして検索・付与に使われます。</p>
            <button onClick={() => addCat(null, true)} className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200">
              ＋ 大カテゴリを追加
            </button>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {childrenOf(null).map((big) => (
                <div key={big.id} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-neutral-100">📁 {big.name}</span>
                    <button onClick={() => renameCat(big)} className="text-[10px] text-neutral-400 hover:text-neutral-200 underline">改名</button>
                    <button onClick={() => deleteCat(big)} className="text-[10px] text-rose-400 hover:text-rose-300 underline">削除</button>
                    <button onClick={() => addCat(big.id, false)} className="text-[10px] px-2 py-0.5 rounded border border-neutral-600 text-neutral-300 hover:bg-neutral-800">＋中カテゴリ</button>
                  </div>
                  <div className="mt-1.5 pl-3 space-y-1.5">
                    {childrenOf(big.id).map((mid) => (
                      <div key={mid.id} className="border-l border-neutral-800 pl-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-neutral-200">{mid.name}</span>
                          <button onClick={() => renameCat(mid)} className="text-[10px] text-neutral-400 hover:text-neutral-200 underline">改名</button>
                          <button onClick={() => deleteCat(mid)} className="text-[10px] text-rose-400 hover:text-rose-300 underline">削除</button>
                          <button onClick={() => addCat(mid.id, false)} className="text-[10px] px-2 py-0.5 rounded border border-neutral-600 text-neutral-300 hover:bg-neutral-800">＋小カテゴリ</button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {childrenOf(mid.id).map((small) => (
                            <span key={small.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200">
                              {small.name}
                              <button onClick={() => renameCat(small)} className="hover:text-white">✏️</button>
                              <button onClick={() => deleteCat(small)} className="hover:text-rose-300">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {childrenOf(null).length === 0 && <p className="text-xs text-neutral-500">まだありません。「＋大カテゴリを追加」から作成してください。</p>}
            </div>
          </div>
        </div>
      )}

      {/* 投稿のタグ編集 */}
      {editTagsPost && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditTagsPost(null)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-lg p-5 my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-100">投稿のタグ編集</h3>
            {/* 現在のタグ */}
            <div>
              <span className="text-[11px] text-neutral-400">付いているタグ</span>
              <div className="flex flex-wrap gap-1.5 mt-1 min-h-[1.5rem]">
                {editTagsPost.tags.length === 0 && <span className="text-[11px] text-neutral-600">なし</span>}
                {editTagsPost.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-100">
                    #{t}
                    <button onClick={() => togglePostTag(t)} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </div>
            {/* 分類から選ぶ */}
            {childrenOf(null).length > 0 && (
              <div>
                <span className="text-[11px] text-neutral-400">分類から選ぶ（タップでON/OFF）</span>
                <div className="space-y-1.5 mt-1 max-h-[40vh] overflow-y-auto">
                  {childrenOf(null).map((big) => (
                    <div key={big.id}>
                      <div className="text-[11px] font-bold text-neutral-300">{big.name}</div>
                      {childrenOf(big.id).map((mid) => (
                        <div key={mid.id} className="flex items-center gap-1.5 flex-wrap pl-2 mt-0.5">
                          <span className="text-[10px] text-neutral-500">{mid.name}:</span>
                          {[mid, ...childrenOf(mid.id)].map((node) => (
                            <button
                              key={node.id}
                              onClick={() => togglePostTag(node.name)}
                              className={`text-[11px] px-2 py-0.5 rounded-full ${editTagsPost.tags.includes(node.name) ? "bg-indigo-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}
                            >
                              {node === mid ? `＝${node.name}` : node.name}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 自由入力 */}
            <div className="flex gap-2">
              <input
                value={freeTag}
                onChange={(e) => setFreeTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && freeTag.trim()) {
                    togglePostTag(freeTag.trim());
                    setFreeTag("");
                  }
                }}
                placeholder="自由にタグ追加してEnter"
                className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => { if (freeTag.trim()) { togglePostTag(freeTag.trim()); setFreeTag(""); } }}
                className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-800"
              >
                追加
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditTagsPost(null)} className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800">キャンセル</button>
              <button onClick={savePostTags} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-neutral-200">保存</button>
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
