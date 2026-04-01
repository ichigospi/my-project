"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiKey } from "@/lib/channel-store";
import { getMyChannel, saveMyChannel, detectGenre, GENRE_LABELS, genId, getAnalysisLogs, saveAnalysisLog, getWeeklySnapshots, saveWeeklySnapshot } from "@/lib/project-store";
import type { MyChannelData, MyChannelVideo, Genre, AnalysisLog, WeeklySnapshot } from "@/lib/project-store";
import { formatNumber } from "@/lib/mock-data";

// ===== アナリティクス型 =====
interface VideoAnalyticsData {
  videoId: string;
  avgViewDuration?: number;   // 秒
  avgViewPercentage?: number; // %
  views?: number;
  subscribersGained?: number;
}

interface ChannelStats {
  avgViewDuration?: number;
  avgViewPercentage?: number;
  totalViews?: number;
  subscribersGained?: number;
}

// 動画に analytics をマージした拡張型
interface EnrichedVideo extends MyChannelVideo {
  views: number;
  likes: number;
  comments: number;
  growth: number;
  // analytics
  avgViewDuration?: number;
  avgViewPercentage?: number;
  subscribersGained?: number;
}

// ===== ヘルパー =====
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

// マークダウンレンダリング
function renderMd(md: string) {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h2>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-accent">{line.slice(3)}</h3>;
    if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-700 ml-4 list-disc my-0.5">{line.slice(2)}</li>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(2, -2)}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
  });
}

