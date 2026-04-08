"use client";

import { useState } from "react";
import { mockTrendKeywords, formatNumber, getTrendColor, getCompetitionColor, getTrendLabel, getCompetitionLabel } from "@/lib/mock-data";

export default function TrendsPage() {
  const [sortBy, setSortBy] = useState<"volume" | "change">("change");
  const [filterTrend, setFilterTrend] = useState<"all" | "rising" | "stable" | "declining">("all");

  const filterLabels = { all: "すべて", rising: "上昇中", stable: "安定", declining: "下降中" } as const;

  const filtered = mockTrendKeywords
    .filter((k) => filterTrend === "all" || k.trend === filterTrend)
    .sort((a, b) => (sortBy === "volume" ? b.searchVolume - a.searchVolume : b.monthlyChange - a.monthlyChange));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">トレンドキーワード</h1>
        <p className="text-gray-500 mt-1">占い・スピ系で今注目のキーワードを発見</p>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">並び替え:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "volume" | "change")}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none"
          >
            <option value="change">月間変動率</option>
            <option value="volume">検索ボリューム</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">トレンド:</label>
          <div className="flex gap-1">
            {(["all", "rising", "stable", "declining"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTrend(t)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterTrend === t ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filterLabels[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* キーワードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((kw) => (
          <div key={kw.keyword} className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 hover:border-accent/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{kw.keyword}</h3>
                <p className="text-sm text-gray-500 mt-0.5">月間 {formatNumber(kw.searchVolume)}回検索</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${getTrendColor(kw.trend)}`}>
                  {kw.monthlyChange > 0 ? "+" : ""}{kw.monthlyChange}%
                </span>
                <p className={`text-xs ${getTrendColor(kw.trend)}`}>{getTrendLabel(kw.trend)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">競合度:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCompetitionColor(kw.competition)}`}>
                {getCompetitionLabel(kw.competition)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {kw.relatedTopics.map((topic) => (
                <span key={topic} className="text-xs px-2 py-1 rounded-md bg-accent/5 text-accent/80">{topic}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>フィルターに一致するキーワードがありません</p>
        </div>
      )}
    </div>
  );
}
