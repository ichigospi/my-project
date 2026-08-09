"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, filesToDataUrls, fmtDate, fmtNum, getAiKey, getThreadsModel } from "@/lib/threads-client";

interface Insights {
  hooks: string[];
  strongWords: string[];
  growthPatterns: string[];
  toneNotes: string[];
  logicNotes: string[];
  analyzedCount?: number;
}

interface AnalyzeResult {
  summary: string;
  growingTraits: string[];
  notGrowingTraits: string[];
  logicSuggestions: string[];
  insights: Insights;
}

const EMPTY_INSIGHTS: Insights = { hooks: [], strongWords: [], growthPatterns: [], toneNotes: [], logicNotes: [] };

const INSIGHT_GROUPS: { key: keyof Insights; label: string; emoji: string }[] = [
  { key: "hooks", label: "伸びてるフック", emoji: "🪝" },
  { key: "strongWords", label: "刺さる強ワード", emoji: "💥" },
  { key: "growthPatterns", label: "伸びやすい傾向", emoji: "📈" },
  { key: "toneNotes", label: "効いてる口調", emoji: "🗣️" },
  { key: "logicNotes", label: "勝ち筋ロジック", emoji: "🎯" },
];

interface PostRow {
  id: string;
  content: string;
  publishedAt: string | null;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

interface Analytics {
  publishedCount: number;
  totals: { views: number; likes: number; replies: number; reposts: number };
  averages: { views: number; likes: number; replies: number; reposts: number };
  planTypes: { planType: string; count: number; avgViews: number; avgLikes: number; avgReplies: number }[];
  topPosts: PostRow[];
  recent: PostRow[];
}

export default function ThreadsAnalyticsPage() {
  const [accountId] = useThreadsAccountId();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"top" | "recent">("top");

  // スクショ傾向分析
  const [aImages, setAImages] = useState<string[]>([]);
  const [aNote, setANote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aResult, setAResult] = useState<AnalyzeResult | null>(null);
  const [aError, setAError] = useState("");
  const [applied, setApplied] = useState<Set<number>>(new Set());
  // 蓄積された学習データ
  const [storedInsights, setStoredInsights] = useState<Insights>(EMPTY_INSIGHTS);
  const [insightsSaved, setInsightsSaved] = useState(false);

  // アカウントの現在の学習データを読み込む
  const loadInsights = useCallback(async () => {
    if (!accountId) return;
    try {
      const list = await api<{ id: string; learnedInsights?: string }[]>("/api/threads/accounts");
      const acc = list.find((a) => a.id === accountId);
      if (acc?.learnedInsights) {
        const parsed = JSON.parse(acc.learnedInsights) as Partial<Insights>;
        setStoredInsights({ ...EMPTY_INSIGHTS, ...parsed });
      } else {
        setStoredInsights(EMPTY_INSIGHTS);
      }
    } catch {
      setStoredInsights(EMPTY_INSIGHTS);
    }
  }, [accountId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // 分析で得た最新学習データをアカウントに保存（蓄積更新）
  const saveInsights = async () => {
    if (!aResult || !accountId) return;
    try {
      await api(`/api/threads/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify({ learnedInsights: JSON.stringify(aResult.insights) }),
      });
      setStoredInsights({ ...EMPTY_INSIGHTS, ...aResult.insights });
      setInsightsSaved(true);
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    }
  };

  const runAnalyze = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setAError("AI APIキーが未設定です（設定画面で登録してください）");
      return;
    }
    if (aImages.length === 0 && !aNote.trim()) {
      setAError("投稿スクショを1枚以上入れてください（テキスト補足のみでも可）");
      return;
    }
    setAnalyzing(true);
    setAError("");
    setAResult(null);
    setApplied(new Set());
    setInsightsSaved(false);
    try {
      const res = await api<AnalyzeResult>("/api/threads/analytics/analyze", {
        method: "POST",
        body: JSON.stringify({
          accountId: accountId || undefined,
          images: aImages.length > 0 ? aImages : undefined,
          pastedText: aNote.trim() || undefined,
          aiApiKey,
          model: getThreadsModel(),
        }),
      });
      setAResult(res);
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  // 提案を投稿ロジックに追記
  const applyToLogic = async (text: string, idx: number) => {
    if (!accountId) {
      setAError("アカウントが選択されていません");
      return;
    }
    try {
      const list = await api<{ id: string; logic: string }[]>("/api/threads/accounts");
      const acc = list.find((a) => a.id === accountId);
      const cur = acc?.logic ?? "";
      const newLogic = cur.trim() ? `${cur.trim()}\n・${text}` : `・${text}`;
      await api(`/api/threads/accounts/${accountId}`, { method: "PATCH", body: JSON.stringify({ logic: newLogic }) });
      setApplied((prev) => new Set(prev).add(idx));
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    }
  };

  const applyAll = async () => {
    if (!aResult) return;
    for (let i = 0; i < aResult.logicSuggestions.length; i++) {
      if (!applied.has(i)) await applyToLogic(aResult.logicSuggestions[i], i);
    }
  };

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setData(await api<Analytics>(`/api/threads/analytics?accountId=${accountId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data
    ? [
        { label: "投稿数", value: String(data.publishedCount) },
        { label: "平均表示", value: fmtNum(data.averages.views) },
        { label: "平均いいね", value: fmtNum(data.averages.likes) },
        { label: "平均コメント", value: fmtNum(data.averages.replies) },
        { label: "合計表示", value: fmtNum(data.totals.views) },
        { label: "合計いいね", value: fmtNum(data.totals.likes) },
      ]
    : [];

  const rows = data ? (tab === "top" ? data.topPosts : data.recent) : [];

  return (
    <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">アナリティクス</h2>
        <p className="text-sm text-neutral-400 mt-1">
          投稿済みの実績を集計します（実績は投稿管理で入力。Phase 2でスクレイパー自動化予定）。
        </p>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">{error}</div>}

      {/* スクショから傾向分析 */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-neutral-100">🔬 スクショから傾向分析 → 学習データに蓄積</h3>
          <p className="text-xs text-neutral-500 mt-1">
            自分の投稿スクショ（表示回数・いいねが写ったもの）を入れて分析すると、AIが傾向を出し、アカウントの<span className="text-neutral-300">学習データ</span>に<span className="text-neutral-300">マージ更新</span>します。学習データは生成に自動反映され、使うほど精度が上がります。
          </p>
        </div>

        {/* 蓄積された学習データ（常時表示） */}
        {(() => {
          const total = INSIGHT_GROUPS.reduce((s, g) => s + (storedInsights[g.key] as string[]).length, 0);
          return (
            <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-neutral-200">📚 このアカウントの学習データ</span>
                {storedInsights.analyzedCount ? (
                  <span className="text-[10px] text-neutral-500">分析{storedInsights.analyzedCount}回分を蓄積</span>
                ) : null}
              </div>
              {total === 0 ? (
                <p className="text-[11px] text-neutral-500">まだ空です。下で投稿スクショを分析すると、ここに「フック/強ワード/傾向/口調/ロジック」が溜まっていきます。</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {INSIGHT_GROUPS.map((g) => {
                    const items = storedInsights[g.key] as string[];
                    if (items.length === 0) return null;
                    return (
                      <div key={g.key}>
                        <div className="text-[11px] font-bold text-neutral-300 mb-1">{g.emoji} {g.label}</div>
                        <div className="flex flex-wrap gap-1">
                          {items.map((it, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">{it}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 cursor-pointer whitespace-nowrap">
            📷 投稿スクショを選択
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                const urls = await filesToDataUrls(files, 1600, 10);
                setAImages((prev) => [...prev, ...urls].slice(0, 10));
                e.target.value = "";
              }}
            />
          </label>
          {aImages.length > 0 && (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {aImages.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`投稿${i + 1}`} className="h-10 w-10 object-cover rounded border border-neutral-600" />
                ))}
              </div>
              <span className="text-[11px] text-neutral-500">{aImages.length}枚</span>
              <button onClick={() => setAImages([])} className="text-[11px] text-neutral-500 hover:text-neutral-300 underline">
                クリア
              </button>
            </>
          )}
          <button
            onClick={runAnalyze}
            disabled={analyzing}
            className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            {analyzing ? "分析中...（30秒〜1分）" : "傾向を分析する"}
          </button>
        </div>
        <textarea
          value={aNote}
          onChange={(e) => setANote(e.target.value)}
          rows={2}
          className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs"
          placeholder="（任意）補足があれば。例: 最近リーチが落ちてる / この2枚が特に伸びた 等"
        />
        <p className="text-[10px] text-neutral-600">最大10枚。表示回数やいいね数が写っているほど精度が上がります。保存済みの投稿実績も自動で加味します。</p>

        {aError && <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-300">{aError}</div>}

        {aResult && (
          <div className="space-y-3 pt-1">
            {aResult.summary && (
              <p className="text-xs text-neutral-300 bg-neutral-800/50 rounded-lg p-3 leading-relaxed">{aResult.summary}</p>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-lg p-3">
                <h4 className="text-xs font-bold text-emerald-300 mb-1.5">📈 伸びる投稿の傾向</h4>
                <ul className="space-y-1 text-xs text-neutral-200 list-disc list-inside">
                  {aResult.growingTraits.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/25 rounded-lg p-3">
                <h4 className="text-xs font-bold text-rose-300 mb-1.5">📉 伸びない投稿の傾向</h4>
                <ul className="space-y-1 text-xs text-neutral-200 list-disc list-inside">
                  {aResult.notGrowingTraits.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-amber-200">💡 投稿ロジックに加えると良い提案</h4>
                {aResult.logicSuggestions.length > 0 && (
                  <button
                    onClick={applyAll}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-400/10 whitespace-nowrap"
                  >
                    すべて投稿ロジックに追記
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {aResult.logicSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-1 text-xs text-neutral-200">{s}</span>
                    <button
                      onClick={() => applyToLogic(s, i)}
                      disabled={applied.has(i)}
                      className={`text-[11px] px-2 py-1 rounded-lg whitespace-nowrap ${
                        applied.has(i)
                          ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                          : "bg-white text-black font-bold hover:bg-neutral-200"
                      }`}
                    >
                      {applied.has(i) ? "✓ 追記済み" : "＋ ロジックに追記"}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-neutral-600 mt-2">
                追記先は選択中アカウントの「投稿ロジック」。<Link href="/threads/accounts" className="text-sky-400 underline">アカウント編集</Link>で確認・調整できます。
              </p>
            </div>

            {/* 学習データに反映（蓄積更新） */}
            <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <h4 className="text-xs font-bold text-indigo-200">🧠 今回の分析を反映した「最新の学習データ」</h4>
                <button
                  onClick={saveInsights}
                  disabled={insightsSaved}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-bold whitespace-nowrap ${
                    insightsSaved ? "bg-emerald-500/20 text-emerald-300 cursor-default" : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {insightsSaved ? "✓ 学習データに反映済み" : "📥 この内容を学習データに反映（蓄積）"}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {INSIGHT_GROUPS.map((g) => {
                  const items = (aResult.insights?.[g.key] as string[]) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <div className="text-[11px] font-bold text-neutral-300 mb-1">{g.emoji} {g.label}</div>
                      <div className="flex flex-wrap gap-1">
                        {items.map((it, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200">{it}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-neutral-600 mt-2">
                反映すると上の「📚学習データ」が更新され、以降の生成（かんたん生成含む）に自動で効きます。
              </p>
            </div>
          </div>
        )}
      </div>

      {data && data.publishedCount === 0 ? (
        <div className="bg-neutral-900 rounded-xl border border-dashed border-neutral-700 p-10 text-center text-sm text-neutral-500">
          まだ投稿済みのデータがありません。
          <Link href="/threads/posts" className="text-sky-400 underline ml-1">投稿管理</Link>
          で「投稿済みにする」+ 実績入力をすると、ここに集計が表示されます。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
                <div className="text-xs text-neutral-500">{c.label}</div>
                <div className="text-2xl font-bold text-neutral-100 mt-1">{c.value}</div>
              </div>
            ))}
          </div>

          {data && data.planTypes.length > 0 && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
              <h3 className="text-sm font-bold text-neutral-100 mb-3">企画タイプ × 成績（オマージュ元の分類ベース・平均いいね順）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="text-left px-2 py-2 font-medium">企画タイプ</th>
                      <th className="text-right px-2 py-2 font-medium">投稿数</th>
                      <th className="text-right px-2 py-2 font-medium">平均表示</th>
                      <th className="text-right px-2 py-2 font-medium">平均いいね</th>
                      <th className="text-right px-2 py-2 font-medium">平均コメント</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.planTypes.map((p) => (
                      <tr key={p.planType} className="border-b border-neutral-800/60">
                        <td className="px-2 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{p.planType}</span>
                        </td>
                        <td className="px-2 py-2 text-right text-neutral-300">{p.count}</td>
                        <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.avgViews)}</td>
                        <td className="px-2 py-2 text-right text-neutral-100 font-bold">{fmtNum(p.avgLikes)}</td>
                        <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.avgReplies)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">→ 平均いいねが高い企画タイプを、リサーチ画面のフィルタで深掘りして次のオマージュ元に。</p>
            </div>
          )}

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-neutral-100">投稿別実績</h3>
              <div className="inline-flex rounded-lg bg-neutral-800 p-0.5 ml-2">
                {([
                  ["top", "いいね順"],
                  ["recent", "新しい順"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${tab === v ? "bg-neutral-900 text-neutral-100 shadow" : "text-neutral-400 hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="text-left px-2 py-2 font-medium w-[45%]">投稿</th>
                    <th className="text-left px-2 py-2 font-medium">投稿日時</th>
                    <th className="text-right px-2 py-2 font-medium">表示</th>
                    <th className="text-right px-2 py-2 font-medium">❤️</th>
                    <th className="text-right px-2 py-2 font-medium">💬</th>
                    <th className="text-right px-2 py-2 font-medium">🔁</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-800/60 hover:bg-neutral-800/60">
                      <td className="px-2 py-2 text-neutral-200">
                        <Link href={`/threads/posts?draftId=${p.id}`} className="line-clamp-1 hover:text-sky-400">
                          {p.content || "（本文なし）"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-neutral-500 whitespace-nowrap">{fmtDate(p.publishedAt)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.views)}</td>
                      <td className="px-2 py-2 text-right text-neutral-100 font-bold">{fmtNum(p.likes)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.replies)}</td>
                      <td className="px-2 py-2 text-right text-neutral-300">{fmtNum(p.reposts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
