// スマホ用の下部タブバー（ネイティブアプリ風）。lg未満で表示、それ以上は非表示。
// 主要5枠（ホーム/リサーチ/作成/投稿/メニュー）＋「メニュー」で全ページへ。セーフエリア対応。
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// メニューシートに出す全ページ（ヘッダーのタブと対応）
const ALL_TABS = [
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

// ライン系アイコン（塗りつぶさない・アプリ風）
function Icon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

const PRIMARY = [
  { href: "/threads", label: "ホーム", icon: "home", exact: true },
  { href: "/threads/research", label: "リサーチ", icon: "search" },
  { href: "/threads/posts", label: "投稿", icon: "list" },
];

export default function ThreadsMobileNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // ページ遷移でシートを閉じる
  useEffect(() => setSheetOpen(false), [pathname]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const createActive = isActive("/threads/create");

  return (
    <>
      {/* メニューシート */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-neutral-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideup_.18s_ease-out]"
            style={{ maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="text-sm font-bold text-neutral-200 mb-3 px-1">メニュー</div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_TABS.map((t) => {
                const active = isActive(t.href, t.exact);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3.5 transition-colors ${
                      active
                        ? "bg-white text-black border-white"
                        : "bg-white/5 text-neutral-300 border-white/10 hover:border-white/25"
                    }`}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span className="text-[11px] font-bold leading-tight text-center">{t.label}</span>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/"
              className="mt-3 block text-center text-xs text-neutral-500 hover:text-neutral-300 py-2"
            >
              YouTubeツールへ →
            </Link>
          </div>
          <style>{`@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        </div>
      )}

      {/* 下部タブバー */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/75 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-end h-16">
          {/* 左2枠 */}
          {PRIMARY.slice(0, 2).map((t) => {
            const active = isActive(t.href, t.exact);
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center justify-center gap-0.5 h-full">
                <span className={active ? "text-white" : "text-neutral-500"}>
                  <Icon name={t.icon} />
                </span>
                <span className={`text-[10px] font-bold ${active ? "text-white" : "text-neutral-500"}`}>{t.label}</span>
              </Link>
            );
          })}

          {/* 中央: 作成（浮き出しボタン） */}
          <div className="flex flex-col items-center justify-end h-full">
            <Link
              href="/threads/create"
              className={`-mt-5 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-black transition-transform active:scale-95 ${
                createActive
                  ? "bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-white"
                  : "bg-white text-black"
              }`}
              aria-label="投稿を作成"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Link>
            <span className={`text-[10px] font-bold mb-1 ${createActive ? "text-white" : "text-neutral-400"}`}>作成</span>
          </div>

          {/* 右2枠 */}
          {PRIMARY.slice(2).map((t) => {
            const active = isActive(t.href, t.exact);
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center justify-center gap-0.5 h-full">
                <span className={active ? "text-white" : "text-neutral-500"}>
                  <Icon name={t.icon} />
                </span>
                <span className={`text-[10px] font-bold ${active ? "text-white" : "text-neutral-500"}`}>{t.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setSheetOpen(true)} className="flex flex-col items-center justify-center gap-0.5 h-full" aria-label="メニュー">
            <span className={sheetOpen ? "text-white" : "text-neutral-500"}>
              <Icon name="menu" />
            </span>
            <span className={`text-[10px] font-bold ${sheetOpen ? "text-white" : "text-neutral-500"}`}>メニュー</span>
          </button>
        </div>
      </nav>
    </>
  );
}
