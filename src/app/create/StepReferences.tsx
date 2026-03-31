"use client";

import { useState } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
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

  const selectedCount = videos.filter((v) => v.selected).length;

  const handleNext = () => {
    onUpdate({ ...project, referenceVideos: videos.filter((v) => v.selected), status: "analyzing" });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">③ 参考動画を選択（2-3本）</h2>
      <p className="text-sm text-gray-500 mb-6">
        「{project.title}」 · {GENRE_LABELS[project.genre]}の競合人気動画（直近1ヶ月・長尺のみ）
      </p>

      {!fetched && (
        <div className="text-center py-12">
          <button onClick={fetchVideos} disabled={loading}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {loading ? "取得中..." : "競合動画を取得"}
          </button>
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {fetched && (
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

          <div className="flex gap-3">
            <button onClick={() => onUpdate({ ...project, status: "title" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
            <button onClick={handleNext} disabled={selectedCount < 2}
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
              {selectedCount}本を分析する →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
