"use client";

import { useState } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { getHooksFor, getPerformanceRecords, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { ScriptProject } from "@/lib/project-store";
import { formatNumber } from "@/lib/mock-data";

interface RefVideo {
  title: string;
  channel: string;
  views: number;
  referencePoint: string;
  crossGenre: boolean;
}

interface TitleCandidateEx {
  title: string;
  reason: string;
  appealPattern?: string;
  estimatedPotential: "high" | "medium" | "low";
  referenceVideos?: RefVideo[];
  sourceVideo?: string;
  sourceChannel?: string;
}

export default function StepTitle({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [suggesting, setSuggesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ similar: boolean; similarTitle?: string; message: string; suggestion?: string } | null>(null);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<TitleCandidateEx[]>([]);
  const [pastCandidates, setPastCandidates] = useState<TitleCandidateEx[][]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [direction, setDirection] = useState("");

  const handleSuggestTitles = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    const ytApiKey = getApiKey("yt_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setSuggesting(true);
    setError("");

    try {
      // 競合動画を取得（タイトル+チャンネル+再生数）
      const channels = getChannels().filter((ch) => ch.channelId);
      let competitorVideos: { title: string; channel: string; views: number }[] = [];
      if (ytApiKey && channels.length > 0) {
        const res = await fetch("/api/youtube/search-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: channels.slice(0, 5).map((ch) => ({ channelId: ch.channelId, name: ch.name, handle: ch.handle })), apiKey: ytApiKey, maxResultsPerChannel: 20 }),
        });
        const data = await res.json();
        if (data.videos) {
          const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          competitorVideos = data.videos
            .filter((v: { publishedAt: string }) => v.publishedAt >= oneMonthAgo.toISOString().split("T")[0])
            .sort((a: { views: number }, b: { views: number }) => b.views - a.views)
            .slice(0, 30)
            .map((v: { title: string; channelName: string; views: number }) => ({ title: v.title, channel: v.channelName, views: v.views }));
        }
      }

      const perfRecords = getPerformanceRecords().filter((r) => r.genre === project.genre);
      const selfTopVideos = perfRecords.sort((a, b) => b.views - a.views).slice(0, 5).map((r) => `${r.title}（${r.views}回再生）`);
      const hooks = getHooksFor(project.genre, project.style).slice(0, 5).map((h) => h.text);

      // 前回の提案をNG例として渡す
      const excludeTitles = candidates.map((c) => c.title);

      const res = await fetch("/api/script/suggest-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: project.genre, style: project.style,
          competitorVideos, selfTopVideos,
          performanceData: perfRecords.length > 0 ? `過去実績${perfRecords.length}件、平均再生数${Math.round(perfRecords.reduce((s, r) => s + r.views, 0) / perfRecords.length)}回` : "",
          hookPatterns: hooks.join(" / "), aiApiKey,
          excludeTitles: excludeTitles.length > 0 ? excludeTitles : undefined,
          directionNote: direction || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.candidates) {
        if (candidates.length > 0) { setPastCandidates((prev) => [...prev, candidates]); }
        setCandidates(data.candidates);
        onUpdate({ ...project, titleCandidates: data.candidates });
      }
    } catch { setError("タイトル提案に失敗"); }
    finally { setSuggesting(false); }
  };

  const handleSimilarCheck = async () => {
    if (!project.title) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setChecking(true);
    setCheckResult(null);
    try {
      const pastTitles = getPerformanceRecords().map((r) => r.title);
      const res = await fetch("/api/script/similar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: project.title, pastTitles, aiApiKey }),
      });
      setCheckResult(await res.json());
    } catch { setError("類似チェックに失敗"); }
    finally { setChecking(false); }
  };

  const handleSelectCandidate = (c: TitleCandidateEx) => {
    // タイトルを設定し、参考動画があれば引き継ぎ用に保存
    const refs = (c.referenceVideos || []).map((rv) => ({
      videoId: "", title: rv.title, channelName: rv.channel, views: rv.views,
      thumbnailUrl: "", multiplier: undefined, selected: true,
    }));
    onUpdate({ ...project, title: c.title, referenceVideos: refs, status: "references" });
  };

  const displayCandidates = candidates.length > 0 ? candidates : (project.titleCandidates as TitleCandidateEx[]);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-2">② 企画タイトル</h2>
      <p className="text-sm text-gray-500 mb-6">
        {GENRE_LABELS[project.genre]} × {STYLE_LABELS[project.style]}
      </p>

      {/* 手動入力 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">タイトルを入力</label>
        <div className="flex gap-3">
          <input type="text" value={project.title} onChange={(e) => onUpdate({ ...project, title: e.target.value })}
            placeholder="例: ツインレイの再会が近づいている3つのサイン"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
          <button onClick={handleSimilarCheck} disabled={checking || !project.title}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50 shrink-0">
            {checking ? "チェック中..." : "類似チェック"}
          </button>
        </div>
        {checkResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${checkResult.similar ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {checkResult.similar ? `⚠ 類似: ${checkResult.similarTitle} - ${checkResult.message}` : `✓ ${checkResult.message}`}
            {checkResult.suggestion && <p className="mt-1 text-xs">提案: {checkResult.suggestion}</p>}
          </div>
        )}
      </div>

      {/* AI提案 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-accent/20 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">AIで企画提案</h3>
          <button onClick={handleSuggestTitles} disabled={suggesting}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
            {suggesting ? "競合分析中..." : candidates.length > 0 ? "他の企画を探す" : "競合＋自チャンネルから提案"}
          </button>
        </div>

        {/* 方向性指定 */}
        <div className="mb-4">
          <input type="text" value={direction} onChange={(e) => setDirection(e.target.value)}
            placeholder="方向性を指定（例: もっと損失回避寄り、サムネ映え重視、緊急性を出したい）"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
        </div>

        {displayCandidates.length > 0 && (
          <div className="space-y-2">
            {displayCandidates.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 overflow-hidden">
                {/* ヘッダー（クリックで展開） */}
                <div
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${project.title === c.title ? "bg-accent/5 border-l-4 border-l-accent" : ""}`}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.estimatedPotential === "high" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {c.estimatedPotential === "high" ? "高ポテンシャル" : "中ポテンシャル"}
                        </span>
                        {c.appealPattern && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{c.appealPattern}</span>
                        )}
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${expanded === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* 展開エリア */}
                {expanded === i && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 bg-gray-50/50">
                    {/* 提案理由 */}
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-gray-500 mb-1">伸びると判断した理由</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{c.reason}</p>
                    </div>

                    {/* 参考動画 */}
                    {c.referenceVideos && c.referenceVideos.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-500 mb-2">参考にすべき動画</h4>
                        <div className="space-y-2">
                          {c.referenceVideos.map((rv, j) => (
                            <div key={j} className="bg-white rounded-lg p-3 border border-gray-100">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{rv.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{rv.channel} · {formatNumber(rv.views)}回再生</p>
                                </div>
                                {rv.crossGenre && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">訴求パターン参考</span>
                                )}
                              </div>
                              <p className="text-xs text-accent mt-1.5">→ {rv.referencePoint}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button onClick={() => handleSelectCandidate(c)}
                      className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
                      この企画で進む →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 過去の提案履歴 */}
      {pastCandidates.length > 0 && (
        <div className="mb-6">
          <details className="group">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              過去の提案を見る（{pastCandidates.length}回分）
            </summary>
            <div className="mt-2 space-y-2">
              {pastCandidates.map((batch, bi) => (
                <div key={bi} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{bi + 1}回目の提案</p>
                  {batch.map((c, ci) => (
                    <div key={ci} className="flex items-center justify-between py-1">
                      <p className="text-sm text-gray-600">{c.title}</p>
                      <button onClick={() => onUpdate({ ...project, title: c.title })}
                        className="text-xs text-accent hover:underline shrink-0 ml-2">選択</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "genre" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        <button onClick={() => onUpdate({ ...project, status: "references" })} disabled={!project.title}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">次へ →</button>
      </div>
    </div>
  );
}
