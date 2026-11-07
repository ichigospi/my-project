"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import LaunchSidebar from "./LaunchSidebar";
import { pullSharedSettings } from "@/lib/shared-sync";

const NO_SIDEBAR_PATHS = ["/login", "/setup", "/register", "/sales", "/notif", "/revenue"];
const MOBILE_FULLSCREEN_PATHS = ["/sales", "/notif", "/revenue"];


// モバイル用ボトムタブ。よく使う4画面＋メニュー。文字は14px以上、タップ領域は44px以上。
const MOBILE_TABS: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "ホーム", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { href: "/workflow", label: "工程表", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/create", label: "台本作成", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { href: "/ideas", label: "企画出し", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];

function MobileTabBar({ pathname, menuOpen, onMenu }: { pathname: string; menuOpen: boolean; onMenu: () => void }) {
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[4.25rem]">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(tab.href) && !menuOpen;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 ${active ? "text-accent" : "text-gray-500"}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.9} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span className={`text-xs leading-none ${active ? "font-bold" : "font-medium"}`}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMenu}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${menuOpen ? "text-accent" : "text-gray-500"}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={menuOpen ? 2.4 : 1.9} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className={`text-xs leading-none ${menuOpen ? "font-bold" : "font-medium"}`}>メニュー</span>
        </button>
      </div>
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const synced = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (session && !synced.current) {
      synced.current = true;
      pullSharedSettings();
    }
  }, [session]);

  // 30秒ごとにサーバーから最新データを取得（他メンバーの更新を反映）
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      pullSharedSettings();
    }, 30000);
    return () => clearInterval(interval);
  }, [session]);

  // ページ切り替え時も最新データを取得
  useEffect(() => {
    if (session && synced.current) {
      pullSharedSettings();
    }
  }, [pathname, session]);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const hideSidebar = NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p)) || !session;
  const isMobileFullscreen = MOBILE_FULLSCREEN_PATHS.some((p) => pathname.startsWith(p));
  const isLaunch = pathname.startsWith("/launch");
  // Threadsツールは独立したフルスクリーンUI（YTツールのサイドバーを出さない）
  const isThreads = pathname.startsWith("/threads");
  // 顧客対応ツールも独立したフルスクリーンUI
  const isReply = pathname.startsWith("/reply");
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (hideSidebar || isThreads || isReply) {
    return <main className="flex-1 overflow-auto">{children}</main>;
  }

  return (
    <>
      {/* モバイルヘッダー（フルスクリーンページでは非表示）
          iOSのPWA（black-translucent）ではステータスバーの下まで描画されるため、safe-area 分を上に足す。
          足さないと三本線がステータスバーの裏に入ってタップできない */}
      {!isMobileFullscreen && (
        <div
          className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar-bg text-white shadow-lg"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center px-3 h-14">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-11 h-11 -ml-1 flex items-center justify-center rounded-xl active:bg-white/15"
              aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
            <span className="ml-2 font-bold text-base truncate">
              {isLocal ? "ローカルツール" : "YouTube×スピ 自動化ツール"}
            </span>
          </div>
        </div>
      )}

      {/* モバイルオーバーレイ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* サイドバー：デスクトップは常時表示、モバイルはスライドイン */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30 h-[100dvh] md:h-auto overflow-y-auto
        pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 pb-[env(safe-area-inset-bottom)] md:pb-0
        bg-sidebar-bg
        transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {isLaunch ? <LaunchSidebar /> : <Sidebar onNavigate={() => setMobileMenuOpen(false)} />}
      </div>

      {/* メインコンテンツ（モバイルは上にヘッダー＋safe-area、下にタブバー分の余白） */}
      <main className={`flex-1 overflow-auto ${isMobileFullscreen
        ? "pt-0 md:pt-0"
        : "pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0"}`}>
        {children}
      </main>

      {/* モバイル用ボトムタブ（アプリ風の主要導線。ランチャー／フルスクリーンページでは出さない） */}
      {!isMobileFullscreen && !isLaunch && (
        <MobileTabBar pathname={pathname} menuOpen={mobileMenuOpen} onMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
      )}
    </>
  );
}
