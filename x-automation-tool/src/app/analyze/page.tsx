"use client";

import { useState } from "react";
import Link from "next/link";
import { getXBearerToken, getAiApiKey } from "@/lib/x-store";

export default function AnalyzePage() {
  const [activeTab, setActiveTab] = useState<"trends" | "search" | "account">("trends");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // トレンド
  const [trends, setTrends] = useState<{ name: string; tweet_volume: number | null }[]>([]);
  const [trendSummary, setTrendSummary] = useState("");

  // 検索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; text: string; public_metrics?: { like_count: number; retweet_count: number; impression_count: number } }[]>([]);

  // アカウント分析
  const [analysis, setAnalysis] = useState<{ avgLikes: number; avgRetweets: number; avgImpressions: number; engagementRate: string; bestHour: number; tweetCount: number } | null>(null);

  const fetchData = async (type: string, extra?: Record<string, string>) => {
    const bearerToken = getXBearerToken();
    if (!bearerToken) { setError("Xアカウントを接続してください"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/x/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, bearerToken, aiApiKey: getAiApiKey(), ...extra }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (type === "trends") { setTrends(data.trends || []); setTrendSummary(data.aiSummary || ""); }
      else if (type === "search") { setSearchResults(data.tweets || []); }
      else if (type === "account") { setAnalysis(data.analysis); }
    } catch { setError("取得に失敗しました"); } finally { setLoading(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-foreground">分析</h1><p className="text-sm text-gray-500 mt-1">トレンド・ツイート検索・アカウント分析</p></div><Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← ダッシュボード</Link></div>

      <div className="flex gap-2">
        {(["trends", "search", "account"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm rounded-lg border ${activeTab === t ? "border-accent bg-accent/10 text-accent" : "border-gray-200 text-gray-600"}`}>
            {t === "trends" ? "トレンド" : t === "search" ? "ツイート検索" : "アカウント分析"}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

      {activeTab === "trends" && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">日本のトレンド</h2>
            <button onClick={() => fetchData("trends")} disabled={loading} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{loading ? "取得中..." : "トレンドを取得"}</button>
          </div>
          {trendSummary && <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg"><h3 className="text-sm font-medium text-blue-800 mb-2">AI分析</h3><p className="text-sm text-blue-700 whitespace-pre-wrap">{trendSummary}</p></div>}
          {trends.length > 0 && (
            <div className="space-y-1">{trends.slice(0, 20).map((t, i) => (
              <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                <span className="text-sm">{t.name}</span>
                {t.tweet_volume && <span className="text-xs text-gray-400">{t.tweet_volume.toLocaleString()}件</span>}
              </div>
            ))}</div>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="検索キーワード（例: 占い、スピリチュアル）" onKeyDown={(e) => e.key === "Enter" && fetchData("search", { query: searchQuery })} />
            <button onClick={() => fetchData("search", { query: searchQuery })} disabled={loading || !searchQuery.trim()} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{loading ? "検索中..." : "検索"}</button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-3">{searchResults.map((t) => (
              <div key={t.id} className="p-3 border border-gray-100 rounded-lg">
                <p className="text-sm text-foreground whitespace-pre-wrap">{t.text}</p>
                {t.public_metrics && <div className="flex gap-4 mt-2 text-xs text-gray-400"><span>いいね: {t.public_metrics.like_count}</span><span>RT: {t.public_metrics.retweet_count}</span><span>閲覧: {t.public_metrics.impression_count?.toLocaleString()}</span></div>}
              </div>
            ))}</div>
          )}
        </div>
      )}

      {activeTab === "account" && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">アカウント分析</h2>
            <button onClick={() => fetchData("account")} disabled={loading} className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{loading ? "分析中..." : "分析開始"}</button>
          </div>
          {analysis && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-blue-600">{analysis.avgLikes}</p><p className="text-xs text-gray-500 mt-1">平均いいね</p></div>
              <div className="bg-green-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-green-600">{analysis.avgRetweets}</p><p className="text-xs text-gray-500 mt-1">平均RT</p></div>
              <div className="bg-purple-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-purple-600">{analysis.avgImpressions.toLocaleString()}</p><p className="text-xs text-gray-500 mt-1">平均インプレッション</p></div>
              <div className="bg-orange-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-orange-600">{analysis.engagementRate}%</p><p className="text-xs text-gray-500 mt-1">エンゲージメント率</p></div>
              <div className="bg-pink-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-pink-600">{analysis.bestHour}時</p><p className="text-xs text-gray-500 mt-1">最適投稿時間</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-gray-600">{analysis.tweetCount}</p><p className="text-xs text-gray-500 mt-1">分析ツイート数</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
