"use client";

import { useState, useEffect } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";
import { GENRE_LABELS } from "@/lib/project-store";
import type { ScriptProject, ReferenceVideo } from "@/lib/project-store";

export default function StepReferences({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [videos, setVideos] = useState<ReferenceVideo[]>(project.referenceVideos.length > 0 ? project.referenceVideos : []);
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

      const refs: ReferenceVideo[] = (data.videos || [])
        .filter((v: { publishedAt: string }) => v.publishedAt >= dateStr)
        .sort((a: { views: number }, b: { views: number }) => b.views - a.views)
        .slice(0, 30)
        .map((v: { id: string; title: string; channelName: string; views: number; thumbnailUrl: string; channelId: string }) => {
          const stats = data.channelStats?.[v.channelId];
          return {
            videoId: v.id, title: v.title, channelName: v.channelName, views: v.views,
            thumbnailUrl: v.thumbnailUrl,
            multiplier: stats?.avgViews ? Math.round((v.views / stats.avgViews) * 10) / 10 : undefined,
            selected: false,
          };
        });

      setVideos(refs);
      setFetched(true);
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
        「{project.title}」に関連する競合の人気動画（直近1ヶ月）
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
            <span className="text-sm text-gray-500">{videos.length}件 | {selectedCount}/3 選択中</span>
            <button onClick={fetchVideos} disabled={loading} className="text-xs text-accent hover:underline">
              {loading ? "更新中..." : "再取得"}
            </button>
          </div>

          <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
            {videos.map((v) => (
              <label key={v.videoId} className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                v.selected ? "bg-accent/5 border border-accent/30" : "bg-card-bg border border-gray-100 hover:border-gray-200"
              }`}>
                <input type="checkbox" checked={v.selected} onChange={() => toggleSelect(v.videoId)}
                  disabled={!v.selected && selectedCount >= 3}
                  className="w-4 h-4 rounded text-accent shrink-0" />
                {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{v.title}</p>
                  <p className="text-xs text-gray-500">{v.channelName}</p>
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

          {error && <p className="text-danger text-sm mb-4">{error}</p>}

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
