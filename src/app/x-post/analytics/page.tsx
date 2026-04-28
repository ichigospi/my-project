// 自アカウントのアナリティクス: ポスト取得 + 集計 + 伸び比較分析
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import { getApiKey } from "@/lib/channel-store";
import { DEFAULT_X_POST_MODEL, X_POST_MODEL_LABELS, type XPostModel } from "@/lib/x-post-ai";
import type { XCompetitor, XCollectedPost } from "@/lib/x-post-types";
import PostCollectModal from "@/components/x-post/PostCollectModal";
import CsvImportModal from "@/components/x-post/CsvImportModal";

interface SummaryResponse {
  count: number;
  avgLikes: number;
  avgRetweets: number;
  avgImpressions: number;
  maxLikes: number;
  maxRetweets: number;
  maxImpressions: number;
  topPostId: string | null;
  latestPostAt: string | null;
}

interface CompareResult {
  winningPatterns: { pattern: string; evidence: string; category: string }[];
  losingPatterns: { pattern: string; evidence: string; category: string }[];
  diff: string;
  improvementHints: { hint: string; priority: "high" | "medium" | "low"; rationale: string }[];
  topPickToTemplate: { index: number; reason: string }[];
}

interface ComparePostInfo {
  index: number;
  content: string;
  likes: number;
  retweets: number;
  impressions: number;
}

type SortKey = "likes" | "retweets" | "impressions" | "postedAt";

