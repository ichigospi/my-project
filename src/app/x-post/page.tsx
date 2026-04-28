"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";

const quickActions = [
  { href: "/x-post/create", label: "新規ポスト生成", emoji: "✏️", color: "bg-indigo-500 hover:bg-indigo-600" },
  { href: "/x-post/competitors", label: "競合追加・収集", emoji: "👥", color: "bg-emerald-500 hover:bg-emerald-600" },
  { href: "/x-post/analysis", label: "分析実行", emoji: "🔍", color: "bg-amber-500 hover:bg-amber-600" },
  { href: "/x-post/daily", label: "今日のプラン", emoji: "📅", color: "bg-rose-500 hover:bg-rose-600" },
];

const featureNav = [
  { href: "/x-post/knowledge", title: "📚 ナレッジ", desc: "自アカ情報・教材・参考ポスト・テンプレを管理" },
  { href: "/x-post/competitors", title: "👥 競合", desc: "競合アカウント登録 + 伸びてるポスト収集（手動 / X API自動 / シーケンス抽出）" },
  { href: "/x-post/analysis", title: "🔍 分析", desc: "収集ポストから構成・フック・強化要素を抽出" },
  { href: "/x-post/templates", title: "📋 テンプレ", desc: "単一ポスト + シーケンスパターンの管理" },
  { href: "/x-post/create", title: "✏️ 生成", desc: "ゼロから / テンプレから / デイリーから生成" },
  { href: "/x-post/daily", title: "📅 デイリープラン", desc: "今日のポスト計画と教育バランス・設定" },
];

interface StatsResponse {
  knowledge: number;
  competitors: number;
  collectedPosts: number;
  analyses: number;
  generatedPosts: number;
  templates: number;
  sequencePatterns: number;
  dailyPlans: number;
}

export default function XPostDashboardPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/x-post/stats?genre=${genre}`);
      const data = (await r.json()) as StatsResponse;
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [genre]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const cards: { label: string; value: string; emoji: string }[] = [
    { label: "ナレッジ", emoji: "📚", value: stats ? String(stats.knowledge) : "—" },
    { label: "競合", emoji: "👥", value: stats ? String(stats.competitors) : "—" },
    { label: "収集ポスト", emoji: "📥", value: stats ? String(stats.collectedPosts) : "—" },
    { label: "分析", emoji: "🔍", value: stats ? String(stats.analyses) : "—" },
    { label: "生成済", emoji: "✏️", value: stats ? String(stats.generatedPosts) : "—" },
    { label: "テンプレ", emoji: "📋", value: stats ? String(stats.templates) : "—" },
    { label: "シーケンス", emoji: "🧬", value: stats ? String(stats.sequencePatterns) : "—" },
    { label: "デイリープラン", emoji: "📅", value: stats ? String(stats.dailyPlans) : "—" },
  ];

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          ダッシュボード <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Xポスト作成ツールへようこそ。ジャンルを切り替えてビジ系/占い系それぞれの設定で運用できます。
        </p>
      </div>

      {/* 統計カード */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          統計 {statsLoading && <span className="text-xs text-gray-400 ml-1">読み込み中...</span>}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <span>{s.emoji}</span>
                {s.label}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* クイックアクション */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">クイックアクション</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${a.color} text-white rounded-lg px-4 py-3 flex items-center gap-2 font-medium transition-colors`}
            >
              <span className="text-lg">{a.emoji}</span>
              <span className="text-sm">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 機能ナビ */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">機能</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {featureNav.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm transition"
            >
              <div className="font-bold text-gray-900">{f.title}</div>
              <div className="text-sm text-gray-600 mt-1">{f.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
