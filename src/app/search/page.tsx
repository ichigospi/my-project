"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getChannels, getApiKey } from "@/lib/channel-store";
import { pullSharedSettings } from "@/lib/shared-sync";
import type { RegisteredChannel } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";
import { getAiModel } from "@/lib/ai-model";
import {
  classifyTypeByRule, pullVideoTags, saveVideoTags, resolveType, resolveTheme,
  type VideoTag, type VideoType, type VideoTheme,
} from "@/lib/video-tag-store";
import { cacheGet, cacheSet } from "@/lib/search-cache";

interface VideoResult {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  durationSec?: number;
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

const SEARCH_CACHE_KEY = "fortune_yt_search_cache";       // 旧localStorageキー（移行読み込みのみ）
const SEARCH_IDB_KEY = "search_videos";                   // IndexedDB上の動画データ
const SEARCH_FILTERS_KEY = "fortune_yt_search_filters";   // 絞り込み条件（小さいのでlocalStorage）

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
  // ジャンル・長さフィルタ
  const [typeFilter, setTypeFilter] = useState<"all" | VideoType>("all");
  const [themeFilter, setThemeFilter] = useState<"all" | VideoTheme>("all");
  const [lengthFilter, setLengthFilter] = useState<"all" | "short" | "long">("all");
  // AI/手動判定タグ（videoId -> tag。全端末共有）
  const [videoTags, setVideoTags] = useState<Record<string, VideoTag>>({});
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState("");

  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    pullSharedSettings().then(() => setChannels(getChannels()));
    pullVideoTags().then(setVideoTags);
    // 絞り込み条件を復元（小さいのでlocalStorage）
    try {
      const f = JSON.parse(localStorage.getItem(SEARCH_FILTERS_KEY) || "{}");
      if (f.titleQuery) setTitleQuery(f.titleQuery);
      if (f.minViews) setMinViews(f.minViews);
      if (f.multiplier) setMultiplier(f.multiplier);
      if (f.dateFrom) setDateFrom(f.dateFrom);
      if (f.dateTo) setDateTo(f.dateTo);
      if (f.selectedChannel) setSelectedChannel(f.selectedChannel);
      if (f.sortBy) setSortBy(f.sortBy);
      if (f.typeFilter) setTypeFilter(f.typeFilter);
      if (f.themeFilter) setThemeFilter(f.themeFilter);
      if (f.lengthFilter) setLengthFilter(f.lengthFilter);
    } catch { /* ignore */ }
    // 動画データを復元（IndexedDB優先。無ければ旧localStorageキャッシュから移行）
    (async () => {
      type CachedData = { videos?: VideoResult[]; channelStats?: Record<string, ChannelStats>; savedAt?: string };
      let data = await cacheGet<CachedData>(SEARCH_IDB_KEY);
      if (!data?.videos?.length) {
        try {
          const legacy = localStorage.getItem(SEARCH_CACHE_KEY);
          if (legacy) {
            data = JSON.parse(legacy);
            if (data?.videos?.length) cacheSet(SEARCH_IDB_KEY, data); // IndexedDBへ移行
          }
        } catch { /* ignore */ }
      }
      if (data?.videos && data.videos.length > 0) {
        setAllVideos(data.videos);
        setChannelStats(data.channelStats || {});
        setSavedAt(data.savedAt || "");
        setFetched(true);
      }
    })();
  }, []);

  // 絞り込み条件は変更のたびに保存（次回表示時に復元）
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify({
        titleQuery, minViews, multiplier, dateFrom, dateTo, selectedChannel, sortBy, typeFilter, themeFilter, lengthFilter,
      }));
    } catch { /* ignore */ }
  }, [titleQuery, minViews, multiplier, dateFrom, dateTo, selectedChannel, sortBy, typeFilter, themeFilter, lengthFilter]);

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
        // IndexedDBに保存（localStorageは容量上限で保存に失敗することがあるため使わない）
        const stamp = new Date().toISOString();
        setSavedAt(stamp);
        cacheSet(SEARCH_IDB_KEY, { videos, channelStats: stats, savedAt: stamp });
        try { localStorage.removeItem(SEARCH_CACHE_KEY); } catch { /* ignore */ }
      }
    } catch {
      setError("動画データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 動画の秒数（新データはdurationSec、古いキャッシュは表示用文字列 "31:42" から逆算）
  const getDurationSec = (v: VideoResult): number => {
    if (typeof v.durationSec === "number") return v.durationSec;
    const parts = (v.duration || "").split(":").map((s) => parseInt(s, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  // フィルタリング
  const filteredVideos = useMemo(() => {
    let results = [...allVideos];

    // チャンネルフィルタ
    if (selectedChannel !== "all") {
      results = results.filter((v) => v.channelId === selectedChannel);
    }

    // 種別フィルタ（タロット/その他。手動 > AI > ルールの順で解決）
    if (typeFilter !== "all") {
      results = results.filter((v) => resolveType(videoTags[v.id], v.channelName, v.title) === typeFilter);
    }

    // テーマフィルタ（金運/総合/恋愛）
    if (themeFilter !== "all") {
      results = results.filter((v) => resolveTheme(videoTags[v.id], v.title) === themeFilter);
    }

    // 長さフィルタ（ショート=3分以下 / 長尺=3分超）
    if (lengthFilter !== "all") {
      results = results.filter((v) => {
        const sec = getDurationSec(v);
        return lengthFilter === "short" ? sec > 0 && sec <= 180 : sec > 180;
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, channelStats, titleQuery, minViews, multiplier, dateFrom, dateTo, selectedChannel, sortBy, typeFilter, themeFilter, lengthFilter, videoTags]);

  // ===== ジャンルのAI自動判定 =====
  // 対象: 保存済みタグが無く、ルール（チャンネル名・タイトル）でもタロットと断定できなかった動画
  const unjudgedVideos = useMemo(
    () => allVideos.filter((v) => !videoTags[v.id] && !classifyTypeByRule(v.channelName, v.title)),
    [allVideos, videoTags]
  );

  const classifyWithAI = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("設定ページからAI APIキーを登録してください"); return; }
    const targets = unjudgedVideos;
    if (targets.length === 0) return;
    setClassifying(true);
    setError("");
    try {
      for (let i = 0; i < targets.length; i += 10) {
        const batch = targets.slice(i, i + 10);
        setClassifyProgress(`AI判定中... ${Math.min(i + 10, targets.length)}/${targets.length}本`);
        const res = await fetch("/api/youtube/classify-videos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videos: batch.map((v) => ({ videoId: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl })),
            aiApiKey, aiModel: getAiModel("check"),
          }),
        });
        const data = await res.json();
        if (data.error) { setError(`AI判定を中断しました: ${data.error}（判定済み分は保存されています）`); break; }
        const judgedAt = new Date().toISOString();
        const patch: Record<string, VideoTag> = {};
        for (const it of (data.items || []) as { videoId: string; tarot: boolean; theme: VideoTheme }[]) {
          patch[it.videoId] = { type: it.tarot ? "tarot" : "other", theme: it.theme, source: "ai", judgedAt };
        }
        if (Object.keys(patch).length > 0) {
          await saveVideoTags(patch);
          setVideoTags((prev) => ({ ...prev, ...patch }));
        }
      }
      setClassifyProgress("");
    } finally {
      setClassifying(false);
    }
  };

  // 手動修正: 種別はクリックでタロット⇄その他、テーマは金運→総合→恋愛の順で切り替え
  const toggleType = (v: VideoResult) => {
    const cur = resolveType(videoTags[v.id], v.channelName, v.title);
    const next: VideoTag = {
      type: cur === "tarot" ? "other" : "tarot",
      theme: resolveTheme(videoTags[v.id], v.title),
      source: "manual", judgedAt: new Date().toISOString(),
    };
    setVideoTags((prev) => ({ ...prev, [v.id]: next }));
    saveVideoTags({ [v.id]: next });
  };

  const cycleTheme = (v: VideoResult) => {
    const cur = resolveTheme(videoTags[v.id], v.title);
    const order: VideoTheme[] = ["money", "general", "love"];
    const next: VideoTag = {
      type: resolveType(videoTags[v.id], v.channelName, v.title),
      theme: order[(order.indexOf(cur) + 1) % order.length],
      source: "manual", judgedAt: new Date().toISOString(),
    };
    setVideoTags((prev) => ({ ...prev, [v.id]: next }));
    saveVideoTags({ [v.id]: next });
  };

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
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">動画検索</h1>
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
              <div className="flex items-center gap-3">
                {savedAt && (
                  <span className="text-xs text-gray-400">
                    最終取得: {new Date(savedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <button
                  onClick={fetchAllVideos}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50"
                >
                  {loading ? "更新中..." : "🔄 最新のデータに更新"}
                </button>
              </div>
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

            {/* ジャンル・長さフィルタ */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">種別:</span>
                {([["all", "すべて"], ["tarot", "🃏 タロット"], ["other", "🧘 その他"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setTypeFilter(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${typeFilter === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">テーマ:</span>
                {([["all", "すべて"], ["money", "💰 金運"], ["general", "🔮 総合"], ["love", "💕 恋愛"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setThemeFilter(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${themeFilter === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">長さ:</span>
                {([["all", "すべて"], ["short", "ショート(3分以下)"], ["long", "長尺"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setLengthFilter(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${lengthFilter === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {unjudgedVideos.length > 0 && (
                <button onClick={classifyWithAI} disabled={classifying}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                  title="チャンネル名・タイトルで判定できなかった動画のサムネをAIが見て、タロットかどうかとテーマを判定します（結果は全端末で共有）">
                  {classifying ? classifyProgress || "AI判定中..." : `🏷 未判定${unjudgedVideos.length}本をAIで自動判定`}
                </button>
              )}
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
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* サムネイル（スマホでは全幅・PCでは左に固定幅） */}
                    {video.thumbnailUrl ? (
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 block"
                      >
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-full aspect-video sm:w-48 sm:h-28 sm:aspect-auto rounded-lg object-cover hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ) : (
                      <div className="hidden sm:block w-48 h-28 rounded-lg bg-gray-100 shrink-0" />
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

                      <div className="flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-1 text-sm">
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
                            router.push(`/analysis?video=${encodeURIComponent(url)}`);
                          }}
                          className="text-accent hover:underline font-medium"
                        >
                          台本分析へ
                        </button>
                      </div>

                      {/* タグ */}
                      <div className="flex flex-wrap gap-1 mt-2 items-center">
                        {(() => {
                          const vType = resolveType(videoTags[video.id], video.channelName, video.title);
                          const vTheme = resolveTheme(videoTags[video.id], video.title);
                          const themeLabel = vTheme === "money" ? "💰金運" : vTheme === "love" ? "💕恋愛" : "🔮総合";
                          return (
                            <>
                              <button onClick={() => toggleType(video)} title="クリックで タロット⇄その他 を手動修正"
                                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${vType === "tarot" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-teal-50 text-teal-700 border-teal-200"} hover:opacity-70`}>
                                {vType === "tarot" ? "🃏タロット" : "🧘その他"}
                              </button>
                              <button onClick={() => cycleTheme(video)} title="クリックで 金運→総合→恋愛 を手動修正"
                                className="text-xs px-2 py-0.5 rounded-full font-medium border bg-amber-50 text-amber-700 border-amber-200 hover:opacity-70">
                                {themeLabel}
                              </button>
                            </>
                          );
                        })()}
                        {video.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
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