export default function AnalyticsPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  const [selfList, setSelfList] = useState<XCompetitor[]>([]);
  const [selectedSelfId, setSelectedSelfId] = useState<string>("");
  const [posts, setPosts] = useState<XCollectedPost[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 登録モーダル
  const [showRegister, setShowRegister] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newName, setNewName] = useState("");
  const [registering, setRegistering] = useState(false);

  // 取得フォーム
  const [collectingFor, setCollectingFor] = useState<XCompetitor | null>(null);
  const [editingPost, setEditingPost] = useState<XCollectedPost | null>(null);
  const [csvImportFor, setCsvImportFor] = useState<XCompetitor | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  // 比較分析
  const [model, setModel] = useState<XPostModel>(DEFAULT_X_POST_MODEL);
  const [topN, setTopN] = useState(5);
  const [bottomN, setBottomN] = useState(5);
  const [customInstruction, setCustomInstruction] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareTopPosts, setCompareTopPosts] = useState<ComparePostInfo[]>([]);

  const [sortBy, setSortBy] = useState<SortKey>("likes");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cRes = await fetch(`/api/x-post/competitors?genre=${genre}`);
      const cAll: XCompetitor[] = await cRes.json();
      const selves = cAll.filter((c) => c.isSelf);
      setSelfList(selves);

      const targetId =
        selves.find((s) => s.id === selectedSelfId)?.id ?? selves[0]?.id ?? "";
      setSelectedSelfId(targetId);

      if (targetId) {
        const [pRes, sRes] = await Promise.all([
          fetch(`/api/x-post/posts?genre=${genre}`),
          fetch(`/api/x-post/analytics-summary?competitorId=${targetId}`),
        ]);
        const pAll: XCollectedPost[] = await pRes.json();
        setPosts(pAll.filter((p) => p.competitorId === targetId));
        setSummary(await sRes.json());
      } else {
        setPosts([]);
        setSummary(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [genre, selectedSelfId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sortBy === "postedAt") {
        const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return tb - ta;
      }
      return b[sortBy] - a[sortBy];
    });
  }, [posts, sortBy]);

  const selfCompetitor = selfList.find((s) => s.id === selectedSelfId) ?? null;

  const registerSelf = async () => {
    if (!newHandle.trim()) {
      alert("ハンドルは必須です");
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch("/api/x-post/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          handle: newHandle.replace(/^@/, ""),
          name: newName,
          isSelf: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "登録失敗");
        return;
      }
      setShowRegister(false);
      setNewHandle("");
      setNewName("");
      setSelectedSelfId(data.id);
      loadAll();
    } finally {
      setRegistering(false);
    }
  };

  const autoFetch = async () => {
    if (!selfCompetitor) return;
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch(`/api/x-post/competitors/${selfCompetitor.id}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 50, sinceDays: 30 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchMsg(`エラー: ${data.error || res.statusText}`);
        return;
      }
      setFetchMsg(`✓ ${data.saved}件保存（${data.skipped}件は既存スキップ）`);
      loadAll();
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMsg(null), 5000);
    }
  };

  const runCompare = async () => {
    if (!selfCompetitor) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      alert("AI APIキーが未設定です");
      return;
    }
    setAnalyzing(true);
    setCompareResult(null);
    try {
      const res = await fetch("/api/x-post/analytics-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: selfCompetitor.id,
          aiApiKey,
          model,
          topN,
          bottomN,
          customInstruction: customInstruction.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "分析失敗");
        return;
      }
      setCompareResult(data.result);
      setCompareTopPosts(data.topPosts ?? []);
    } finally {
      setAnalyzing(false);
    }
  };

  const extractAsTemplate = async (postContent: string) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      alert("AI APIキーが未設定です");
      return;
    }
    const res = await fetch("/api/x-post/extract-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre, content: postContent, aiApiKey, save: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "テンプレ化失敗");
      return;
    }
    alert(`✓ 「${data.template?.name ?? "(無題)"}」をテンプレに保存しました`);
  };

  // ==================== render ====================

  if (loading) {
    return (
      <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📊</span>
          アナリティクス
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          自分のXアカウントのポスト群から伸びパターン/弱パターンを抽出して改善ヒントを得ます。
        </p>
      </div>

      {selfList.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-700 font-medium">まず自分のアカウントを登録してください</p>
          <p className="text-xs text-gray-500 mt-1">登録後、X APIで自動取得 or 手動ペーストでポストを集めます</p>
          <button
            onClick={() => setShowRegister(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded"
          >
            + 自分のアカウントを登録
          </button>
        </div>
      ) : (
        <>
          {/* アカウント切替 + 登録ボタン */}
          <section className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-500 shrink-0">アカウント:</span>
              <select
                value={selectedSelfId}
                onChange={(e) => setSelectedSelfId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm min-w-0"
              >
                {selfList.map((s) => (
                  <option key={s.id} value={s.id}>🪞 @{s.handle}{s.name && `（${s.name}）`}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowRegister(true)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                + 別アカウント登録
              </button>
              {selfCompetitor && (
                <>
                  <button
                    onClick={() => setCsvImportFor(selfCompetitor)}
                    className="text-xs px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded"
                    title="X analytics CSV を一括取り込み（X API不要）"
                  >
                    📁 CSVインポート
                  </button>
                  <button
                    onClick={() => setCollectingFor(selfCompetitor)}
                    className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded"
                  >
                    📥 手動ペースト追加
                  </button>
                  <button
                    onClick={autoFetch}
                    disabled={fetching}
                    className="text-xs px-3 py-1.5 bg-sky-50 hover:bg-sky-100 disabled:bg-sky-50/50 text-sky-700 rounded"
                    title="X API Bearer Token 必須（設定モーダルで登録）"
                  >
                    {fetching ? "取得中..." : "🔄 X APIで取得"}
                  </button>
                </>
              )}
              {fetchMsg && (
                <span className={`text-xs ${fetchMsg.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>
                  {fetchMsg}
                </span>
              )}
            </div>
          </section>

          {/* 集計カード */}
          {summary && (
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-2">パフォーマンス集計（{summary.count} 件）</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="平均いいね" value={summary.avgLikes} emoji="👍" />
                <StatCard label="平均RT" value={summary.avgRetweets} emoji="🔁" />
                <StatCard label="平均インプ" value={summary.avgImpressions} emoji="📊" />
                <StatCard label="最高いいね" value={summary.maxLikes} emoji="🏆" />
              </div>
            </section>
          )}

          {/* 伸び比較分析 */}
          <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">🔍 伸び比較分析</h3>
            <p className="text-xs text-gray-500">
              いいね数で並べた上位N件と下位N件をAIに渡して、何が伸びの差を生んでいるかを言語化します。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">上位 N 件</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={topN}
                  onChange={(e) => setTopN(Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">下位 N 件</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={bottomN}
                  onChange={(e) => setBottomN(Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-700 mb-1">モデル</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as XPostModel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {Object.entries(X_POST_MODEL_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">追加指示（任意）</label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
                placeholder="例: 教育タイプ別に深く分析して / フックの差を強調して"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={runCompare}
              disabled={analyzing || posts.length < topN + bottomN}
              className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-medium rounded"
            >
              {analyzing ? "分析中..." : `📊 上位${topN}件と下位${bottomN}件を比較分析`}
            </button>
            {posts.length < topN + bottomN && (
              <p className="text-xs text-amber-700">
                合計 {topN + bottomN} 件以上のポストが必要です（現在 {posts.length} 件）
              </p>
            )}
          </section>

          {compareResult && (
            <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">分析結果</h3>
              {compareResult.diff && (
                <div className="text-sm bg-indigo-50 border border-indigo-200 rounded p-3 text-indigo-900">
                  <span className="font-bold">差の核心: </span>{compareResult.diff}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <PatternList title="🏆 伸びたパターン" items={compareResult.winningPatterns} accent="emerald" />
                <PatternList title="⚠️ 伸びなかったパターン" items={compareResult.losingPatterns} accent="rose" />
              </div>
              {compareResult.improvementHints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-2">💡 改善ヒント</h4>
                  <div className="space-y-2">
                    {compareResult.improvementHints.map((h, i) => (
                      <div key={i} className="border border-gray-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            h.priority === "high" ? "bg-red-100 text-red-700"
                            : h.priority === "low" ? "bg-gray-100 text-gray-600"
                            : "bg-amber-100 text-amber-700"
                          }`}>
                            {h.priority === "high" ? "高" : h.priority === "low" ? "低" : "中"}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{h.hint}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{h.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compareResult.topPickToTemplate.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-2">🧪 テンプレ化推奨</h4>
                  <div className="space-y-2">
                    {compareResult.topPickToTemplate.map((t, i) => {
                      const post = compareTopPosts.find((p) => p.index === t.index);
                      return (
                        <div key={i} className="border border-amber-200 bg-amber-50 rounded p-3">
                          <p className="text-xs text-amber-900 mb-1">{t.reason}</p>
                          {post && (
                            <>
                              <pre className="text-xs whitespace-pre-wrap text-gray-800 mb-2">{post.content}</pre>
                              <button
                                onClick={() => extractAsTemplate(post.content)}
                                className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded"
                              >
                                🧪 テンプレ化（保存）
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ポスト一覧 */}
          <section>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-gray-700">取得済みポスト（{posts.length}件）</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-3 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="likes">いいね順</option>
                <option value="retweets">RT順</option>
                <option value="impressions">インプ順</option>
                <option value="postedAt">投稿日順</option>
              </select>
            </div>
            {sortedPosts.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
                まだポストが取得されていません
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPosts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setEditingPost(p)}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-400 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between mb-1 text-xs text-gray-500">
                      <span>{p.postedAt ? new Date(p.postedAt).toLocaleDateString() : "(日付未設定)"}</span>
                      <span className="flex items-center gap-2">
                        <span>👍 {p.likes}</span>
                        <span>🔁 {p.retweets}</span>
                        {p.impressions > 0 && <span>📊 {p.impressions.toLocaleString()}</span>}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {/* 登録モーダル */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">🪞 自分のアカウントを登録</h3>
            <p className="text-xs text-gray-500">
              ジャンル: <strong>{genreLabel}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ハンドル (@) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@your_handle"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">表示名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: 占いマネタイズ垢"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowRegister(false)} className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">
                キャンセル
              </button>
              <button
                onClick={registerSelf}
                disabled={registering}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-1.5 rounded"
              >
                {registering ? "登録中..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ポスト追加・編集モーダル（既存コンポーネント流用） */}
      {collectingFor && (
        <PostCollectModal
          competitor={collectingFor}
          onClose={() => setCollectingFor(null)}
          onSaved={loadAll}
        />
      )}
      {editingPost && (
        <PostCollectModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={loadAll}
        />
      )}
      {csvImportFor && (
        <CsvImportModal
          competitor={csvImportFor}
          onClose={() => setCsvImportFor(null)}
          onImported={loadAll}
        />
      )}
    </main>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500 flex items-center gap-1.5">
        <span>{emoji}</span>{label}
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function PatternList({
  title, items, accent,
}: {
  title: string;
  items: { pattern: string; evidence: string; category: string }[];
  accent: "emerald" | "rose";
}) {
  const accentClass = accent === "emerald"
    ? "border-emerald-200 bg-emerald-50/50"
    : "border-rose-200 bg-rose-50/50";
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-700 mb-2">{title}</h4>
      {items.length === 0 ? (
        <div className="text-xs text-gray-400 border border-gray-200 rounded p-3">該当なし</div>
      ) : (
        <ul className="space-y-2">
          {items.map((p, i) => (
            <li key={i} className={`border rounded p-2 ${accentClass}`}>
              <div className="text-sm font-medium text-gray-900">
                {p.category && <span className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 mr-2">{p.category}</span>}
                {p.pattern}
              </div>
              {p.evidence && <p className="text-xs text-gray-600 mt-1">{p.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
