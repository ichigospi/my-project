"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";

const navItems = [
  { href: "/", label: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { href: "/channel", label: "\u30c1\u30e3\u30f3\u30cd\u30eb\u5206\u6790", icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/search", label: "\u52d5\u753b\u691c\u7d22", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/trends", label: "\u30c8\u30ec\u30f3\u30c9\u30ad\u30fc\u30ef\u30fc\u30c9", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/thumbnails", label: "\u30b5\u30e0\u30cd\u30fb\u30bf\u30a4\u30c8\u30eb\u5206\u6790", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/analysis", label: "\u53f0\u672c\u5206\u6790", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/script", label: "\u53f0\u672c\u4f5c\u6210", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { href: "/settings", label: "\u8a2d\u5b9a", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [ytStatus, setYtStatus] = useState(false);
  const [aiStatus, setAiStatus] = useState(false);

  useEffect(() => {
    setYtStatus(!!getApiKey("yt_api_key"));
    setAiStatus(!!getApiKey("ai_api_key"));

    // localStorageの変更を監視
    const interval = setInterval(() => {
      setYtStatus(!!getApiKey("yt_api_key"));
      setAiStatus(!!getApiKey("ai_api_key"));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 min-h-screen bg-sidebar-bg text-sidebar-text flex flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">占いスピYTツール</h1>
        <p className="text-xs text-sidebar-text/60 mt-1">競合リサーチ & 台本作成</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
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
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ytStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">YouTube API: {ytStatus ? "接続済み" : "未設定"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${aiStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">AI API: {aiStatus ? "接続済み" : "未設定"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
