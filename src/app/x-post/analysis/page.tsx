"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import { getApiKey } from "@/lib/channel-store";
import {
  X_POST_MODEL_LABELS,
  type XPostModel,
  DEFAULT_X_POST_MODEL,
} from "@/lib/x-post-ai";
import {
  parseAnalysisResult,
  type AnalysisResult,
} from "@/lib/x-post-analysis-types";
import type {
  XCollectedPost,
  XCompetitor,
  XPostAnalysisRecord,
} from "@/lib/x-post-types";
import AnalysisResultView from "@/components/x-post/AnalysisResultView";

export default function AnalysisPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  const [posts, setPosts] = useState<XCollectedPost[]>([]);
  const [competitors, setCompetitors] = useState<XCompetitor[]>([]);
  const [analyses, setAnalyses] = useState<XPostAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterCompetitorId, setFilterCompetitorId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"likes" | "collectedAt">("likes");

  // 分析実行
  const [customInstruction, setCustomInstruction] = useState("");
  const [model, setModel] = useState<XPostModel>(DEFAULT_X_POST_MODEL);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 結果表示
  const [activeAnalysis, setActiveAnalysis] = useState<XPostAnalysisRecord | null>(null);
  const [activeResult, setActiveResult] = useState<AnalysisResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, aRes] = await Promise.all([
        fetch(`/api/x-post/posts?genre=${genre}`),
        fetch(`/api/x-post/competitors?genre=${genre}`),
        fetch(`/api/x-post/analyses?genre=${genre}`),
      ]);
      const pData: XCollectedPost[] = await pRes.json();
      const cData: XCompetitor[] = await cRes.json();
      const aData: XPostAnalysisRecord[] = await aRes.json();
      setPosts(pData);
      setCompetitors(cData);
      setAnalyses(aData);
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  // ジャンル変更時は選択をリセット
  useEffect(() => {
    setSelectedIds(new Set());
    setActiveAnalysis(null);
    setActiveResult(null);
  }, [genre]);

  const filteredPosts = useMemo(() => {
    let list = posts;
    if (filterCompetitorId !== "all") {
      list = list.filter((p) => p.competitorId === filterCompetitorId);
    }
    return [...list].sort((a, b) => {
      if (sortBy === "likes") return b.likes - a.likes;
      return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
    });
  }, [posts, filterCompetitorId, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const runAnalysis = async () => {
    if (selectedIds.size === 0) {
      setError("分析対象のポストを選択してください");
      return;
    }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが未設定です。YTツール側の設定ページから登録してください。");
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/x-post/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          postIds: Array.from(selectedIds),
          customInstruction: customInstruction.trim() || undefined,
          model,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "分析失敗");
        return;
      }
      // 成功
      setActiveAnalysis(data.analysis);
      setActiveResult(data.result);
      setCustomInstruction("");
      load(); // 一覧再取得
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const openAnalysis = (a: XPostAnalysisRecord) => {
    setActiveAnalysis(a);
    if (a.result) {
      const { result } = parseAnalysisResult(a.result);
      setActiveResult(result);
    } else {
      setActiveResult(null);
    }
  };

  const deleteAnalysis = async (a: XPostAnalysisRecord) => {
    if (!confirm("この分析を削除しますか？")) return;
    const res = await fetch(`/api/x-post/analyses/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    if (activeAnalysis?.id === a.id) {
      setActiveAnalysis(null);
      setActiveResult(null);
    }
    load();
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>🔍</span>
          伸びてるポスト分析
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          収集した競合ポストをAIが分析して、構造・フック・強化要素・教育タイプ・自アカ転用ヒントを抽出。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-4">
        {/* 左: 分析対象選択 */}
        <section className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <h3 className="text-sm font-bold text-gray-900 mb-2">📋 分析対象ポストを選ぶ</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={filterCompetitorId}
                onChange={(e) => setFilterCompetitorId(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="all">競合: 全て</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>@{c.handle}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "likes" | "collectedAt")}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="likes">いいね順</option>
                <option value="collectedAt">収集日順</option>
              </select>
              <span className="text-xs text-gray-500 ml-auto">
                {selectedIds.size} / {filteredPosts.length} 選択
              </span>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={selectAll}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                全選択
              </button>
              <button
                onClick={clearSelect}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                解除
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">読み込み中...</div>
            ) : filteredPosts.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-500">収集ポストがありません</p>
                <p className="text-xs text-gray-400 mt-1">
                  「競合」タブでポストを収集してください
                </p>
              </div>
            ) : (
              filteredPosts.map((p) => (
                <PostSelectItem
                  key={p.id}
                  post={p}
                  selected={selectedIds.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                />
              ))
            )}
          </div>

          {/* 分析実行フォーム */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                追加指示（任意）
              </label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
                placeholder="例: 特に冒頭フックに注目して分析してください"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">モデル:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as XPostModel)}
                className="px-2 py-1 border border-gray-300 rounded text-xs flex-1"
              >
                {Object.entries(X_POST_MODEL_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runAnalysis}
              disabled={running || selectedIds.size === 0}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded transition-colors"
            >
              {running ? "🤖 分析中... (1〜2分かかります)" : `✨ ${selectedIds.size}件を分析`}
            </button>
          </div>
        </section>

        {/* 右: 分析結果 + 履歴 */}
        <section className="space-y-3">
          {activeAnalysis && activeResult ? (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    分析 #{activeAnalysis.id.slice(-6)}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(activeAnalysis.createdAt).toLocaleString()} ・
                    対象 {JSON.parse(activeAnalysis.postIds || "[]").length} 件
                  </p>
                </div>
                <button
                  onClick={() => deleteAnalysis(activeAnalysis)}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                >
                  削除
                </button>
              </div>
              <AnalysisResultView result={activeResult} />
            </>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm text-gray-500">
                左でポストを選んで「分析」を実行
              </p>
              <p className="text-xs text-gray-400 mt-1">
                または下の履歴から過去の分析を開く
              </p>
            </div>
          )}

          {/* 履歴 */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-3 py-2 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">📚 過去の分析（{analyses.length}件）</h3>
            </div>
            {analyses.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-500">まだ分析履歴がありません</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
                {analyses.map((a) => {
                  const ids = (() => {
                    try { return JSON.parse(a.postIds || "[]") as string[]; } catch { return []; }
                  })();
                  return (
                    <button
                      key={a.id}
                      onClick={() => openAnalysis(a)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                        activeAnalysis?.id === a.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                        <span>#{a.id.slice(-6)} ・ {ids.length}件</span>
                        <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-2">{a.summary || "(サマリなし)"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// ============================================================
// PostSelectItem
// ============================================================

function PostSelectItem({
  post,
  selected,
  onToggle,
}: {
  post: XCollectedPost;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left bg-white border rounded-md p-2.5 transition ${
        selected ? "border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/30" : "border-gray-200 hover:border-indigo-300"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          className="mt-1 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-gray-500 truncate">@{post.competitor.handle}</span>
            <span className="text-xs text-gray-500 shrink-0">👍{post.likes} 🔁{post.retweets}</span>
          </div>
          <p className="text-xs text-gray-800 line-clamp-2 whitespace-pre-wrap">{post.content}</p>
        </div>
      </div>
    </button>
  );
}
