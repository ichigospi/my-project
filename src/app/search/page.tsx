"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getChannels, getApiKey } from "@/lib/channel-store";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";

interface VideoResult {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  thumbnailUrl: string;
  tags: string[];
  engagementRate: number;
  channelId: string;
  channelName: string;
}

interface ChannelStats {
  totalViews: number;
  videoCount: number;
  avgViews: number;
}

const SEARCH_CACHE_KEY = "fortune_yt_search_cache";

export default function SearchPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<RegisteredChannel[]>([]);
  const [allVideos, setAllVideos] = useState<VideoResult[]>([]);
  const [channelStats, setChannelStats] = useState<Record<string, ChannelStats>>({});
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  // フィルター
  const [titleQuery, setTitleQuery] = useState("");
  const [minViews, setMinViews] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [sortBy, setSortBy] = useState<"views" | "date" | "multiplier" | "engagement">("views");

  useEffect(() => {
    setChannels(getChannels());
    // キャッシュから復元
    try {
      const cached = localStorage.getItem(SEARCH_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.videos?.length > 0) {
          setAllVideos(data.videos);
          setChannelStats(data.channelStats || {});
          setFetched(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchAllVideos = async () => {
    const apiKey = getApiKey("yt_api_key");
    if (!apiKey) {
      setError("設定ページからYouTube APIキーを登録してください");
      return;
    }

    const registeredChannels = getChannels().filter((ch) => ch.channelId);
    if (registeredChannels.length === 0) {
      setError("チャンネルデータが未取得です。先にチャンネル分析ページで「全チャンネルのデータを取得」を実行してください");
      return;
    }

    setLoading(true);
    setError("");
    setProgress(`${registeredChannels.length}チャンネルの動画を取得中...`);

    try {
      const res = await fetch("/api/youtube/search-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: registeredChannels.map((ch) => ({
            channelId: ch.channelId,
            name: ch.name,
            handle: ch.handle,
          })),
          apiKey,
          maxResultsPerChannel: 50,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const videos = data.videos || [];
        const stats = data.channelStats || {};
        setAllVideos(videos);
        setChannelStats(stats);
        setFetched(true);
        setProgress("");
        // キャッシュに保存
        try {
          localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ videos, channelStats: stats, savedAt: new Date().toISOString() }));
        } catch { /* ignore */ }
      }
    } catch {
      setError("動画データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // フィルタリング
  const filteredVideos = useMemo(() => {
    let results = [...allVideos];

    // チャンネルフィルタ
    if (selectedChannel !== "all") {
      results = results.filter((v) => v.channelId === selectedChannel);
    }

    // タイトル検索
    if (titleQuery.trim()) {
      const queries = titleQuery.trim().toLowerCase().split(/\s+/);
      results = results.filter((v) =>
        queries.every((q) => v.title.toLowerCase().includes(q))
      );
    }

    // 期間フィルタ
    if (dateFrom) {
      results = results.filter((v) => v.publishedAt >= dateFrom);
    }
    if (dateTo) {
      results = results.filter((v) => v.publishedAt <= dateTo);
    }

    // 最低再生数フィルタ
    if (minViews && parseInt(minViews, 10) > 0) {
      results = results.filter((v) => v.views >= parseInt(minViews, 10));
    }

    // 平均再生数の◯倍フィルタ
    if (multiplier && parseFloat(multiplier) > 0) {
      const mult = parseFloat(multiplier);
      results = results.filter((v) => {
        const stats = channelStats[v.channelId];
        if (!stats || stats.avgViews === 0) return false;
        return v.views / stats.avgViews >= mult;
      });
    }

    // ソート
    results.sort((a, b) => {
      switch (sortBy) {
        case "views":
          return b.views - a.views;
        case "date":
          return b.publishedAt.localeCompare(a.publishedAt);
        case "engagement":
          return b.engagementRate - a.engagementRate;
        case "multiplier": {
          const aMult = channelStats[a.channelId]?.avgViews
            ? a.views / channelStats[a.channelId].avgViews
            : 0;
          const bMult = channelStats[b.channelId]?.avgViews
            ? b.views / channelStats[b.channelId].avgViews
            : 0;
          return bMult - aMult;
        }
        default:
          return 0;
      }
    });

    return results;
  }, [allVideos, channelStats, titleQuery, minViews, multiplier, dateFrom, dateTo, selectedChannel, sortBy]);

  const getMultiplier = (video: VideoResult): number => {
    const stats = channelStats[video.channelId];
    if (!stats || stats.avgViews === 0) return 0;
    return Math.round((video.views / stats.avgViews) * 100) / 100;
  };

  // チャンネル一覧（データ取得済みのもの）
  const channelOptions = useMemo(() => {
    const seen = new Set<string>();
    return allVideos
      .filter((v) => {
        if (seen.has(v.channelId)) return false;
        seen.add(v.channelId);
        return true;
      })
      .map((v) => ({ id: v.channelId, name: v.channelName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVideos]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">動画検索</h1>
        <p className="text-gray-500 mt-1">
          登録チャンネルの動画を横断検索・フィルタリング
        </p>
      </div>

      {/* データ取得ボタン */}
      {!fetched && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6 text-center">
          <p className="text-gray-500 mb-4">
            登録チャンネルの動画データを取得して検索できるようにします
          </p>
          <button
            onClick={fetchAllVideos}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? progress || "取得中..." : "動画データを取得する"}
          </button>
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {fetched && (
        <>
          {/* 検索フィルター + データ更新 */}
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">検索条件</h2>
              <button
                onClick={fetchAllVideos}
                disabled={loading}
                className="text-sm text-accent hover:underline disabled:opacity-50"
              >
                {loading ? "更新中..." : "データを再取得"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* タイトル検索 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">タイトル検索</label>
                <input
                  type="text"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder="キーワード（スペースでAND検索）"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>

              {/* チャンネル */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">チャンネル</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none"
                >
                  <option value="all">すべてのチャンネル</option>
                  {channelOptions.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>

              {/* 最低再生数 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">最低再生数</label>
                <input
                  type="number"
                  value={minViews}
                  onChange={(e) => setMinViews(e.target.value)}
                  placeholder="例: 100000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>

              {/* 平均の◯倍 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">平均再生数の◯倍以上</label>
                <input
                  type="number"
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="例: 2（= 平均の2倍以上）"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>

              {/* 期間 開始 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">公開日（から）</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>

              {/* 期間 終了 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">公開日（まで）</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                />
              </div>
            </div>

            {/* ソートと結果数 */}
            <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">並び替え:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none"
                >
                  <option value="views">再生数</option>
                  <option value="multiplier">再生倍率</option>
                  <option value="date">公開日</option>
                  <option value="engagement">エンゲージメント</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">
                {filteredVideos.length}件 / {allVideos.length}件中
              </p>
            </div>
          </div>

          {/* 検索結果 */}
          <div className="space-y-3">
            {filteredVideos.slice(0, 100).map((video) => {
              const mult = getMultiplier(video);
              return (
                <div
                  key={video.id}
                  className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-4 hover:border-accent/20 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* サムネイル */}
                    {video.thumbnailUrl ? (
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-48 h-28 rounded-lg object-cover hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ) : (
                      <div className="w-48 h-28 rounded-lg bg-gray-100 shrink-0" />
                    )}

                    {/* 動画情報 */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-accent transition-colors line-clamp-2 block mb-1"
                      >
                        {video.title}
                      </a>
                      <p className="text-xs text-gray-500 mb-2">{video.channelName}</p>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <span className="text-foreground font-semibold">
                          {formatNumber(video.views)}回再生
                        </span>
                        {mult > 0 && (
                          <span
                            className={`font-semibold ${
                              mult >= 3
                                ? "text-danger"
                                : mult >= 2
                                ? "text-warning"
                                : mult >= 1.5
                                ? "text-success"
                                : "text-gray-500"
                            }`}
                          >
                            {mult.toFixed(1)}倍
                          </span>
                        )}
                        <span className="text-gray-500">{video.publishedAt}</span>
                        <span className="text-gray-500">{video.duration}</span>
                        <span className="text-gray-500">{video.engagementRate}% エンゲージメント</span>
                        <button
                          onClick={() => {
                            const url = `https://www.youtube.com/watch?v=${video.id}`;
                            if (typeof window !== "undefined") {
                              sessionStorage.setItem("analysis_video_url", url);
                            }
                            router.push("/analysis");
                          }}
                          className="text-accent hover:underline font-medium"
                        >
                          台本分析へ
                        </button>
                      </div>

                      {/* タグ */}
                      {video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {video.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 右サイド：再生倍率を大きく */}
                    <div className="text-right shrink-0 hidden md:block">
                      {mult > 0 && (
                        <>
                          <p
                            className={`text-2xl font-bold ${
                              mult >= 3
                                ? "text-danger"
                                : mult >= 2
                                ? "text-warning"
                                : mult >= 1.5
                                ? "text-success"
                                : "text-gray-400"
                            }`}
                          >
                            {mult.toFixed(1)}x
                          </p>
                          <p className="text-xs text-gray-400">平均比</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredVideos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">条件に一致する動画がありません</p>
              <p className="text-sm mt-1">フィルターを変更してみてください</p>
            </div>
          )}

          {filteredVideos.length > 100 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              上位100件を表示中（全{filteredVideos.length}件）
            </p>
          )}
        </>
      )}
    </div>
  );
}
