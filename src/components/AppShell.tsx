"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import LaunchSidebar from "./LaunchSidebar";
import { pullSharedSettings } from "@/lib/shared-sync";

const NO_SIDEBAR_PATHS = ["/login", "/setup", "/register", "/sales", "/notif"];
const MOBILE_FULLSCREEN_PATHS = ["/sales", "/notif"];

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

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const hideSidebar = NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p)) || !session;
  const isMobileFullscreen = MOBILE_FULLSCREEN_PATHS.some((p) => pathname.startsWith(p));
  const isLaunch = pathname.startsWith("/launch");
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (hideSidebar) {
    return <main className="flex-1 overflow-auto">{children}</main>;
  }

  return (
    <>
      {/* モバイルヘッダー（フルスクリーンページでは非表示） */}
      {!isMobileFullscreen && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar-bg text-white flex items-center px-4 h-14 shadow-lg">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
          <span className="ml-3 font-bold text-sm">
            {isLocal ? "ローカルツール" : "占いスピYTツール"}
          </span>
        </div>
      )}

      {/* モバイルオーバーレイ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* サイドバー：デスクトップは常時表示、モバイルはスライドイン */}
      <div className={`
        fixed md:static z-30 h-full
        transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {isLaunch ? <LaunchSidebar /> : <Sidebar onNavigate={() => setMobileMenuOpen(false)} />}
      </div>

      {/* メインコンテンツ */}
      <main className={`flex-1 overflow-auto ${isMobileFullscreen ? "pt-0 md:pt-0" : "pt-14 md:pt-0"}`}>{children}</main>
    </>
  );
}
