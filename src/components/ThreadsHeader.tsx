// /threads 内の共通ヘッダー: ブランド + タブナビ + アカウント切替
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useThreadsAccountId, type ThreadsAccountSummary } from "@/lib/threads-account";

const tabs = [
  { href: "/threads", label: "ダッシュボード", emoji: "🏠", exact: true },
  { href: "/threads/accounts", label: "アカウント", emoji: "👤" },
  { href: "/threads/knowledge", label: "ノウハウ", emoji: "📚" },
  { href: "/threads/competitors", label: "ベンチマーク", emoji: "👥" },
  { href: "/threads/import", label: "投稿読込", emoji: "📥" },
  { href: "/threads/research", label: "リサーチ", emoji: "🔍" },
  { href: "/threads/calendar", label: "開運日", emoji: "🗓️" },
  { href: "/threads/library", label: "ライブラリ", emoji: "🧲" },
  { href: "/threads/create", label: "作成", emoji: "✏️" },
  { href: "/threads/posts", label: "投稿管理", emoji: "📋" },
  { href: "/threads/analytics", label: "分析", emoji: "📊" },
  { href: "/threads/settings", label: "設定", emoji: "⚙️" },
];

// アカウント名から決定的にアバター色を選ぶ
const AV_COLORS = [
  "from-indigo-500 to-violet-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-sky-500 to-cyan-500",
  "from-fuchsia-500 to-purple-500",
];
function avColor(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export default function ThreadsHeader() {
  const pathname = usePathname();
  const [accountId, setAccountId] = useThreadsAccountId();
  const [accounts, setAccounts] = useState<ThreadsAccountSummary[]>([]);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await fetch("/api/threads/accounts");
      if (!r.ok) return;
      const data = (await r.json()) as ThreadsAccountSummary[];
      setAccounts(data.filter((a) => a.isActive));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    const handler = () => loadAccounts();
    window.addEventListener("threads-accounts-updated", handler);
    return () => window.removeEventListener("threads-accounts-updated", handler);
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length === 0) return;
    if (!accountId || !accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId, setAccountId]);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-b from-neutral-950/95 to-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/70">
      {/* 上部アクセントライン */}
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500/70 via-fuchsia-500/70 to-sky-500/70" />

      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* ブランドバッジ */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/20">
              <span className="text-white text-lg font-black leading-none select-none">＠</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">✨</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight leading-tight">
              Threads投稿自動作成ツール
            </h1>
            <p className="text-[11px] text-neutral-400 leading-tight">
              競合分析 <span className="text-neutral-600">×</span> オマージュ作成 <span className="text-neutral-600">×</span> 反応計測
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <Link
            href="/threads/accounts"
            className="text-xs px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-neutral-200 transition-colors"
          >
            + アカウントを登録
          </Link>
        ) : (
          // アカウント切替: アバター付きピル型トグル（選択中=白）
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full md:max-w-[58vw] py-0.5">
            {accounts.map((a) => {
              const active = a.id === accountId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  title={`@${a.handle}`}
                  className={`group flex items-center gap-1.5 pl-1.5 pr-3.5 py-1.5 rounded-full whitespace-nowrap border transition-all ${
                    active
                      ? "bg-white text-black border-white shadow-md shadow-white/10"
                      : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white uppercase bg-gradient-to-br ${avColor(
                      a.handle || a.name,
                    )} ring-1 ${active ? "ring-black/10" : "ring-white/10"}`}
                  >
                    {(a.name || a.handle).charAt(0)}
                  </span>
                  <span className="text-sm font-bold">{a.name}</span>
                </button>
              );
            })}
            <Link
              href="/threads/accounts"
              title="アカウントを追加・編集"
              className="w-9 h-9 shrink-0 flex items-center justify-center text-lg rounded-full border border-dashed border-white/15 text-neutral-500 hover:text-white hover:border-white/40 transition-colors"
            >
              ＋
            </Link>
          </div>
        )}
      </div>

      <nav className="px-2 md:px-4 flex overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`group relative flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? "text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              <span className={`transition-transform ${isActive ? "" : "grayscale-[0.3] group-hover:grayscale-0"}`}>{tab.emoji}</span>
              {tab.label}
              {/* アクティブ下線（グラデ＋グロー） */}
              <span
                className={`pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity ${
                  isActive
                    ? "opacity-100 bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 shadow-[0_0_8px_rgba(217,70,239,0.6)]"
                    : "opacity-0"
                }`}
              />
            </Link>
          );
        })}
        <Link
          href="/"
          className="ml-auto flex items-center px-3 md:px-4 py-2.5 text-xs whitespace-nowrap text-neutral-600 hover:text-neutral-300 transition-colors"
        >
          YTツールへ →
        </Link>
      </nav>
    </header>
  );
}
