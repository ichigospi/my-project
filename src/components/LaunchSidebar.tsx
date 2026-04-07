"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { getApiKey } from "@/lib/channel-store";

const launchNavItems = [
  { href: "/launch", label: "\u8a2d\u8a08\u66f8", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/launch/posts", label: "\u6295\u7a3f\u751f\u6210", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
  { href: "/launch/columns", label: "\u30b3\u30e9\u30e0", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  { href: "/launch/letter", label: "\u30bb\u30fc\u30eb\u30b9\u30ec\u30bf\u30fc", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { href: "/launch/line", label: "LINE\u914d\u4fe1", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
];

export default function LaunchSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [aiStatus, setAiStatus] = useState(false);

  useEffect(() => {
    setAiStatus(!!getApiKey("ai_api_key"));
    const interval = setInterval(() => {
      setAiStatus(!!getApiKey("ai_api_key"));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 min-h-screen bg-[#1a1a2e] text-sidebar-text flex flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">ローンチツール</h1>
        <p className="text-xs text-sidebar-text/60 mt-1">14日間ローンチ設計 & コンテンツ生成</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {launchNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-text/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-text/50 hover:bg-white/5 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            YTツールに戻る
          </Link>
        </div>
      </nav>
      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${aiStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">AI API: {aiStatus ? "接続済み" : "未設定"}</span>
          </div>
        </div>
        {session?.user && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-sidebar-text/60">
              <div className="text-white/90 font-medium">{session.user.name}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-sidebar-text/50 hover:text-white transition-colors"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
