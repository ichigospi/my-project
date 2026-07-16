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
    <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Threadsポストツール</h1>
          <p className="text-xs text-gray-500">競合分析 × オマージュ作成 × 反応計測</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">アカウント:</span>
          {accounts.length === 0 ? (
            <Link
              href="/threads/accounts"
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              + アカウントを登録
            </Link>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 min-w-40"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}（@{a.handle}）
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <nav className="px-2 md:px-4 flex overflow-x-auto border-t border-gray-100">
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
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
