"use client";

import { useState, useEffect } from "react";
import { getChannels, getApiKey } from "@/lib/channel-store";
import type { RegisteredChannel } from "@/lib/channel-store";
import { mockTrendKeywords, formatNumber } from "@/lib/mock-data";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-sm text-success mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [channels, setChannels] = useState<RegisteredChannel[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setChannels(getChannels());
    setHasApiKey(!!getApiKey("yt_api_key"));
  }, []);

  const fetchedChannels = channels.filter((ch) => ch.subscribers != null);
  const totalSubscribers = fetchedChannels.reduce((sum, ch) => sum + (ch.subscribers || 0), 0);
  const risingKeywords = mockTrendKeywords.filter((k) => k.trend === "rising").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-gray-500 mt-1">占い・スピリチュアル系YouTubeの競合概況</p>
      </div>

      {/* APIキー未設定の案内 */}
      {!hasApiKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">
            <strong>YouTube APIキーが未設定です。</strong>
            設定ページからAPIキーを登録すると、登録チャンネルのリアルデータが表示されます。
          </p>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="登録チャンネル数" value={channels.length.toString()} sub={`${fetchedChannels.length}件のデータ取得済み`} />
        <StatCard label="合計登録者数" value={totalSubscribers > 0 ? formatNumber(totalSubscribers) + "人" : "未取得"} />
        <StatCard
          label="平均登録者数"
          value={fetchedChannels.length > 0 ? formatNumber(Math.round(totalSubscribers / fetchedChannels.length)) + "人" : "未取得"}
        />
        <StatCard label="上昇キーワード" value={risingKeywords.toString()} sub={`${risingKeywords}件が上昇中`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 登録チャンネル一覧 */}
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">登録チャンネル（登録者数順）</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[...fetchedChannels]
              .sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0))
              .slice(0, 10)
              .map((ch, i) => (
                <div key={ch.url} className="px-6 py-4 flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span>
                  {ch.thumbnailUrl ? (
                    <img src={ch.thumbnailUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                      {(ch.name || "?").charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ch.name}</p>
                    <p className="text-xs text-gray-500">{formatNumber(ch.subscribers || 0)}人</p>
                  </div>
                </div>
              ))}
            {fetchedChannels.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                チャンネル分析ページからデータを取得してください
              </div>
            )}
          </div>
        </div>

        {/* トレンドキーワード */}
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">急上昇キーワード</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {mockTrendKeywords
              .filter((k) => k.trend === "rising")
              .sort((a, b) => b.monthlyChange - a.monthlyChange)
              .slice(0, 7)
              .map((kw) => (
                <div key={kw.keyword} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{kw.keyword}</p>
                    <p className="text-xs text-gray-500">月間 {formatNumber(kw.searchVolume)}回検索</p>
                  </div>
                  <span className="text-sm font-semibold text-success">+{kw.monthlyChange}%</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
