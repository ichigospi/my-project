"use client";

import { useState } from "react";
import { mockTrendKeywords, formatNumber, getTrendColor, getCompetitionColor } from "@/lib/mock-data";

export default function TrendsPage() {
  const [sortBy, setSortBy] = useState<"volume" | "change">("change");
  const [filterTrend, setFilterTrend] = useState<"all" | "rising" | "stable" | "declining">("all");

  const filtered = mockTrendKeywords
    .filter((k) => filterTrend === "all" || k.trend === filterTrend)
    .sort((a, b) => (sortBy === "volume" ? b.searchVolume - a.searchVolume : b.monthlyChange - a.monthlyChange));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Trend Keywords</h1>
        <p className="text-gray-500 mt-1">Discover trending keywords in the fortune/spiritual space</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "volume" | "change")}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none"
          >
            <option value="change">Monthly Change</option>
            <option value="volume">Search Volume</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Trend:</label>
          <div className="flex gap-1">
            {(["all", "rising", "stable", "declining"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTrend(t)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                  filterTrend === t ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keywords Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((kw) => (
          <div key={kw.keyword} className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 hover:border-accent/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{kw.keyword}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{formatNumber(kw.searchVolume)} searches/month</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${getTrendColor(kw.trend)}`}>
                  {kw.monthlyChange > 0 ? "+" : ""}{kw.monthlyChange}%
                </span>
                <p className={`text-xs capitalize ${getTrendColor(kw.trend)}`}>{kw.trend}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">Competition:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getCompetitionColor(kw.competition)}`}>
                {kw.competition}
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
          <p>No keywords match your filters</p>
        </div>
      )}
    </div>
  );
}
