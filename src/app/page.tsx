"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getKnowledgeSources } from "@/lib/knowledge-store";

const QUICK_ACTIONS = [
  {
    label: "教材を登録",
    href: "/knowledge",
    colorClass: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    label: "競合を分析",
    href: "/launch-analysis",
    colorClass: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    label: "セールスレター作成",
    href: "/sales-letter",
    colorClass: "bg-green-50 text-green-600 hover:bg-green-100",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    label: "顧客管理",
    href: "/customers",
    colorClass: "bg-orange-50 text-orange-600 hover:bg-orange-100",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const RECENT_ACTIVITIES = [
  { text: "新しい教材「LINE集客の基本」を登録しました", time: "2時間前" },
  { text: "セールスレター「春の特別キャンペーン」を作成しました", time: "5時間前" },
  { text: "顧客セグメント「リピーター」を更新しました", time: "1日前" },
  { text: "KPI目標を更新しました", time: "2日前" },
  { text: "LINEテンプレート「初回あいさつ」を追加しました", time: "3日前" },
];

export default function DashboardPage() {
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKnowledgeCount(getKnowledgeSources().length);
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
          <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "教材数",
      value: knowledgeCount,
      sub: "登録済みナレッジ",
      color: "text-accent",
      bg: "bg-accent/10",
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    },
    {
      label: "KPI達成率",
      value: "—",
      sub: "今月の進捗",
      color: "text-success",
      bg: "bg-success/10",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
      label: "LINE会話数",
      value: "—",
      sub: "今月のメッセージ",
      color: "text-green-600",
      bg: "bg-green-50",
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    },
    {
      label: "顧客数",
      value: "—",
      sub: "登録済み顧客",
      color: "text-orange-600",
      bg: "bg-orange-50",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">占いスピマーケティング管理</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <svg className={`w-5 h-5 ${card.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* クイックアクション */}
      <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl transition-colors ${action.colorClass}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
              </svg>
              <span className="text-sm font-medium text-center leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 最近のアクティビティ */}
      <section className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">最近のアクティビティ</h2>
        <div className="space-y-3">
          {RECENT_ACTIVITIES.map((activity, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <p className="text-sm text-foreground">{activity.text}</p>
              <span className="text-xs text-gray-400 shrink-0 ml-4">{activity.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
