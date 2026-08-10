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
          {/* ブランドバッジ（Threadsロゴ） */}
          <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center ring-1 ring-white/15 shadow-lg shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#fff" aria-hidden="true">
              <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.332-3.083.881-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Z" />
            </svg>
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
