"use client";

import { useState, useEffect } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { getProfile } from "@/lib/script-analysis-store";
import { getMyChannel, saveMyChannel, detectGenre, GENRE_LABELS, genId } from "@/lib/project-store";
import type { MyChannelData, MyChannelVideo, Genre } from "@/lib/project-store";
import { formatNumber } from "@/lib/mock-data";

export default function PerformancePage() {
  const [myChannel, setMyChannel] = useState<MyChannelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sortBy, setSortBy] = useState<"views" | "date" | "engagement">("views");
  const [filterGenre, setFilterGenre] = useState<Genre | "all">("all");

  useEffect(() => {
    const saved = getMyChannel();
    if (saved) setMyChannel(saved);
    // プロフィールからchannelUrlを取得
    const profile = getProfile();
    if (!saved && profile.channelName) {
      // 自チャンネル設計からURLがあればセット
    }
  }, []);

  // 自チャンネル登録＆データ取得
  const handleRegister = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }
    if (!channelUrl) { setError("チャンネルURLを入力してください"); return; }

    setLoading(true);
    setError("");

    try {
      // URLからhandle/channelIdを抽出
      const handleMatch = channelUrl.match(/@([\w.-]+)/);
      const channelIdMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
      const params = new URLSearchParams({ apiKey: ytApiKey });
      if (handleMatch) params.set("handle", handleMatch[1]);
      else if (channelIdMatch) params.set("channelId", channelIdMatch[1]);
      else { setError("正しいYouTubeチャンネルURLを入力してください"); setLoading(false); return; }

      // チャンネル情報取得
      const chRes = await fetch(`/api/youtube/channel-info?${params}`);
      const chData = await chRes.json();
      if (chData.error) { setError(chData.error); setLoading(false); return; }

      // 動画一覧取得
      await fetchVideos(chData.channelId, chData.name, ytApiKey);
    } catch { setError("チャンネル登録に失敗"); }
    finally { setLoading(false); }
  };

  // 動画データ取得＆更新
  const fetchVideos = async (channelId: string, channelName: string, ytApiKey: string) => {
    const vidRes = await fetch(`/api/youtube/videos?channelId=${channelId}&apiKey=${encodeURIComponent(ytApiKey)}&maxResults=50`);
    const vidData = await vidRes.json();
    if (vidData.error) { setError(vidData.error); return; }

    const existing = getMyChannel();
    const now = new Date().toISOString().split("T")[0];

    const videos: MyChannelVideo[] = (vidData.videos || []).map((v: {
      id: string; title: string; views: number; likes: number; comments: number;
      publishedAt: string; thumbnailUrl: string; duration: string;
    }) => {
      // 既存のスナップショットがあればマージ
      const prev = existing?.videos.find((ev) => ev.videoId === v.id);
      const newSnapshot = { date: now, views: v.views, likes: v.likes, comments: v.comments };
      const snapshots = prev?.snapshots ? [...prev.snapshots.filter((s) => s.date !== now), newSnapshot] : [newSnapshot];

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

    const data: MyChannelData = { channelId, channelName, videos, lastFetched: new Date().toISOString() };
    saveMyChannel(data);
    setMyChannel(data);
  };

  // データ更新
  const handleRefresh = async () => {
    if (!myChannel) return;
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }
    setLoading(true);
    setError("");
    try {
      await fetchVideos(myChannel.channelId, myChannel.channelName, ytApiKey);
    } catch { setError("更新に失敗"); }
    finally { setLoading(false); }
  };

  // AI分析
  const handleAnalyze = async () => {
    if (!myChannel || myChannel.videos.length === 0) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setAnalyzing(true);
    setError("");
    try {
      const videosForAnalysis = myChannel.videos.map((v) => {
        const latest = v.snapshots[v.snapshots.length - 1];
        return {
          title: v.title, views: latest?.views || 0, likes: latest?.likes || 0,
          comments: latest?.comments || 0, genre: GENRE_LABELS[v.genre],
          publishedAt: v.publishedAt,
        };
      });

      const res = await fetch("/api/performance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: videosForAnalysis, aiApiKey }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setAnalysis(data.analysis);
    } catch { setError("分析に失敗"); }
    finally { setAnalyzing(false); }
  };

  // ジャンル変更
  const handleGenreChange = (videoId: string, newGenre: Genre) => {
    if (!myChannel) return;
    const updated = {
      ...myChannel,
      videos: myChannel.videos.map((v) => v.videoId === videoId ? { ...v, genre: newGenre } : v),
    };
    saveMyChannel(updated);
    setMyChannel(updated);
  };

  // 統計計算
  const getStats = () => {
    if (!myChannel || myChannel.videos.length === 0) return null;
    const videos = myChannel.videos.map((v) => {
      const latest = v.snapshots[v.snapshots.length - 1];
      const prev = v.snapshots.length >= 2 ? v.snapshots[v.snapshots.length - 2] : null;
      return { ...v, views: latest?.views || 0, likes: latest?.likes || 0, comments: latest?.comments || 0, growth: prev ? (latest?.views || 0) - prev.views : 0 };
    });

    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const avgViews = Math.round(totalViews / videos.length);
    const avgEngagement = videos.length > 0 ? (videos.reduce((s, v) => s + (v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0), 0) / videos.length) : 0;
    const best = videos.reduce((a, b) => a.views > b.views ? a : b, videos[0]);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = videos.filter((v) => v.publishedAt >= thirtyDaysAgo.toISOString().split("T")[0]);

    return { videos, totalViews, avgViews, avgEngagement, best, recent, thirtyDaysAgo };
  };

  const stats = getStats();

  // フィルタ＆ソート
  const getFilteredVideos = () => {
    if (!stats) return [];
    let vids = [...stats.videos];
    if (filterGenre !== "all") vids = vids.filter((v) => v.genre === filterGenre);
    vids.sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "date") return b.publishedAt.localeCompare(a.publishedAt);
      const engA = a.views > 0 ? (a.likes + a.comments) / a.views : 0;
      const engB = b.views > 0 ? (b.likes + b.comments) / b.views : 0;
      return engB - engA;
    });
    return vids;
  };

  // マークダウンレンダリング
  const renderMd = (md: string) => md.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h2>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-accent">{line.slice(3)}</h3>;
    if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-700 ml-4 list-disc my-0.5">{line.slice(2)}</li>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(2, -2)}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
  });

  // 未登録
  if (!myChannel) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-bold mb-2">パフォーマンス</h1>
        <p className="text-gray-500 mb-6">自チャンネルの動画パフォーマンスを自動トラッキング</p>
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-3">自チャンネルを登録</h2>
          <div className="flex gap-3">
            <input type="text" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://youtube.com/@your-channel"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            <button onClick={handleRegister} disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0">
              {loading ? "取得中..." : "登録"}
            </button>
          </div>
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const filtered = getFilteredVideos();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">パフォーマンス</h1>
          <p className="text-gray-500 mt-1">{myChannel.channelName} · 最終取得: {new Date(myChannel.lastFetched).toLocaleString("ja-JP")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
            {loading ? "更新中..." : "データを更新"}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {analyzing ? "分析中..." : "AIで分析"}
          </button>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* サマリー */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">{myChannel.videos.length}</p>
            <p className="text-xs text-gray-500">動画数</p>
          </div>
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">{formatNumber(stats.avgViews)}</p>
            <p className="text-xs text-gray-500">平均再生数</p>
          </div>
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">{stats.avgEngagement.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">平均エンゲージメント</p>
          </div>
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold">{stats.best ? formatNumber(stats.best.views) : "—"}</p>
            <p className="text-xs text-gray-500 truncate">最高再生 {stats.best?.title.substring(0, 15)}...</p>
          </div>
        </div>
      )}

      {/* パフォーマンス分布 */}
      {stats && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold mb-4">パフォーマンス分布</h2>
          <div className="space-y-1.5">
            {stats.videos.sort((a, b) => b.views - a.views).slice(0, 15).map((v) => {
              const maxViews = stats.videos[0]?.views || 1;
              const width = Math.max((v.views / maxViews) * 100, 2);
              const isWinner = v.views >= stats.avgViews * 1.5;
              const isLoser = v.views <= stats.avgViews * 0.5;
              return (
                <div key={v.videoId} className="flex items-center gap-3">
                  <div className="w-40 text-xs text-gray-600 truncate shrink-0" title={v.title}>{v.title}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full ${isWinner ? "bg-green-500" : isLoser ? "bg-red-400" : "bg-accent/60"}`}
                      style={{ width: `${width}%` }} />
                    {/* 平均ライン */}
                    <div className="absolute top-0 h-full w-0.5 bg-gray-400"
                      style={{ left: `${(stats.avgViews / maxViews) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-bold w-16 text-right ${isWinner ? "text-green-600" : isLoser ? "text-red-500" : "text-gray-600"}`}>
                    {formatNumber(v.views)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent w-14 text-center">{GENRE_LABELS[v.genre]}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">縦線 = 平均再生数（{formatNumber(stats.avgViews)}回）| 🟢1.5倍以上 🔴0.5倍以下</p>
        </div>
      )}

      {/* AI分析結果 */}
      {analysis && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          {renderMd(analysis)}
        </div>
      )}

      {/* フィルタ＆ソート */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
          <option value="views">再生数順</option>
          <option value="date">公開日順</option>
          <option value="engagement">エンゲージメント順</option>
        </select>
        <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value as Genre | "all")}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
          <option value="all">全ジャンル</option>
          {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length}本</span>
      </div>

      {/* 動画一覧 */}
      <div className="space-y-2">
        {filtered.map((v) => {
          const eng = v.views > 0 ? ((v.likes + v.comments) / v.views * 100).toFixed(1) : "0";
          const isWinner = stats && v.views >= stats.avgViews * 1.5;
          const isLoser = stats && v.views <= stats.avgViews * 0.5;
          return (
            <div key={v.videoId} className={`bg-card-bg rounded-xl p-4 shadow-sm border flex gap-4 items-start ${isWinner ? "border-green-200" : isLoser ? "border-red-200" : "border-gray-100"}`}>
              {v.thumbnailUrl && (
                <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={v.thumbnailUrl} alt="" className="w-28 h-16 rounded-lg object-cover hover:opacity-80" />
                </a>
              )}
              <div className="flex-1 min-w-0">
                <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium hover:text-accent truncate block">{v.title}</a>
                <div className="flex items-center gap-2 mt-1">
                  <select value={v.genre} onChange={(e) => handleGenreChange(v.videoId, e.target.value as Genre)}
                    className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border-none outline-none cursor-pointer appearance-none font-medium">
                    {Object.entries(GENRE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <span className="text-xs text-gray-500">{v.publishedAt}</span>
                  <span className="text-xs text-gray-500">{v.duration}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${isWinner ? "text-green-600" : isLoser ? "text-red-500" : ""}`}>{formatNumber(v.views)}回</p>
                <p className="text-xs text-gray-500">{formatNumber(v.likes)}いいね · {eng}%</p>
                {v.growth !== 0 && (
                  <p className={`text-xs font-medium ${v.growth > 0 ? "text-green-600" : "text-red-500"}`}>
                    {v.growth > 0 ? "+" : ""}{formatNumber(v.growth)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
