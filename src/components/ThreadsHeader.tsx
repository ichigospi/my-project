// /threads 内の共通ヘッダー: タブナビ + アカウント切替
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
  { href: "/threads/research", label: "リサーチ", emoji: "🔍" },
  { href: "/threads/library", label: "ライブラリ", emoji: "🧲" },
  { href: "/threads/create", label: "作成", emoji: "✏️" },
  { href: "/threads/posts", label: "投稿管理", emoji: "📋" },
  { href: "/threads/analytics", label: "分析", emoji: "📊" },
  { href: "/threads/settings", label: "設定", emoji: "⚙️" },
];

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
    // アカウント管理画面での追加・変更を拾う
    const handler = () => loadAccounts();
    window.addEventListener("threads-accounts-updated", handler);
    return () => window.removeEventListener("threads-accounts-updated", handler);
  }, [loadAccounts]);

  // 未選択 or 選択中が消えた場合は先頭アカウントを自動選択
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!accountId || !accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId, setAccountId]);

  return (
    <header className="border-b border-neutral-800 bg-black sticky top-0 z-20">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-100">Threadsポストツール</h1>
          <p className="text-xs text-neutral-500">競合分析 × オマージュ作成 × 反応計測</p>
        </div>
        {accounts.length === 0 ? (
          <Link
            href="/threads/accounts"
            className="text-xs px-3 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200"
          >
            + アカウントを登録
          </Link>
        ) : (
          // アカウント切替: ワンクリックのピル型トグル（選択中=白）
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full md:max-w-[60vw]">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                title={`@${a.handle}`}
                className={`px-4 py-1.5 text-sm font-bold rounded-full whitespace-nowrap border transition-colors ${
                  a.id === accountId
                    ? "bg-white text-black border-white shadow"
                    : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-400 hover:text-white"
                }`}
              >
                {a.name}
              </button>
            ))}
            <Link
              href="/threads/accounts"
              title="アカウントを追加・編集"
              className="px-3 py-1.5 text-sm rounded-full border border-dashed border-neutral-700 text-neutral-500 hover:text-neutral-200 hover:border-neutral-500 whitespace-nowrap"
            >
              ＋
            </Link>
          </div>
        )}
      </div>
      <nav className="px-2 md:px-4 flex overflow-x-auto border-t border-neutral-800">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-neutral-400 hover:text-white hover:border-neutral-600"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
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
