"use client";

import { useState, useEffect, useCallback } from "react";
import { getChannels, addChannel, removeChannel, updateChannel, getApiKey } from "@/lib/channel-store";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";

interface VideoData {
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
}

function ChannelCard({
  channel,
  onSelect,
  onRemove,
}: {
  channel: RegisteredChannel;
  onSelect: (ch: RegisteredChannel) => void;
  onRemove: (url: string) => void;
}) {
  return (
    <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 hover:border-accent/30 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        {channel.thumbnailUrl ? (
          <img
            src={channel.thumbnailUrl}
            alt={channel.name || ""}
            className="w-14 h-14 rounded-full shrink-0 object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-lg shrink-0">
            {(channel.name || channel.handle || "?").charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-foreground truncate cursor-pointer hover:text-accent"
            onClick={() => onSelect(channel)}
          >
            {channel.name || channel.handle || channel.channelId || "取得中..."}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {channel.handle ? `@${channel.handle}` : channel.channelId || ""}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(channel.url); }}
          className="text-gray-300 hover:text-danger text-sm shrink-0"
          title="削除"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {channel.subscribers != null && (
        <div
          className="grid grid-cols-3 gap-4 mt-5 text-center cursor-pointer"
          onClick={() => onSelect(channel)}
        >
          <div>
            <p className="text-lg font-bold">{formatNumber(channel.subscribers)}</p>
            <p className="text-xs text-gray-500">登録者</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatNumber(channel.totalViews || 0)}</p>
            <p className="text-xs text-gray-500">総再生数</p>
          </div>
          <div>
            <p className="text-lg font-bold">{channel.videoCount || 0}</p>
            <p className="text-xs text-gray-500">動画数</p>
          </div>
        </div>
      )}

      {!channel.subscribers && (
        <p className="mt-4 text-sm text-gray-400 text-center">
          APIキーを設定してデータを取得してください
        </p>
      )}
    </div>
  );
}

function ChannelDetail({
  channel,
  onBack,
}: {
  channel: RegisteredChannel;
  onBack: () => void;
}) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchVideos = useCallback(async () => {
    const apiKey = getApiKey("yt_api_key");
    if (!apiKey || !channel.channelId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/youtube/videos?channelId=${channel.channelId}&apiKey=${encodeURIComponent(apiKey)}&maxResults=20`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setVideos(data.videos || []);
      }
    } catch {
      setError("動画情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [channel.channelId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div>
      <button onClick={onBack} className="text-accent text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        チャンネル一覧に戻る
      </button>

      <div className="bg-card-bg rounded-xl p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-6 mb-6">
          {channel.thumbnailUrl ? (
            <img src={channel.thumbnailUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-2xl">
              {(channel.name || "?").charAt(0)}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{channel.name || "不明"}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {channel.handle ? `@${channel.handle}` : channel.channelId}
            </p>
          </div>
        </div>

        {channel.subscribers != null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "登録者数", value: formatNumber(channel.subscribers) + "人" },
              { label: "総再生回数", value: formatNumber(channel.totalViews || 0) + "回" },
              { label: "動画数", value: (channel.videoCount || 0) + "本" },
              { label: "最終取得", value: channel.lastFetched ? new Date(channel.lastFetched).toLocaleDateString("ja-JP") : "未取得" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {channel.description && (
          <p className="mt-4 text-sm text-gray-600 line-clamp-3">{channel.description}</p>
        )}
      </div>

      {/* 動画一覧 */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">最近の動画</h3>
          {loading && <span className="text-sm text-gray-400">取得中...</span>}
        </div>

        {error && (
          <div className="p-6 text-sm text-danger">{error}</div>
        )}

        {videos.length === 0 && !loading && !error && (
          <div className="p-6 text-sm text-gray-400 text-center">
            {getApiKey("yt_api_key") ? "動画が見つかりません" : "設定ページからYouTube APIキーを登録すると動画一覧が表示されます"}
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {videos
            .sort((a, b) => b.views - a.views)
            .map((video) => (
              <div key={video.id} className="p-6">
                <div className="flex items-start gap-4">
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-40 h-24 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium mb-2 line-clamp-2">{video.title}</h4>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {video.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{tag}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>{formatNumber(video.views)}回再生</span>
                      <span>{formatNumber(video.likes)}いいね</span>
                      <span>{formatNumber(video.comments)}コメント</span>
                      <span>{video.duration}</span>
                      <span>{video.publishedAt}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-accent">{video.engagementRate}%</p>
                    <p className="text-xs text-gray-500">エンゲージメント</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ChannelAnalysisPage() {
  const [channels, setChannels] = useState<RegisteredChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<RegisteredChannel | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchingAll, setFetchingAll] = useState(false);

  useEffect(() => {
    setChannels(getChannels());
  }, []);

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const updated = addChannel(newUrl.trim());
    setChannels(updated);
    setNewUrl("");
  };

  const handleRemove = (url: string) => {
    const updated = removeChannel(url);
    setChannels(updated);
  };

  const fetchAllChannelData = async () => {
    const apiKey = getApiKey("yt_api_key");
    if (!apiKey) {
      alert("設定ページからYouTube APIキーを登録してください");
      return;
    }

    setFetchingAll(true);
    const current = getChannels();

    for (const ch of current) {
      try {
        const params = new URLSearchParams({ apiKey });
        if (ch.handle) params.set("handle", ch.handle);
        else if (ch.channelId) params.set("channelId", ch.channelId);
        else continue;

        const res = await fetch(`/api/youtube/channel-info?${params}`);
        const data = await res.json();

        if (!data.error) {
          updateChannel(ch.url, {
            channelId: data.channelId,
            name: data.name,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            subscribers: data.subscribers,
            totalViews: data.totalViews,
            videoCount: data.videoCount,
          });
        }
      } catch {
        // continue to next channel
      }
    }

    setChannels(getChannels());
    setFetchingAll(false);
  };

  const filteredChannels = channels.filter(
    (ch) =>
      (ch.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.handle || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedChannel) {
    return (
      <div className="p-8">
        <ChannelDetail channel={selectedChannel} onBack={() => setSelectedChannel(null)} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">チャンネル分析</h1>
        <p className="text-gray-500 mt-1">競合チャンネルを登録・分析（{channels.length}チャンネル登録中）</p>
      </div>

      {/* チャンネル追加 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-sm mb-3">チャンネルを追加</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="YouTubeチャンネルURLを貼り付け（例: https://youtube.com/@xxx）"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
          />
          <button
            onClick={handleAdd}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
          >
            追加
          </button>
        </div>
      </div>

      {/* 検索・一括取得 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="チャンネル名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
        />
        <button
          onClick={fetchAllChannelData}
          disabled={fetchingAll}
          className="px-5 py-2.5 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
        >
          {fetchingAll ? "取得中..." : "全チャンネルのデータを取得"}
        </button>
      </div>

      {/* チャンネルグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredChannels.map((ch) => (
          <ChannelCard
            key={ch.url}
            channel={ch}
            onSelect={setSelectedChannel}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {filteredChannels.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">チャンネルが見つかりません</p>
        </div>
      )}
    </div>
  );
}