export default function PerformancePage() {
  const router = useRouter();
  const [myChannel, setMyChannel] = useState<MyChannelData | null>(null);
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, VideoAnalyticsData>>({});
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const [showWeekly, setShowWeekly] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sortBy, setSortBy] = useState<"views" | "date" | "engagement" | "avgDuration">("views");
  const [filterGenre, setFilterGenre] = useState<Genre | "all">("all");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [retention, setRetention] = useState<{ timePercent: number; retentionPercent: number }[]>([]);
  const [detailAnalytics, setDetailAnalytics] = useState<{
    avgViewPercentage?: number;
    subscribersGained?: number;
    trafficSources?: { source: string; views: number }[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const hasOAuth =
    typeof window !== "undefined" && !!localStorage.getItem("oauth_access_token");

  // ===== トークンリフレッシュ =====
  const getValidAccessToken = async (): Promise<string> => {
    const accessToken = localStorage.getItem("oauth_access_token") || "";
    const refreshToken = localStorage.getItem("oauth_refresh_token") || "";
    const clientId = localStorage.getItem("oauth_client_id") || "";
    const clientSecret = localStorage.getItem("oauth_client_secret") || "";

    if (!refreshToken || !clientId || !clientSecret) return accessToken;

    // まずアクセストークンで試す。失敗したらリフレッシュ
    try {
      const testRes = await fetch(`/api/analytics/channel?accessToken=${encodeURIComponent(accessToken)}`);
      if (testRes.ok) {
        const testData = await testRes.json();
        if (!testData.error) return accessToken;
      }
    } catch { /* refresh */ }

    // リフレッシュ
    try {
      const res = await fetch("/api/auth/youtube/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, clientId, clientSecret }),
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("oauth_access_token", data.accessToken);
        return data.accessToken;
      }
    } catch { /* ignore */ }

    return accessToken;
  };

  // ===== チャンネルアナリティクス取得 =====
  const fetchChannelAnalytics = useCallback(async () => {
    if (!hasOAuth) return;

    setAnalyticsLoading(true);
    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) return;

      const res = await fetch(
        `/api/analytics/channel?accessToken=${encodeURIComponent(accessToken)}`
      );
      const data = await res.json();
      if (data.error) {
        console.error("Analytics error:", data.error);
        return;
      }

      if (data.channelStats) {
        setChannelStats({
          avgViewDuration: data.channelStats.avgDurationSec ?? data.channelStats.avgViewDuration,
          avgViewPercentage: data.channelStats.avgPercentage ?? data.channelStats.avgViewPercentage,
          totalViews: data.channelStats.views ?? data.channelStats.totalViews,
        });
      }

      if (data.perVideoStats && Array.isArray(data.perVideoStats)) {
        const map: Record<string, VideoAnalyticsData> = {};
        for (const vs of data.perVideoStats) {
          const id = vs.videoId;
          if (id) {
            map[id] = {
              videoId: id,
              avgViewDuration: vs.avgDurationSec ?? vs.avgViewDuration,
              avgViewPercentage: vs.avgPercentage ?? vs.avgViewPercentage,
              views: vs.views,
              subscribersGained: vs.subscribersGained,
            };
          }
        }
        setAnalyticsMap(map);
      }
    } catch {
      // ignore
    } finally {
      setAnalyticsLoading(false);
    }
  }, [hasOAuth]);

  useEffect(() => {
    const saved = getMyChannel();
    if (saved) setMyChannel(saved);
    setAnalysisLogs(getAnalysisLogs());
    setWeeklySnapshots(getWeeklySnapshots());
  }, []);

  useEffect(() => {
    if (myChannel) {
      fetchChannelAnalytics();
    }
  }, [myChannel, fetchChannelAnalytics]);

  // ===== チャンネル登録 =====
  const handleRegister = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }
    if (!channelUrl) { setError("チャンネルURLを入力してください"); return; }

    setLoading(true);
    setError("");

    try {
      const handleMatch = channelUrl.match(/@([\w.-]+)/);
      const channelIdMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
      const params = new URLSearchParams({ apiKey: ytApiKey });
      if (handleMatch) params.set("handle", handleMatch[1]);
      else if (channelIdMatch) params.set("channelId", channelIdMatch[1]);
      else { setError("正しいYouTubeチャンネルURLを入力してください"); setLoading(false); return; }

      const chRes = await fetch(`/api/youtube/channel-info?${params}`);
      const chData = await chRes.json();
      if (chData.error) { setError(chData.error); setLoading(false); return; }

      await fetchVideos(chData.channelId, chData.name, ytApiKey);
    } catch {
      setError("チャンネル登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ===== 動画一覧取得 =====
  const fetchVideos = async (channelId: string, channelName: string, ytApiKey: string) => {
    const vidRes = await fetch(
      `/api/youtube/videos?channelId=${channelId}&apiKey=${encodeURIComponent(ytApiKey)}&maxResults=50`
    );
    const vidData = await vidRes.json();
    if (vidData.error) { setError(vidData.error); return; }

    const existing = getMyChannel();
    const now = new Date().toISOString().split("T")[0];

    const videos: MyChannelVideo[] = (vidData.videos || []).map((v: {
      id: string; title: string; views: number; likes: number; comments: number;
      publishedAt: string; thumbnailUrl: string; duration: string;
    }) => {
      const prev = existing?.videos.find((ev) => ev.videoId === v.id);
      const newSnapshot = { date: now, views: v.views, likes: v.likes, comments: v.comments };
      const snapshots = prev?.snapshots
        ? [...prev.snapshots.filter((s) => s.date !== now), newSnapshot]
        : [newSnapshot];

      return {
        videoId: v.id,
        title: v.title,
        publishedAt: v.publishedAt,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        genre: prev?.genre || detectGenre(v.title),
        snapshots,
        linkedProjectId: prev?.linkedProjectId,
        dropoffNote: prev?.dropoffNote,
      };
    });

    const data: MyChannelData = {
      channelId,
      channelName,
      videos,
      lastFetched: new Date().toISOString(),
    };
    saveMyChannel(data);
    setMyChannel(data);
  };

  // ===== データ更新（YouTube + Analytics） =====
  // 週次スナップショット自動保存
  const autoSaveWeeklySnapshot = () => {
    const ch = getMyChannel();
    if (!ch || ch.videos.length === 0) return;
    // 今週の月曜日を計算
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const weekStart = monday.toISOString().split("T")[0];

    const videos = ch.videos.map((v) => {
      const latest = v.snapshots[v.snapshots.length - 1];
      return { title: v.title, views: latest?.views || 0, likes: latest?.likes || 0, comments: latest?.comments || 0 };
    });

    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
    const totalComments = videos.reduce((s, v) => s + v.comments, 0);
    const best = videos.reduce((a, b) => a.views > b.views ? a : b, videos[0]);

    // analyticsMapからsubscribersGainedを集計
    const totalSubs = Object.values(analyticsMap).reduce((s, v) => s + (v.subscribersGained || 0), 0);

    saveWeeklySnapshot({
      weekStart,
      totalViews,
      avgViews: Math.round(totalViews / videos.length),
      totalLikes,
      totalComments,
      videoCount: videos.length,
      subscribersGained: totalSubs,
      topVideo: { title: best.title, views: best.views },
    });
    setWeeklySnapshots(getWeeklySnapshots());
  };

  const handleRefresh = async () => {
    if (!myChannel) return;
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }
    setLoading(true);
    setError("");
    try {
      await fetchVideos(myChannel.channelId, myChannel.channelName, ytApiKey);
      await fetchChannelAnalytics();
      // 週次スナップショット自動保存
      autoSaveWeeklySnapshot();
    } catch {
      setError("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ===== AI分析 =====
  const handleAnalyze = async () => {
    if (!myChannel || myChannel.videos.length === 0) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setAnalyzing(true);
    setError("");
    try {
      const enrichedVideos = myChannel.videos.map((v) => {
        const latest = v.snapshots[v.snapshots.length - 1];
        const analytic = analyticsMap[v.videoId];
        return {
          title: v.title,
          views: latest?.views || 0,
          likes: latest?.likes || 0,
          comments: latest?.comments || 0,
          genre: GENRE_LABELS[v.genre],
          publishedAt: v.publishedAt,
          duration: v.duration,
          avgViewDuration: analytic?.avgViewDuration,
          avgViewPercentage: analytic?.avgViewPercentage,
          subscribersGained: analytic?.subscribersGained,
        };
      });

      const res = await fetch("/api/performance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videos: enrichedVideos,
          channelStats,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setAnalysis(data.analysis);
        // 履歴保存
        const totalViews = enrichedVideos.reduce((s, v) => s + v.views, 0);
        const log: AnalysisLog = {
          id: genId(),
          date: new Date().toISOString(),
          analysis: data.analysis,
          videoCount: enrichedVideos.length,
          avgViews: enrichedVideos.length > 0 ? Math.round(totalViews / enrichedVideos.length) : 0,
        };
        saveAnalysisLog(log);
        setAnalysisLogs(getAnalysisLogs());
      }
    } catch {
      setError("分析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  };

  // ===== ジャンル変更 =====
  const handleGenreChange = (videoId: string, newGenre: Genre) => {
    if (!myChannel) return;
    const updated = {
      ...myChannel,
      videos: myChannel.videos.map((v) =>
        v.videoId === videoId ? { ...v, genre: newGenre } : v
      ),
    };
    saveMyChannel(updated);
    setMyChannel(updated);
  };

  // ===== 動画詳細アナリティクス取得 =====
  const fetchDetailAnalytics = async (videoId: string) => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    setLoadingDetail(true);
    setRetention([]);
    setDetailAnalytics(null);

    try {
      const [retRes, statsRes] = await Promise.all([
        fetch(
          `/api/analytics/retention?videoId=${videoId}&accessToken=${encodeURIComponent(accessToken)}`
        ),
        fetch(
          `/api/analytics/video-stats?videoId=${videoId}&accessToken=${encodeURIComponent(accessToken)}`
        ),
      ]);
      const retData = await retRes.json();
      const statsData = await statsRes.json();

      if (retData.retention) setRetention(retData.retention);
      if (statsData.stats || statsData.trafficSources) {
        setDetailAnalytics({
          avgViewPercentage: statsData.stats?.avgViewPercentage,
          subscribersGained: statsData.stats?.subscribersGained,
          trafficSources: statsData.trafficSources,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectVideo = (videoId: string) => {
    if (selectedVideo === videoId) {
      setSelectedVideo(null);
      return;
    }
    setSelectedVideo(videoId);
    if (hasOAuth) fetchDetailAnalytics(videoId);
  };

  // ===== 統計・KPI計算 =====
  const getEnrichedVideos = (): EnrichedVideo[] => {
    if (!myChannel) return [];
    return myChannel.videos.map((v) => {
      const latest = v.snapshots[v.snapshots.length - 1];
      const prev =
        v.snapshots.length >= 2 ? v.snapshots[v.snapshots.length - 2] : null;
      const analytic = analyticsMap[v.videoId];
      return {
        ...v,
        views: latest?.views || 0,
        likes: latest?.likes || 0,
        comments: latest?.comments || 0,
        growth: prev ? (latest?.views || 0) - prev.views : 0,
        avgViewDuration: analytic?.avgViewDuration,
        avgViewPercentage: analytic?.avgViewPercentage,
        subscribersGained: analytic?.subscribersGained,
      };
    });
  };

  const getKPIs = (enriched: EnrichedVideo[]) => {
    if (enriched.length === 0) return null;

    const withDuration = enriched.filter((v) => v.avgViewDuration != null);
    const avgViewDuration =
      withDuration.length > 0
        ? withDuration.reduce((s, v) => s + (v.avgViewDuration || 0), 0) /
          withDuration.length
        : null;

    const withPct = enriched.filter((v) => v.avgViewPercentage != null);
    const avgViewPercentage =
      withPct.length > 0
        ? withPct.reduce((s, v) => s + (v.avgViewPercentage || 0), 0) /
          withPct.length
        : null;

    const totalViews = enriched.reduce((s, v) => s + v.views, 0);
    const avgViews = totalViews > 0 ? Math.round(totalViews / enriched.length) : 0;

    const totalSubs = enriched.reduce((s, v) => s + (v.subscribersGained || 0), 0);
    const subConversionRate =
      totalViews > 0 ? (totalSubs / totalViews) * 100 : null;

    return { avgViewDuration, avgViewPercentage, avgViews, subConversionRate };
  };

  // ===== フィルタ＆ソート =====
  const getFilteredVideos = (enriched: EnrichedVideo[]): EnrichedVideo[] => {
    let vids = [...enriched];
    if (filterGenre !== "all") vids = vids.filter((v) => v.genre === filterGenre);
    vids.sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "date") return b.publishedAt.localeCompare(a.publishedAt);
      if (sortBy === "avgDuration")
        return (b.avgViewDuration || 0) - (a.avgViewDuration || 0);
      // engagement
      const engA = a.views > 0 ? (a.likes + a.comments) / a.views : 0;
      const engB = b.views > 0 ? (b.likes + b.comments) / b.views : 0;
      return engB - engA;
    });
    return vids;
  };

  // ===== 未登録画面 =====
  if (!myChannel) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-bold mb-2">パフォーマンス</h1>
        <p className="text-gray-500 mb-6">
          自チャンネルの動画パフォーマンスを自動トラッキング
        </p>
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-3">自チャンネルを登録</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://youtube.com/@your-channel"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm"
            />
            <button
              onClick={handleRegister}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0"
            >
              {loading ? "取得中..." : "登録"}
            </button>
          </div>
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const enriched = getEnrichedVideos();
  const kpis = getKPIs(enriched);
  const filtered = getFilteredVideos(enriched);
  const avgViews = kpis?.avgViews || 0;

  return (
    <div className="p-8">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">パフォーマンス</h1>
          <p className="text-gray-500 mt-1">
            {myChannel.channelName} · 最終取得:{" "}
            {new Date(myChannel.lastFetched).toLocaleString("ja-JP")}
            {analyticsLoading && (
              <span className="ml-2 text-xs text-accent">アナリティクス取得中...</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "更新中..." : "データを更新"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {analyzing ? "分析中..." : "AIで分析"}
          </button>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* ===== KPIサマリー（4指標） ===== */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* 平均視聴時間 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-accent">
              {kpis.avgViewDuration != null
                ? formatDuration(Math.round(kpis.avgViewDuration))
                : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">平均視聴時間</p>
            <p className="text-[10px] text-gray-400 mt-0.5">最重要指標</p>
          </div>

          {/* 平均維持率 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">
              {kpis.avgViewPercentage != null
                ? `${kpis.avgViewPercentage.toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">平均維持率</p>
            <p className="text-[10px] text-gray-400 mt-0.5">長尺ほど低下</p>
          </div>

          {/* 平均再生数 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">{formatNumber(kpis.avgViews)}</p>
            <p className="text-xs text-gray-500 mt-1">平均再生数</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{myChannel.videos.length}本の動画</p>
          </div>

          {/* 登録者転換率 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-green-600">
              {kpis.subConversionRate != null
                ? `${kpis.subConversionRate.toFixed(2)}%`
                : "—"}
            </p>
            <p className="text-xs text-gray-500 mt-1">登録者転換率</p>
            <p className="text-[10px] text-gray-400 mt-0.5">登録 / 再生数</p>
          </div>
        </div>
      )}

      {/* ===== パフォーマンス分布チャート ===== */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold mb-4">パフォーマンス分布</h2>
        <div className="space-y-2">
          {[...enriched]
            .sort((a, b) => b.views - a.views)
            .slice(0, 15)
            .map((v) => {
              const maxViews = enriched.reduce((m, x) => Math.max(m, x.views), 1);
              const width = Math.max((v.views / maxViews) * 100, 2);
              const isWinner = avgViews > 0 && v.views >= avgViews * 1.5;
              const isLoser = avgViews > 0 && v.views <= avgViews * 0.5;
              const pctWidth =
                v.avgViewPercentage != null
                  ? Math.min(v.avgViewPercentage, 100)
                  : null;
              return (
                <div key={v.videoId} className="flex items-center gap-3">
                  <div
                    className="w-40 text-xs text-gray-600 truncate shrink-0"
                    title={v.title}
                  >
                    {v.title}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    {/* 再生数バー */}
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full ${
                          isWinner
                            ? "bg-green-500"
                            : isLoser
                            ? "bg-red-400"
                            : "bg-accent/60"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                      {avgViews > 0 && (
                        <div
                          className="absolute top-0 h-full w-0.5 bg-gray-400"
                          style={{ left: `${(avgViews / maxViews) * 100}%` }}
                        />
                      )}
                    </div>
                    {/* 維持率バー */}
                    {pctWidth != null && (
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-300"
                          style={{ width: `${pctWidth}%` }}
                          title={`平均維持率: ${v.avgViewPercentage?.toFixed(1)}%`}
                        />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold w-16 text-right ${
                      isWinner
                        ? "text-green-600"
                        : isLoser
                        ? "text-red-500"
                        : "text-gray-600"
                    }`}
                  >
                    {formatNumber(v.views)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent w-14 text-center">
                    {GENRE_LABELS[v.genre]}
                  </span>
                </div>
              );
            })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          縦線 = 平均再生数（{formatNumber(avgViews)}回）| 上段バー: 再生数　下段バー: 維持率
          | 緑: 1.5倍以上　赤: 0.5倍以下
        </p>
      </div>

      {/* ===== AI分析結果 ===== */}
      {analysis && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">AI分析結果</h2>
            <button onClick={() => router.push("/create")}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90">
              分析を踏まえて台本作成へ →
            </button>
          </div>
          <div>{renderMd(analysis)}</div>
        </div>
      )}

      {/* ===== 分析履歴 ===== */}
      {analysisLogs.length > 0 && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 mb-6">
          <button onClick={() => setShowLogs(!showLogs)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50">
            <span className="font-semibold text-sm">分析履歴（{analysisLogs.length}件）</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showLogs ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showLogs && (
            <div className="px-4 pb-4 space-y-2">
              {analysisLogs.map((log) => (
                <div key={log.id} className="bg-gray-50 rounded-lg overflow-hidden">
                  <button onClick={() => setAnalysis(analysis === log.analysis ? "" : log.analysis)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100">
                    <div>
                      <span className="text-sm font-medium">{new Date(log.date).toLocaleDateString("ja-JP")} {new Date(log.date).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-xs text-gray-500 ml-3">{log.videoCount}本 · 平均{formatNumber(log.avgViews)}回</span>
                    </div>
                    <span className="text-xs text-accent">表示</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 週次レポート ===== */}
      {weeklySnapshots.length > 0 && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 mb-6">
          <button onClick={() => setShowWeekly(!showWeekly)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50">
            <span className="font-semibold text-sm">週次レポート（{weeklySnapshots.length}週分）</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showWeekly ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showWeekly && (
            <div className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 font-medium">週</th>
                      <th className="py-2 font-medium text-right">平均再生</th>
                      <th className="py-2 font-medium text-right">総いいね</th>
                      <th className="py-2 font-medium text-right">コメント</th>
                      <th className="py-2 font-medium text-right">登録者獲得</th>
                      <th className="py-2 font-medium text-right">変化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklySnapshots.map((snap, i) => {
                      const prev = weeklySnapshots[i + 1];
                      const viewsDiff = prev ? snap.avgViews - prev.avgViews : 0;
                      return (
                        <tr key={snap.weekStart} className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">{snap.weekStart}〜</td>
                          <td className="py-2 text-right font-medium">{formatNumber(snap.avgViews)}</td>
                          <td className="py-2 text-right">{formatNumber(snap.totalLikes)}</td>
                          <td className="py-2 text-right">{formatNumber(snap.totalComments)}</td>
                          <td className="py-2 text-right text-green-600">+{snap.subscribersGained}</td>
                          <td className="py-2 text-right">
                            {prev && (
                              <span className={`font-medium ${viewsDiff > 0 ? "text-green-600" : viewsDiff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                {viewsDiff > 0 ? "+" : ""}{formatNumber(viewsDiff)}
                              </span>
                            )}
                            {!prev && <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {weeklySnapshots.length >= 2 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">先週との比較</p>
                  {(() => {
                    const curr = weeklySnapshots[0];
                    const prev = weeklySnapshots[1];
                    const viewsChange = curr.avgViews - prev.avgViews;
                    const likesChange = curr.totalLikes - prev.totalLikes;
                    return (
                      <div className="space-y-1">
                        <p className="text-sm">
                          平均再生数: <span className={viewsChange >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {viewsChange >= 0 ? "+" : ""}{formatNumber(viewsChange)}（{prev.avgViews > 0 ? `${viewsChange >= 0 ? "+" : ""}${Math.round(viewsChange / prev.avgViews * 100)}%` : "—"}）
                          </span>
                        </p>
                        <p className="text-sm">
                          いいね: <span className={likesChange >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {likesChange >= 0 ? "+" : ""}{formatNumber(likesChange)}
                          </span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== フィルタ＆ソート ===== */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
        >
          <option value="views">再生数順</option>
          <option value="date">公開日順</option>
          <option value="engagement">エンゲージメント順</option>
          <option value="avgDuration">平均視聴時間順</option>
        </select>
        <select
          value={filterGenre}
          onChange={(e) => setFilterGenre(e.target.value as Genre | "all")}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
        >
          <option value="all">全ジャンル</option>
          {Object.entries(GENRE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length}本</span>
      </div>

      {/* ===== 動画一覧 ===== */}
      <div className="space-y-2">
        {filtered.map((v) => {
          const eng =
            v.views > 0
              ? ((v.likes + v.comments) / v.views * 100).toFixed(1)
              : "0";
          const isWinner = avgViews > 0 && v.views >= avgViews * 1.5;
          const isLoser = avgViews > 0 && v.views <= avgViews * 0.5;
          const isSelected = selectedVideo === v.videoId;

          return (
            <div key={v.videoId}>
              {/* 動画カード */}
              <div
                onClick={() => handleSelectVideo(v.videoId)}
                className={`bg-card-bg rounded-xl p-4 shadow-sm border flex gap-4 items-start cursor-pointer hover:shadow-md transition-shadow ${
                  isWinner
                    ? "border-green-200"
                    : isLoser
                    ? "border-red-200"
                    : "border-gray-100"
                }`}
              >
                {/* サムネイル */}
                {v.thumbnailUrl && (
                  <a
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      className="w-28 h-16 rounded-lg object-cover hover:opacity-80"
                    />
                  </a>
                )}

                {/* タイトル・ジャンル・日時 */}
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://www.youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:text-accent truncate block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {v.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <select
                      value={v.genre}
                      onChange={(e) =>
                        handleGenreChange(v.videoId, e.target.value as Genre)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border-none outline-none cursor-pointer appearance-none font-medium"
                    >
                      {Object.entries(GENRE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500">{v.publishedAt}</span>
                    <span className="text-xs text-gray-500">{v.duration}</span>
                  </div>

                  {/* アナリティクス行 */}
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    {v.avgViewDuration != null && (
                      <span className="text-xs text-blue-600 font-medium">
                        ⏱ {formatDuration(Math.round(v.avgViewDuration))}
                      </span>
                    )}
                    {v.avgViewPercentage != null && (
                      <span className="text-xs text-purple-600 font-medium">
                        維持率 {v.avgViewPercentage.toFixed(1)}%
                      </span>
                    )}
                    {v.subscribersGained != null && (
                      <span className="text-xs text-green-600 font-medium">
                        +{v.subscribersGained} 登録
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      エンゲージメント {eng}%
                    </span>
                  </div>
                </div>

                {/* 再生数 */}
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      isWinner
                        ? "text-green-600"
                        : isLoser
                        ? "text-red-500"
                        : ""
                    }`}
                  >
                    {formatNumber(v.views)}回
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(v.likes)}いいね
                  </p>
                  {v.growth !== 0 && (
                    <p
                      className={`text-xs font-medium ${
                        v.growth > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {v.growth > 0 ? "+" : ""}
                      {formatNumber(v.growth)}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {isSelected ? "▲ 閉じる" : "▼ 詳細"}
                  </p>
                </div>
              </div>

              {/* ===== 動画詳細パネル ===== */}
              {isSelected && (
                <div className="bg-gray-50 rounded-xl p-5 mt-1 border border-gray-200">
                  {!hasOAuth && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      設定ページから「YouTube Analytics連携」を設定すると、視聴者維持率カーブや詳細アナリティクスが表示されます。
                    </p>
                  )}

                  {hasOAuth && loadingDetail && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      アナリティクスを取得中...
                    </p>
                  )}

                  {hasOAuth && !loadingDetail && (
                    <div className="space-y-4">
                      {/* リテンションカーブ */}
                      {retention.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            視聴者維持率カーブ
                          </h4>
                          <div className="h-32 flex items-end gap-px bg-white rounded-lg p-2">
                            {retention.map((r, i) => (
                              <div
                                key={i}
                                className="flex-1 flex flex-col items-center justify-end"
                                title={`${r.timePercent}%時点: ${r.retentionPercent}%維持`}
                              >
                                <div
                                  className={`w-full rounded-t ${
                                    r.retentionPercent >= 50
                                      ? "bg-green-400"
                                      : r.retentionPercent >= 30
                                      ? "bg-yellow-400"
                                      : "bg-red-400"
                                  }`}
                                  style={{ height: `${r.retentionPercent}%` }}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      )}

                      {/* 統計グリッド */}
                      {detailAnalytics && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {detailAnalytics.avgViewPercentage != null && (
                            <div className="bg-white rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-purple-600">
                                {detailAnalytics.avgViewPercentage}%
                              </p>
                              <p className="text-xs text-gray-500">平均視聴率</p>
                            </div>
                          )}
                          {detailAnalytics.subscribersGained != null && (
                            <div className="bg-white rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-green-600">
                                +{detailAnalytics.subscribersGained}
                              </p>
                              <p className="text-xs text-gray-500">登録者獲得</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* トラフィックソース */}
                      {detailAnalytics?.trafficSources &&
                        detailAnalytics.trafficSources.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              トラフィックソース
                            </h4>
                            <div className="space-y-1">
                              {detailAnalytics.trafficSources
                                .slice(0, 5)
                                .map((ts, i) => {
                                  const maxV =
                                    detailAnalytics.trafficSources![0].views;
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="text-xs text-gray-600 w-28 shrink-0">
                                        {ts.source}
                                      </span>
                                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-accent rounded-full"
                                          style={{
                                            width: `${(ts.views / maxV) * 100}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500 w-12 text-right">
                                        {formatNumber(ts.views)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                      {retention.length === 0 && !detailAnalytics && (
                        <p className="text-sm text-gray-400 text-center">
                          この動画のアナリティクスデータがありません
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
