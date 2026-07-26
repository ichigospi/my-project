// /reply 内の共通ヘッダー: タブナビ
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/reply", label: "返信作成", emoji: "✉️", exact: true },
  { href: "/reply/scenarios", label: "あるある集", emoji: "💡" },
  { href: "/reply/history", label: "履歴・承認", emoji: "📋" },
  { href: "/reply/policies", label: "判断ルール", emoji: "🧠" },
  { href: "/reply/examples", label: "実例集", emoji: "📚" },
  { href: "/reply/settings", label: "設定", emoji: "⚙️" },
];

export default function ReplyHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">顧客対応ツール</h1>
          <p className="text-xs text-gray-500">オーナーの第二の脳 — お客様メッセージへの返信文を作成</p>
        </div>
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← YTツールへ戻る
        </Link>
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
                  ? "border-purple-500 text-purple-600"
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
