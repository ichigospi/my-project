// /x-post 内の共通ヘッダー: タブナビ + ジャンル切替
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";

const tabs = [
  { href: "/x-post", label: "ダッシュボード", emoji: "🏠", exact: true },
  { href: "/x-post/knowledge", label: "ナレッジ", emoji: "📚" },
  { href: "/x-post/competitors", label: "競合", emoji: "👥" },
  { href: "/x-post/analysis", label: "分析", emoji: "🔍" },
  { href: "/x-post/templates", label: "テンプレ", emoji: "📋" },
  { href: "/x-post/create", label: "生成", emoji: "✏️" },
  { href: "/x-post/daily", label: "デイリー", emoji: "📅" },
];

export default function XPostHeader() {
  const pathname = usePathname();
  const [genre, setGenre] = useXPostGenre();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Xポストツール</h1>
          <p className="text-xs text-gray-500">ビジ/占い系の高度ポスト作成 + 競合分析</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">ジャンル:</span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {X_POST_GENRES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGenre(g.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  genre === g.value
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
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
                  ? "border-indigo-500 text-indigo-600"
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
