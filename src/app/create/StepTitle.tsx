"use client";

import { useState } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getChannels } from "@/lib/channel-store";
import { getHooksFor, getPerformanceRecords, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { ScriptProject, TitleCandidate } from "@/lib/project-store";

export default function StepTitle({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [suggesting, setSuggesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ similar: boolean; similarTitle?: string; message: string; suggestion?: string } | null>(null);
  const [error, setError] = useState("");

  const handleSuggestTitles = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    const ytApiKey = getApiKey("yt_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setSuggesting(true);
    setError("");

    try {
      // 競合動画タイトルを取得
      const channels = getChannels().filter((ch) => ch.channelId);
      let competitorTitles: string[] = [];
      if (ytApiKey && channels.length > 0) {
        const res = await fetch("/api/youtube/search-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: channels.slice(0, 5).map((ch) => ({ channelId: ch.channelId, name: ch.name, handle: ch.handle })), apiKey: ytApiKey, maxResultsPerChannel: 20 }),
        });
        const data = await res.json();
        if (data.videos) {
          const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          competitorTitles = data.videos
            .filter((v: { publishedAt: string; views: number }) => v.publishedAt >= oneMonthAgo.toISOString().split("T")[0])
            .sort((a: { views: number }, b: { views: number }) => b.views - a.views)
            .slice(0, 20)
            .map((v: { title: string }) => v.title);
        }
      }

      const perfRecords = getPerformanceRecords().filter((r) => r.genre === project.genre);
      const selfTopVideos = perfRecords.sort((a, b) => b.views - a.views).slice(0, 5).map((r) => `${r.title}（${r.views}回再生）`);
      const hooks = getHooksFor(project.genre, project.style).slice(0, 5).map((h) => h.text);

      const res = await fetch("/api/script/suggest-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: project.genre, style: project.style,
          competitorTitles, selfTopVideos, performanceData: perfRecords.length > 0 ? `過去実績${perfRecords.length}件` : "",
          hookPatterns: hooks.join(", "), aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.candidates) { onUpdate({ ...project, titleCandidates: data.candidates }); }
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">AIで企画提案</h3>
          <button onClick={handleSuggestTitles} disabled={suggesting}
            className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
            {suggesting ? "分析中..." : "競合＋自チャンネルから提案"}
          </button>
        </div>

        {project.titleCandidates.length > 0 && (
          <div className="space-y-2">
            {project.titleCandidates.map((c: TitleCandidate, i: number) => (
              <div key={i} className={`p-4 rounded-lg border cursor-pointer transition-all ${
                project.title === c.title ? "border-accent bg-accent/5" : "border-gray-100 hover:border-gray-200"
              }`} onClick={() => onUpdate({ ...project, title: c.title })}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.reason}</p>
                    {c.sourceVideo && <p className="text-xs text-gray-400 mt-0.5">元ネタ: {c.sourceChannel} - {c.sourceVideo}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.estimatedPotential === "high" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {c.estimatedPotential === "high" ? "高ポテンシャル" : "中ポテンシャル"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "genre" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        <button onClick={() => onUpdate({ ...project, status: "references" })} disabled={!project.title}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">次へ →</button>
      </div>
    </div>
  );
}
