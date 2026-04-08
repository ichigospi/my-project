"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { getApiKey } from "@/lib/channel-store";
import { getTaskManager } from "@/lib/analysis-task-manager";
import { onSyncStatus } from "@/lib/shared-sync";

const navItems = [
  { href: "/workflow", label: "\u5de5\u7a0b\u8868", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/", label: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { href: "/channel", label: "\u30c1\u30e3\u30f3\u30cd\u30eb\u5206\u6790", icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/search", label: "\u52d5\u753b\u691c\u7d22", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/ideas", label: "\u4f01\u753b\u51fa\u3057", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { href: "/analysis", label: "\u53f0\u672c\u5206\u6790", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/create", label: "\u53f0\u672c\u4f5c\u6210", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  { href: "/presets", label: "\u53f0\u672c\u30eb\u30fc\u30eb", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { href: "/hookdb", label: "\u30d5\u30c3\u30af&CTA", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { href: "/performance", label: "\u30d1\u30d5\u30a9\u30fc\u30de\u30f3\u30b9", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/guide", label: "\u4f7f\u3044\u65b9", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/settings", label: "\u8a2d\u5b9a", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [ytStatus, setYtStatus] = useState(false);
  const [aiStatus, setAiStatus] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [syncStatus, setSyncStatus] = useState<"" | "syncing" | "synced" | "error">("");
  const userRole = (session?.user as { role?: string } | undefined)?.role || "";

  useEffect(() => {
    setYtStatus(!!getApiKey("yt_api_key"));
    setAiStatus(!!getApiKey("ai_api_key"));

    const interval = setInterval(() => {
      setYtStatus(!!getApiKey("yt_api_key"));
      setAiStatus(!!getApiKey("ai_api_key"));
    }, 3000);

    // タスクマネージャーの進捗を購読
    const mgr = getTaskManager();
    const unsubscribe = mgr.subscribe((tasks) => {
      const active = tasks.filter((t) => t.status !== "done" && t.status !== "error");
      setAnalysisActive(active.length);
      const current = tasks.find((t) => t.status !== "done" && t.status !== "error" && t.status !== "queued");
      setAnalysisProgress(current ? current.progress : "");
    });

    const unsubscribeSync = onSyncStatus((status) => {
      setSyncStatus(status);
      if (status === "synced") {
        // 同期完了後にAPIキー状態も更新
        setYtStatus(!!getApiKey("yt_api_key"));
        setAiStatus(!!getApiKey("ai_api_key"));
        setTimeout(() => setSyncStatus(""), 3000);
      }
    });

    return () => { clearInterval(interval); unsubscribe(); unsubscribeSync(); };
  }, []);

  const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";

  return (
    <aside className={`w-64 min-h-screen ${isLocal ? "bg-[#1a2332]" : "bg-sidebar-bg"} text-sidebar-text flex flex-col shrink-0`}>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">占いスピYTツール</h1>
          {isLocal && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white">LOCAL</span>
          )}
        </div>
        <p className="text-xs text-sidebar-text/60 mt-1">
          {isLocal ? "ローカル環境（OCR作業用）" : "競合リサーチ & 台本作成"}
        </p>
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
              {analysisActive > 0 && (item.href === "/analysis" || item.href === "/create") && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white animate-pulse">
                  {analysisActive}
                </span>
              )}
            </Link>
          );
        })}
        <div className="pt-4 mt-4 border-t border-white/10">
          <Link
            href="/launch"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-text/50 hover:bg-white/5 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            ローンチツールへ
          </Link>
        </div>
      </nav>
      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ytStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">YouTube API: {ytStatus ? "接続済み" : "未設定"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${aiStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">AI API: {aiStatus ? "接続済み" : "未設定"}</span>
          </div>
          {analysisActive > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sidebar-text/60 truncate">分析中({analysisActive}) {analysisProgress}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <span className={`w-2 h-2 rounded-full ${
              syncStatus === "syncing" ? "bg-blue-400 animate-pulse" :
              syncStatus === "synced" ? "bg-green-400" :
              syncStatus === "error" ? "bg-red-400" :
              "bg-green-400/50"
            }`} />
            <span className="text-sidebar-text/60">
              {syncStatus === "syncing" ? "同期中..." :
               syncStatus === "synced" ? "同期済み ✓" :
               syncStatus === "error" ? "同期エラー" :
               "同期済み"}
            </span>
          </div>
        </div>
        {session?.user && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-sidebar-text/60">
              <div className="text-white/90 font-medium">{session.user.name}</div>
              <div>{ROLE_LABELS[userRole] || userRole}</div>
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
