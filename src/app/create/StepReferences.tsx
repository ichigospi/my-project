"use client";

import { useState, useEffect } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { getAnalyses } from "@/lib/script-analysis-store";
import type { ScriptAnalysis } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";
import { GENRE_LABELS } from "@/lib/project-store";
import type { ScriptProject, ReferenceVideo, Genre } from "@/lib/project-store";

// ジャンルごとのフィルタキーワード（タイトルにいずれかが含まれる動画を優先）
const GENRE_KEYWORDS: Record<Genre, string[]> = {
  love: ["恋愛", "ツインレイ", "ツインソウル", "運命の人", "復縁", "片思い", "あの人", "お相手", "彼", "好きな人", "パートナー", "結婚", "同棲", "連絡", "再会", "出会い", "愛", "恋", "ソウルメイト"],
  money: ["金運", "お金", "収入", "豊かさ", "富", "財", "臨時収入", "宝くじ", "昇給", "副業", "開運", "金銭"],
  general: ["運勢", "スピリチュアル", "覚醒", "エネルギー", "浄化", "チャクラ", "瞑想", "ヒーリング", "波動", "アセンション", "守護", "天使", "エンジェル", "宇宙"],
};

export default function StepReferences({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [videos, setVideos] = useState<(ReferenceVideo & { duration?: string })[]>(project.referenceVideos.length > 0 ? project.referenceVideos : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(project.referenceVideos.length > 0);
  const [tab, setTab] = useState<"search" | "analyzed">("search");
  const [analyzedVideos, setAnalyzedVideos] = useState<ScriptAnalysis[]>([]);

  useEffect(() => {
    setAnalyzedVideos(getAnalyses());
  }, []);

  const fetchVideos = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }

    const channels = getChannels().filter((ch) => ch.channelId);
    if (channels.length === 0) { setError("チャンネルを登録してデータを取得してください"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/youtube/search-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: channels.map((ch) => ({ channelId: ch.channelId, name: ch.name, handle: ch.handle })), apiKey: ytApiKey, maxResultsPerChannel: 30 }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const dateStr = oneMonthAgo.toISOString().split("T")[0];
      const keywords = GENRE_KEYWORDS[project.genre] || [];

      const allVideos = (data.videos || [])
        .filter((v: { publishedAt: string; duration?: string; title?: string }) => {
          // 直近1ヶ月
          if (v.publishedAt < dateStr) return false;
          // ショート除外: durationが5分未満
          if (v.duration) {
            const parts = v.duration.split(":");
            if (parts.length === 2) {
              // M:SS形式
              const mins = parseInt(parts[0]);
              if (mins < 5) return false;
            } else if (parts.length === 3) {
              // H:MM:SS形式 → 常に5分以上なのでOK
            } else if (v.duration === "0:00") {
              return false;
            }
          }
          // #shortsタグを除外
          if (v.title && v.title.toLowerCase().includes("#shorts")) return false;
          return true;
        });

      // ジャンル一致の動画を優先ソート
      const scored = allVideos.map((v: { id: string; title: string; channelName: string; views: number; thumbnailUrl: string; channelId: string; duration?: string }) => {
        const matchCount = keywords.filter((kw) => v.title.includes(kw)).length;
        const stats = data.channelStats?.[v.channelId];
        return {
          videoId: v.id, title: v.title, channelName: v.channelName, views: v.views,
          thumbnailUrl: v.thumbnailUrl, duration: v.duration,
          multiplier: stats?.avgViews ? Math.round((v.views / stats.avgViews) * 10) / 10 : undefined,
          selected: false,
          genreMatch: matchCount,
        };
      });

      // ジャンル一致数 → 再生数の順でソート
      scored.sort((a: { genreMatch: number; views: number }, b: { genreMatch: number; views: number }) =>
        b.genreMatch - a.genreMatch || b.views - a.views
      );

      const refs: ReferenceVideo[] = scored.slice(0, 30);
      setVideos(refs);
      setFetched(true);

      if (scored.filter((v: { genreMatch: number }) => v.genreMatch > 0).length === 0) {
        setError(`「${GENRE_LABELS[project.genre]}」に関連する動画が見つかりませんでした。他のジャンルの動画から選んでください。`);
      }
    } catch { setError("動画の取得に失敗"); }
    finally { setLoading(false); }
  };

  const toggleSelect = (videoId: string) => {
    setVideos((prev) => prev.map((v) => v.videoId === videoId ? { ...v, selected: !v.selected } : v));
  };

  const addFromAnalyzed = (analysis: ScriptAnalysis) => {
    // 既に追加済みならスキップ
    if (videos.some((v) => v.videoId === analysis.videoId)) return;
    if (selectedCount >= 3) return;
    const ref: ReferenceVideo = {
      videoId: analysis.videoId,
      title: analysis.videoTitle,
      channelName: analysis.channelName,
      views: analysis.views,
      thumbnailUrl: analysis.thumbnailUrl,
      selected: true,
    };
    setVideos((prev) => [ref, ...prev]);
    setFetched(true);
  };

  const selectedCount = videos.filter((v) => v.selected).length;

  const handleNext = () => {
    onUpdate({ ...project, referenceVideos: videos.filter((v) => v.selected), status: "analyzing" });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">③ 参考動画を選択（2-3本）</h2>
      <p className="text-sm text-gray-500 mb-4">
        「{project.title}」 · {GENRE_LABELS[project.genre]}の競合人気動画
      </p>

      {/* タブ: 検索 / 分析済みから選ぶ */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setTab("search")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "search" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          競合動画から検索
        </button>
        <button onClick={() => setTab("analyzed")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "analyzed" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          分析済みから選ぶ（{analyzedVideos.length}件）
        </button>
      </div>

      {/* 選択中の表示 */}
      {selectedCount > 0 && (
        <div className="bg-accent/5 rounded-lg p-3 mb-4 flex flex-wrap gap-2">
          {videos.filter((v) => v.selected).map((v) => (
            <span key={v.videoId} className="text-xs bg-white rounded-full px-3 py-1 border border-accent/20 flex items-center gap-1">
              {v.title.substring(0, 25)}...
              <button onClick={() => toggleSelect(v.videoId)} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
          <span className="text-xs text-gray-500 self-center">{selectedCount}/3</span>
        </div>
      )}

      {/* 分析済みタブ */}
      {tab === "analyzed" && (
        <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
          {analyzedVideos.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">分析済みの動画がありません。台本分析で動画を分析してください。</p>
          )}
          {analyzedVideos.map((a) => {
            const alreadyAdded = videos.some((v) => v.videoId === a.videoId && v.selected);
            return (
              <div key={a.id} className={`flex items-center gap-4 p-3 rounded-lg ${alreadyAdded ? "bg-accent/5 border border-accent/30" : "bg-card-bg border border-gray-100"}`}>
                {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{a.videoTitle}</p>
                  <p className="text-xs text-gray-500">{a.channelName} · スコア {a.score?.overall || "?"}/10</p>
                  {a.analysisResult?.overallPattern && <p className="text-xs text-accent mt-0.5">{a.analysisResult.overallPattern}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatNumber(a.views)}回</p>
                </div>
                <button
                  onClick={() => alreadyAdded ? toggleSelect(a.videoId) : addFromAnalyzed(a)}
                  disabled={!alreadyAdded && selectedCount >= 3}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                    alreadyAdded ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
                  }`}>
                  {alreadyAdded ? "解除" : "追加"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 検索タブ */}
      {tab === "search" && !fetched && (
        <div className="text-center py-12">
          <button onClick={fetchVideos} disabled={loading}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {loading ? "取得中..." : "競合動画を取得"}
          </button>
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {tab === "search" && fetched && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">{videos.length}件（{GENRE_LABELS[project.genre]}優先） | {selectedCount}/3 選択中</span>
            <button onClick={fetchVideos} disabled={loading} className="text-xs text-accent hover:underline">
              {loading ? "更新中..." : "再取得"}
            </button>
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
            {videos.map((v, i) => (
              <label key={v.videoId || `ref-${i}`} className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                v.selected ? "bg-accent/5 border border-accent/30" : "bg-card-bg border border-gray-100 hover:border-gray-200"
              }`}>
                <input type="checkbox" checked={v.selected} onChange={() => toggleSelect(v.videoId)}
                  disabled={!v.selected && selectedCount >= 3}
                  className="w-4 h-4 rounded text-accent shrink-0" />
                {v.thumbnailUrl && (
                  <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <img src={v.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover hover:opacity-80 transition-opacity" />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} className="text-sm font-medium line-clamp-1 hover:text-accent transition-colors">{v.title}</a>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{v.channelName}</span>
                    {(v as { genreMatch?: number }).genreMatch && (v as { genreMatch?: number }).genreMatch! > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{GENRE_LABELS[project.genre]}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatNumber(v.views)}回</p>
                  {v.multiplier && (
                    <p className={`text-xs font-bold ${v.multiplier >= 3 ? "text-red-500" : v.multiplier >= 2 ? "text-yellow-600" : "text-green-600"}`}>
                      {v.multiplier}倍
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

        </>
      )}

      {/* ナビゲーション（常に表示） */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onUpdate({ ...project, status: "title" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        <button onClick={handleNext} disabled={selectedCount < 1}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
          {selectedCount}本を分析する →
        </button>
      </div>
    </div>
  );
}
