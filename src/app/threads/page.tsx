"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { fmtDate } from "@/lib/threads-client";

interface StatsResponse {
  competitors: number;
  collectedPosts: number;
  libraryItems: number;
  drafts: number;
  scheduled: number;
  published: number;
  upcoming: { id: string; content: string; scheduledAt: string; status: string }[];
}

const featureNav = [
  { href: "/threads/accounts", title: "👤 アカウント", desc: "コンセプト・投稿ロジック・口調を登録（生成の土台）" },
  { href: "/threads/knowledge", title: "📚 ノウハウ", desc: "投稿ルール・教材・メモを登録（生成時に自動注入）" },
  { href: "/threads/competitors", title: "👥 ベンチマーク", desc: "競合アカウント登録 + 伸びてる投稿の取り込み" },
  { href: "/threads/research", title: "🔍 リサーチ", desc: "収集した競合投稿を企画タイプ別に検索・分析" },
  { href: "/threads/library", title: "🧲 ライブラリ", desc: "強いフック・企画・CTAを登録して生成時に呼び出し" },
  { href: "/threads/create", title: "✏️ 作成", desc: "参考投稿A/Bからオマージュ生成 + AI壁打ち" },
  { href: "/threads/posts", title: "📋 投稿管理", desc: "投稿案の承認・予定・実績・考察を一元管理" },
];

export default function ThreadsDashboardPage() {
  const [accountId] = useThreadsAccountId();
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const loadStats = useCallback(async () => {
    if (!accountId) return;
    try {
      const r = await fetch(`/api/threads/stats?accountId=${accountId}`);
      if (!r.ok) return;
      setStats((await r.json()) as StatsResponse);
    } catch {
      setStats(null);
    }
  }, [accountId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const cards = [
    { label: "競合", emoji: "👥", value: stats ? String(stats.competitors) : "—" },
    { label: "収集投稿", emoji: "📥", value: stats ? String(stats.collectedPosts) : "—" },
    { label: "ライブラリ", emoji: "🧲", value: stats ? String(stats.libraryItems) : "—" },
    { label: "投稿案", emoji: "✏️", value: stats ? String(stats.drafts) : "—" },
    { label: "予約中", emoji: "⏰", value: stats ? String(stats.scheduled) : "—" },
    { label: "投稿済", emoji: "✅", value: stats ? String(stats.published) : "—" },
  ];

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">ダッシュボード</h2>
        <p className="text-sm text-neutral-400 mt-1">
          伸びている競合投稿を取り込み、型を保ったままオマージュ作成し、反応を計測するツールです。
        </p>
      </div>

      {!accountId && (
        <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4 text-sm text-neutral-200">
          まずは <Link href="/threads/accounts" className="font-bold underline">アカウント管理</Link> で運用アカウントを登録してください。
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <div className="text-xs text-neutral-500">
              {c.emoji} {c.label}
            </div>
            <div className="text-2xl font-bold text-neutral-100 mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {stats && stats.upcoming.length > 0 && (
        <div className="bg-neutral-900 rounded-xl border border-amber-500/30 p-4">
          <h3 className="text-sm font-bold text-neutral-100 mb-3">⏰ 48時間以内の投稿予定（スマホから手動投稿）</h3>
          <div className="space-y-2">
            {stats.upcoming.map((u) => (
              <Link
                key={u.id}
                href={`/threads/posts?draftId=${u.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800 border border-neutral-800"
              >
                <span className="text-xs font-bold text-amber-400 whitespace-nowrap">{fmtDate(u.scheduledAt)}</span>
                <span className="text-sm text-neutral-300 truncate">{u.content.slice(0, 60) || "（本文未設定）"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {featureNav.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-500 hover:shadow-sm transition-all"
          >
            <div className="font-bold text-neutral-100">{f.title}</div>
            <div className="text-xs text-neutral-500 mt-1">{f.desc}</div>
          </Link>
        ))}
      </div>

      <div className="bg-neutral-800 rounded-xl p-4 text-xs text-neutral-400 space-y-1">
        <p className="font-bold text-neutral-300">運用フロー</p>
        <p>① ベンチマークで競合の伸び投稿を取り込む（貼り付けでAIが自動整理・分類） → ② リサーチで参考投稿を選ぶ → ③ 作成でオマージュ生成 + 壁打ち → ④ 投稿管理で承認・予定日時をセット → ⑤ 予定時刻にスマホでコピーして手動投稿 → ⑥ URL登録 + 実績入力 → 考察</p>
      </div>
    </main>
  );
}
