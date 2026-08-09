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

interface ReadPost {
  label: string;
  type?: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  excerpt?: string;
}

const POST_TYPE_LABEL: Record<string, string> = {
  tree: "🌳ツリー",
  short: "✏️短文",
  education: "📚教育",
  other: "投稿",
};

interface AnalyzeResult {
  summary: string;
  readPosts?: ReadPost[];
  growingTraits: string[];
  notGrowingTraits: string[];
  logicSuggestions: string[];
  insights: Insights;
}

const EMPTY_INSIGHTS: Insights = { hooks: [], strongWords: [], growthPatterns: [], toneNotes: [], logicNotes: [] };
const MAX_ANALYZE_IMAGES = 20;

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

  // スクショ傾向分析（1投稿=1枠。ツリー投稿は同じ枠に本文＋続きを複数枚）
  const [postGroups, setPostGroups] = useState<string[][]>([[]]);
  const [aNote, setANote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aResult, setAResult] = useState<AnalyzeResult | null>(null);
  const [aError, setAError] = useState("");
  const [applied, setApplied] = useState<Set<number>>(new Set());
  // 蓄積された学習データ
  const [storedInsights, setStoredInsights] = useState<Insights>(EMPTY_INSIGHTS);
  const [insightsSaved, setInsightsSaved] = useState(false);
  // 評価基準（ユーザー編集）
  const [evalCriteria, setEvalCriteria] = useState("");
  const [criteriaDirty, setCriteriaDirty] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  // 学習データの手動編集
  const [editingInsights, setEditingInsights] = useState(false);
  const [insightsDraft, setInsightsDraft] = useState<Insights>(EMPTY_INSIGHTS);
  const [reorganizing, setReorganizing] = useState(false);

  // アカウントの現在の学習データ・評価基準を読み込む
  const loadInsights = useCallback(async () => {
    if (!accountId) return;
    try {
      const list = await api<{ id: string; learnedInsights?: string; evalCriteria?: string }[]>("/api/threads/accounts");
      const acc = list.find((a) => a.id === accountId);
      if (acc?.learnedInsights) {
        const parsed = JSON.parse(acc.learnedInsights) as Partial<Insights>;
        setStoredInsights({ ...EMPTY_INSIGHTS, ...parsed });
      } else {
        setStoredInsights(EMPTY_INSIGHTS);
      }
      setEvalCriteria(acc?.evalCriteria ?? "");
      setCriteriaDirty(false);
    } catch {
      setStoredInsights(EMPTY_INSIGHTS);
    }
  }, [accountId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // 評価基準を保存
  const saveCriteria = async () => {
    if (!accountId) return;
    setSavingCriteria(true);
    try {
      await api(`/api/threads/accounts/${accountId}`, { method: "PATCH", body: JSON.stringify({ evalCriteria }) });
      setCriteriaDirty(false);
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCriteria(false);
    }
  };

  // 学習データの手動編集
  const startEditInsights = () => {
    setInsightsDraft(JSON.parse(JSON.stringify(storedInsights)) as Insights);
    setEditingInsights(true);
  };
  const saveInsightsEdit = async () => {
    if (!accountId) return;
    try {
      await api(`/api/threads/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify({ learnedInsights: JSON.stringify(insightsDraft) }),
      });
      setStoredInsights(insightsDraft);
      setEditingInsights(false);
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    }
  };

  // 現在の評価基準で既存の学習データを再整理（新規スクショ不要）
  const reorganizeByCriteria = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setAError("AI APIキーが未設定です（設定画面で登録してください）");
      return;
    }
    setReorganizing(true);
    setAError("");
    setAResult(null);
    setInsightsSaved(false);
    setApplied(new Set());
    try {
      const res = await api<AnalyzeResult>("/api/threads/analytics/analyze", {
        method: "POST",
        body: JSON.stringify({ accountId, reorganize: true, aiApiKey, model: getThreadsModel() }),
      });
      setAResult(res);
    } catch (e) {
      setAError(e instanceof Error ? e.message : String(e));
    } finally {
      setReorganizing(false);
    }
  };

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

  const totalImages = postGroups.reduce((s, g) => s + g.length, 0);
  const filledGroups = postGroups.filter((g) => g.length > 0);

  const addImagesToGroup = async (gi: number, files: File[]) => {
    if (files.length === 0) return;
    const urls = await filesToDataUrls(files, 1600, MAX_ANALYZE_IMAGES);
    setPostGroups((prev) => {
      const cur = prev.reduce((s, g) => s + g.length, 0);
      const room = Math.max(0, MAX_ANALYZE_IMAGES - cur);
      const add = urls.slice(0, room);
      return prev.map((g, i) => (i === gi ? [...g, ...add] : g));
    });
  };
  const removeImage = (gi: number, ii: number) =>
    setPostGroups((prev) => prev.map((g, i) => (i === gi ? g.filter((_, j) => j !== ii) : g)));
  const addGroup = () => setPostGroups((prev) => [...prev, []]);
  const removeGroup = (gi: number) =>
    setPostGroups((prev) => {
      const next = prev.filter((_, i) => i !== gi);
      return next.length === 0 ? [[]] : next;
    });

  const runAnalyze = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setAError("AI APIキーが未設定です（設定画面で登録してください）");
      return;
    }
    if (filledGroups.length === 0 && !aNote.trim()) {
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
          postGroups: filledGroups.length > 0 ? filledGroups : undefined,
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

        {/* 評価基準（ユーザーが追記していく。分析に毎回反映） */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-200">🧭 分析の評価基準（自分で追加・編集）</span>
            <span className="text-[10px] text-neutral-500">分析するたびに最優先で反映されます</span>
          </div>
          <textarea
            value={evalCriteria}
            onChange={(e) => {
              setEvalCriteria(e.target.value);
              setCriteriaDirty(true);
            }}
            rows={4}
            className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs"
            placeholder={"1行1基準で追記していく。例:\n・伸びやすさは 長文ツリー>短文>教育メイン。表示回数の絶対値だけで優劣を決めない\n・教育投稿は低インプでも「強いフォロワー」を育てる価値がある\n・短文は世界観の刷り込み・欲求喚起で評価する\n・ゴールは「最大インプ×最大教育」の両立"}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveCriteria}
              disabled={savingCriteria || !criteriaDirty}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-40"
            >
              {savingCriteria ? "保存中..." : criteriaDirty ? "評価基準を保存" : "保存済み"}
            </button>
            <span className="text-[10px] text-neutral-600">今後も基準を足していけばOK。次の分析から効きます。</span>
          </div>
        </div>

        {/* 蓄積された学習データ（常時表示・手動編集/再整理可） */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold text-neutral-200">📚 このアカウントの学習データ</span>
            {storedInsights.analyzedCount ? (
              <span className="text-[10px] text-neutral-500">分析{storedInsights.analyzedCount}回分を蓄積</span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {!editingInsights && (
                <>
                  <button
                    onClick={reorganizeByCriteria}
                    disabled={reorganizing}
                    className="text-[10px] px-2 py-1 rounded-lg border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-40"
                    title="新規スクショ無しで、今の評価基準に沿って既存データを整理し直す"
                  >
                    {reorganizing ? "再整理中..." : "🔁 現在の基準で再整理"}
                  </button>
                  <button onClick={startEditInsights} className="text-[10px] px-2 py-1 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800">
                    ✏️ 手動編集
                  </button>
                </>
              )}
            </div>
          </div>

          {editingInsights ? (
            <div className="space-y-2">
              {INSIGHT_GROUPS.map((g) => {
                const items = insightsDraft[g.key] as string[];
                return (
                  <div key={g.key}>
                    <div className="text-[11px] font-bold text-neutral-300 mb-1">{g.emoji} {g.label}</div>
                    <div className="space-y-1">
                      {items.map((it, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            value={it}
                            onChange={(e) =>
                              setInsightsDraft((d) => ({
                                ...d,
                                [g.key]: (d[g.key] as string[]).map((x, j) => (j === i ? e.target.value : x)),
                              }))
                            }
                            className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded px-2 py-1 text-[11px]"
                          />
                          <button
                            onClick={() =>
                              setInsightsDraft((d) => ({ ...d, [g.key]: (d[g.key] as string[]).filter((_, j) => j !== i) }))
                            }
                            className="text-[11px] text-neutral-500 hover:text-rose-400 px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setInsightsDraft((d) => ({ ...d, [g.key]: [...(d[g.key] as string[]), ""] }))}
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        ＋ 項目を追加
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 pt-1">
                <button onClick={saveInsightsEdit} className="text-[11px] px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200">
                  保存
                </button>
                <button onClick={() => setEditingInsights(false)} className="text-[11px] px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  キャンセル
                </button>
              </div>
            </div>
          ) : INSIGHT_GROUPS.reduce((s, g) => s + (storedInsights[g.key] as string[]).length, 0) === 0 ? (
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
        {/* 1投稿=1枠。ツリー投稿は同じ枠に本文＋続きを複数枚 */}
        <div className="space-y-2">
          {postGroups.map((group, gi) => (
            <div key={gi} className="bg-neutral-950/60 border border-neutral-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-200">📮 投稿{gi + 1}</span>
                <button
                  onClick={() => removeGroup(gi)}
                  className="text-[11px] text-neutral-500 hover:text-rose-400"
                  title="この投稿枠を削除"
                >
                  枠を削除
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {group.map((src, ii) => (
                  <div key={ii} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`投稿${gi + 1}-${ii + 1}`} className="h-16 w-16 object-cover rounded border border-neutral-600" />
                    {ii === 0 && group.length > 1 && (
                      <span className="absolute bottom-0 left-0 text-[8px] bg-black/70 text-neutral-200 px-1 rounded-tr">本文</span>
                    )}
                    <button
                      onClick={() => removeImage(gi, ii)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-neutral-900 border border-neutral-600 text-neutral-300 text-[10px] leading-none flex items-center justify-center hover:bg-rose-600 hover:text-white"
                      title="この画像を削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="h-16 w-16 rounded-lg border border-dashed border-neutral-600 text-neutral-400 hover:border-neutral-400 hover:text-neutral-200 cursor-pointer flex flex-col items-center justify-center text-[10px] leading-tight text-center">
                  <span className="text-lg leading-none">＋</span>
                  <span>{group.length === 0 ? "スクショ" : "続き"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      await addImagesToGroup(gi, files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {group.length > 1 && (
                <p className="text-[10px] text-teal-300/80 mt-1.5">🌳 この枠は本文＋続き＝1つの長文ツリー投稿として分析します（数値は本文基準）。</p>
              )}
            </div>
          ))}
          <button
            onClick={addGroup}
            className="w-full py-2 rounded-lg border border-dashed border-neutral-600 text-xs text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800/50"
          >
            ＋ 投稿枠を追加（別の投稿はこちら）
          </button>
        </div>

        <textarea
          value={aNote}
          onChange={(e) => setANote(e.target.value)}
          rows={2}
          className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs"
          placeholder="（任意）補足。例: 投稿2が特に伸びた / 最近リーチが落ちてる"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-neutral-600">
            <span className="text-neutral-400 font-bold">1投稿＝1枠</span>。ツリー投稿は同じ枠に本文→続きの順で複数枚。別の投稿は「＋投稿枠を追加」。<span className="text-neutral-400">👁表示回数が写っているほど精度UP</span>。合計{totalImages}/{MAX_ANALYZE_IMAGES}枚・{filledGroups.length}投稿。保存済み実績も自動加味。
          </p>
          <button
            onClick={runAnalyze}
            disabled={analyzing}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            {analyzing ? "分析中...（30秒〜1分）" : `傾向を分析する${filledGroups.length > 0 ? `（${filledGroups.length}投稿）` : ""}`}
          </button>
        </div>

        {aError && <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-300">{aError}</div>}

        {aResult && (
          <div className="space-y-3 pt-1">
            {aResult.summary && (
              <p className="text-xs text-neutral-300 bg-neutral-800/50 rounded-lg p-3 leading-relaxed">{aResult.summary}</p>
            )}

            {/* 読み取った数値（表示回数の確認用） */}
            {aResult.readPosts && aResult.readPosts.length > 0 && (
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                <h4 className="text-xs font-bold text-neutral-200 mb-2">👁 読み取った数値（表示回数ベース・降順）</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[420px]">
                    <thead>
                      <tr className="text-neutral-500 border-b border-neutral-800">
                        <th className="text-left px-2 py-1 font-medium">投稿</th>
                        <th className="text-right px-2 py-1 font-medium">👁 表示</th>
                        <th className="text-right px-2 py-1 font-medium">❤️</th>
                        <th className="text-right px-2 py-1 font-medium">💬</th>
                        <th className="text-right px-2 py-1 font-medium">🔁</th>
                        <th className="text-right px-2 py-1 font-medium">率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...aResult.readPosts]
                        .sort((a, b) => b.views - a.views || b.likes - a.likes)
                        .map((p, i) => (
                          <tr key={i} className="border-b border-neutral-800/60">
                            <td className="px-2 py-1 text-neutral-300">
                              <span className="font-bold">{p.label}</span>
                              {p.type && (
                                <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-neutral-800 text-neutral-400">
                                  {POST_TYPE_LABEL[p.type] ?? p.type}
                                </span>
                              )}
                              {p.excerpt ? <span className="text-neutral-500"> {p.excerpt}</span> : null}
                            </td>
                            <td className="px-2 py-1 text-right text-neutral-100 font-bold">{p.views > 0 ? fmtNum(p.views) : "—"}</td>
                            <td className="px-2 py-1 text-right text-neutral-300">{fmtNum(p.likes)}</td>
                            <td className="px-2 py-1 text-right text-neutral-300">{fmtNum(p.replies)}</td>
                            <td className="px-2 py-1 text-right text-neutral-300">{fmtNum(p.reposts)}</td>
                            <td className="px-2 py-1 text-right text-neutral-400">
                              {p.views > 0 ? `${((p.likes / p.views) * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1.5">
                  ※ 形式で伸びやすさが桁違い（🌳ツリー＞✏️短文＞📚教育）。表示回数だけで優劣は決めず、同形式内での相対＋教育価値の両輪で分析しています。表示回数が違えば補足欄で訂正→再分析。「率」=いいね÷表示。
                </p>
              </div>
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
