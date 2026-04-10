"use client";

import { useState, useEffect, useCallback } from "react";
import { getChannels, addChannel, removeChannel, updateChannel, getApiKey } from "@/lib/channel-store";
import { pullSharedSettings, pushSharedSettings } from "@/lib/shared-sync";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";
import { calcSimilarity } from "@/lib/similarity";

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
          <div className="flex items-center gap-2">
            <h3
              className="font-semibold text-foreground truncate cursor-pointer hover:text-accent"
              onClick={() => onSelect(channel)}
            >
              {channel.name || channel.handle || channel.channelId || "取得中..."}
            </h3>
            <a
              href={channel.handle ? `https://www.youtube.com/@${channel.handle}` : channel.channelId ? `https://www.youtube.com/channel/${channel.channelId}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-red-500 shrink-0"
              onClick={(e) => e.stopPropagation()}
              title="YouTubeで開く"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
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
    // サーバーから共有設定を取得してからチャンネル一覧を表示
    pullSharedSettings().then(() => {
      setChannels(getChannels());
    });
  }, []);

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const updated = addChannel(newUrl.trim());
    setChannels(updated);
    setNewUrl("");
    pushSharedSettings();
  };

  const handleRemove = (url: string) => {
    const updated = removeChannel(url);
    setChannels(updated);
    pushSharedSettings();
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
      <div className="p-4 md:p-8">
        <ChannelDetail channel={selectedChannel} onBack={() => setSelectedChannel(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">チャンネル分析</h1>
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

      {/* 競合チャンネル発見 */}
      <CompetitorDiscovery registeredChannelIds={channels.map((ch) => ch.channelId).filter(Boolean) as string[]} onAddChannel={(url) => { addChannel(url); setChannels(getChannels()); }} />
    </div>
  );
}

// ===== 競合チャンネル発見コンポーネント =====
interface DiscoveredVideo {
  id: string;
  title: string;
  channelName: string;
  channelId: string;
  views: number;
  publishedAt: string;
  thumbnailUrl: string;
  similarity: number;
  matchedWith: string;
}

interface DiscoveredChannel {
  channelId: string;
  channelName: string;
  videos: DiscoveredVideo[];
  avgViews: number;
  hitSources: string[]; // どのソースタイトルでヒットしたか
}

const DISCOVERY_CACHE_KEY = "fortune_yt_discovery_cache";

function CompetitorDiscovery({ registeredChannelIds, onAddChannel }: { registeredChannelIds: string[]; onAddChannel: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const [minViews, setMinViews] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<DiscoveredChannel[]>([]);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [publishedAfter, setPublishedAfter] = useState("");

  // キャッシュから復元
  useEffect(() => {
    try {
      const cached = localStorage.getItem(DISCOVERY_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.results) setResults(data.results);
        if (data.threshold) setThreshold(data.threshold);
        if (data.minViews) setMinViews(data.minViews);
      }
    } catch { /* ignore */ }
  }, []);

  const handleDiscover = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }

    const channels = getChannels().filter((ch) => ch.channelId);
    if (channels.length === 0) { setError("チャンネルを登録してデータを取得してください"); return; }

    setLoading(true);
    setError("");
    setProgress("登録チャンネルの人気動画を取得中...");

    try {
      // Step 1: 登録チャンネルの直近の人気動画を取得
      setProgress(`${channels.length}チャンネルの動画を取得中...`);
      let allVideos: { title: string; views: number; publishedAt: string }[] = [];

      // 各チャンネルの動画を個別取得（タイムアウト防止）
      for (const ch of channels.slice(0, 5)) {
        try {
          setProgress(`${ch.name || ch.handle || ch.channelId}の動画を取得中...`);
          const vidRes = await fetch(`/api/youtube/videos?channelId=${ch.channelId}&apiKey=${encodeURIComponent(ytApiKey)}&maxResults=20`);
          const vidData = await vidRes.json();
          if (vidData.videos) {
            allVideos.push(...vidData.videos.map((v: { title: string; views: number; publishedAt: string }) => ({
              title: v.title, views: v.views, publishedAt: v.publishedAt,
            })));
          }
        } catch { /* skip */ }
      }

      setProgress(`${allVideos.length}本の動画からソースタイトルを選定中...`);

      // 再生数順にソートして上位8本を選ぶ
      const sourceTitles = allVideos
        .sort((a, b) => b.views - a.views)
        .slice(0, 8)
        .map((v) => v.title);

      if (sourceTitles.length === 0) {
        setError(`動画が取得できませんでした（${allVideos.length}本取得）。チャンネル分析で先に「全チャンネルのデータを取得」してください。`);
        setLoading(false);
        return;
      }

      // Step 2: YouTube検索
      const allMatched: DiscoveredVideo[] = [];
      const thresholdDecimal = threshold / 100;

      // キーワードが指定されている場合は、キーワード直接検索も行う
      const searchQueries: { query: string; source: string }[] = [];

      if (keyword.trim()) {
        // キーワード直接検索（最優先）
        searchQueries.push({ query: keyword.trim(), source: `キーワード: ${keyword}` });
      }

      // ソースタイトルから検索クエリを生成
      for (const title of sourceTitles) {
        const phrases = title
          .replace(/[【】「」『』（）()！？!?。、・｜|\/\s\d]/g, " ")
          .split(/[のはがをにでとへもやかられるたますいうえおした]+/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length >= 2 && p.length <= 15);
        const searchQuery = phrases.slice(0, 4).join(" ");
        if (searchQuery) {
          searchQueries.push({ query: keyword.trim() ? `${searchQuery} ${keyword}` : searchQuery, source: title });
        }
      }

      setProgress(`${searchQueries.length}件のクエリでYouTube検索中...`);

      for (let i = 0; i < searchQueries.length; i++) {
        const { query, source } = searchQueries[i];
        setProgress(`検索${i + 1}/${searchQueries.length}: 「${query.substring(0, 30)}...」（${allMatched.length}件ヒット中）`);

        if (i > 0) await new Promise((r) => setTimeout(r, 1500)); // API負荷軽減

        try {
          const searchParams = new URLSearchParams({ q: query, apiKey: ytApiKey, maxResults: "25" });
          if (publishedAfter) searchParams.set("publishedAfter", new Date(publishedAfter).toISOString());
          const searchRes = await fetch(`/api/youtube/search-public?${searchParams}`);
          const searchData = await searchRes.json();

          if (searchData.videos) {
            for (const v of searchData.videos) {
              if (registeredChannelIds.includes(v.channelId)) continue;
              if (v.views < minViews) continue;
              // 重複動画を除外
              if (allMatched.some((m) => m.id === v.id)) continue;
              const sim = calcSimilarity(source, v.title);
              allMatched.push({ ...v, similarity: sim, matchedWith: source });
            }
          }
        } catch { /* skip this search */ }
      }

      // Step 3: チャンネル単位で集約
      const channelMap = new Map<string, DiscoveredChannel>();
      for (const v of allMatched) {
        if (!channelMap.has(v.channelId)) {
          channelMap.set(v.channelId, { channelId: v.channelId, channelName: v.channelName, videos: [], avgViews: 0, hitSources: [] });
        }
        const ch = channelMap.get(v.channelId)!;
        // 同じ動画の重複を除外
        if (!ch.videos.some((ev) => ev.id === v.id)) {
          ch.videos.push(v);
        }
        if (!ch.hitSources.includes(v.matchedWith)) {
          ch.hitSources.push(v.matchedWith);
        }
      }

      const discovered = [...channelMap.values()]
        .map((ch) => ({ ...ch, avgViews: Math.round(ch.videos.reduce((s, v) => s + v.views, 0) / ch.videos.length) }))
        .sort((a, b) => b.hitSources.length - a.hitSources.length || b.videos.length - a.videos.length || b.avgViews - a.avgViews);

      setResults(discovered);

      if (discovered.length === 0) {
        setError(`検索完了（${sourceTitles.length}タイトルで検索、${allMatched.length}件ヒット）。${minViews}回再生以上の未登録チャンネルの動画が見つかりませんでした。最低再生数を下げてみてください。`);
      }

      // キャッシュに保存
      try {
        localStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify({ results: discovered, threshold, minViews, updatedAt: new Date().toISOString() }));
      } catch { /* ignore */ }

      setProgress("");
    } catch { setError("検索に失敗しました"); }
    finally { setLoading(false); }
  };

  // フィルタ: 再生数のみ（類似率はソートに使用）
  const filteredResults = results.map((ch) => ({
    ...ch,
    videos: ch.videos.filter((v) => v.views >= minViews),
  })).filter((ch) => ch.videos.length > 0);

  const handleAddChannel = (channelId: string) => {
    onAddChannel(`https://youtube.com/channel/${channelId}`);
    setAddedIds((prev) => new Set(prev).add(channelId));
  };

  return (
    <div className="mt-8">
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button onClick={() => setOpen(!open)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
          <div>
            <h2 className="font-semibold">競合チャンネルを発見</h2>
            <p className="text-xs text-gray-500 mt-0.5">登録チャンネルの人気動画と類似した動画を出している未登録チャンネルを自動発見</p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            {/* ワンクリック検索 */}
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <button onClick={handleDiscover} disabled={loading}
                className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
                {loading ? progress || "検索中..." : results.length > 0 ? "再検索する" : "競合チャンネルを探す"}
              </button>
              <div>
                <label className="block text-xs text-gray-500 mb-1">キーワード</label>
                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 金運 ヒーリング"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm w-48 focus:border-accent outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">投稿期間</label>
                <select value={publishedAfter} onChange={(e) => setPublishedAfter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                  <option value="">全期間</option>
                  <option value={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}>1週間以内</option>
                  <option value={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}>1ヶ月以内</option>
                  <option value={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}>3ヶ月以内</option>
                  <option value={new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}>半年以内</option>
                  <option value={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}>1年以内</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">最低再生数</label>
                <select value={minViews} onChange={(e) => setMinViews(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                  <option value={5000}>5,000回</option>
                  <option value={10000}>1万回</option>
                  <option value={30000}>3万回</option>
                  <option value={50000}>5万回</option>
                  <option value={100000}>10万回</option>
                </select>
              </div>
            </div>

            {error && <p className="text-danger text-sm mb-3">{error}</p>}

            {/* 結果 */}
            {filteredResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">{filteredResults.length}チャンネル発見</p>
                {filteredResults.map((ch) => (
                  <div key={ch.channelId} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <a href={`https://youtube.com/channel/${ch.channelId}`} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-accent hover:underline">
                          {ch.channelName}
                          <svg className="w-3 h-3 inline ml-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                        <p className="text-xs text-gray-500">
                          ヒット{ch.videos.length}本 · 平均{formatNumber(ch.avgViews)}回再生
                          {ch.hitSources.length >= 2 && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                              {ch.hitSources.length}つの訴求でヒット
                            </span>
                          )}
                        </p>
                        {ch.hitSources.length >= 2 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            検索元: {ch.hitSources.map((s) => `「${s.substring(0, 15)}...」`).join(", ")}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleAddChannel(ch.channelId)} disabled={addedIds.has(ch.channelId)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium shrink-0 ${addedIds.has(ch.channelId) ? "bg-green-100 text-green-700" : "bg-accent text-white hover:bg-accent/90"}`}>
                        {addedIds.has(ch.channelId) ? "追加済み" : "追跡する"}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {ch.videos.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 bg-white rounded p-2">
                          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-16 h-10 rounded object-cover shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{v.title}</p>
                            <p className="text-xs text-gray-400 truncate">検索元: {v.matchedWith.substring(0, 25)}...</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold">{formatNumber(v.views)}回</p>
                            <span className={`text-xs font-bold ${v.similarity >= 0.7 ? "text-red-500" : v.similarity >= 0.5 ? "text-yellow-600" : "text-green-600"}`}>
                              類似{Math.round(v.similarity * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredResults.length === 0 && results.length > 0 && (
              <p className="text-sm text-gray-400 text-center py-4">現在のフィルタ条件に一致するチャンネルがありません。類似率や再生数を調整してください。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
