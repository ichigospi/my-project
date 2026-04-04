"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { getApiKey } from "@/lib/settings-store";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      {
        href: "/",
        label: "ダッシュボード",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
      },
    ],
  },
  {
    title: "ナレッジ",
    items: [
      {
        href: "/knowledge",
        label: "ナレッジ管理",
        icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
      },
    ],
  },
  {
    title: "マーケティング",
    items: [
      {
        href: "/launch-analysis",
        label: "競合分析",
        icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      },
      {
        href: "/sales-letter",
        label: "セールスレター",
        icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
      },
      {
        href: "/launch-proposal",
        label: "ローンチ提案",
        icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      },
    ],
  },
  {
    title: "分析",
    items: [
      {
        href: "/kpi",
        label: "KPI管理",
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      },
      {
        href: "/self-analysis",
        label: "自己分析",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
      },
    ],
  },
  {
    title: "LINE",
    items: [
      {
        href: "/line-replies",
        label: "LINE応答",
        icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
      },
      {
        href: "/line-templates",
        label: "LINEテンプレート",
        icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
      },
    ],
  },
  {
    title: "顧客",
    items: [
      {
        href: "/customers",
        label: "顧客管理",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
      },
      {
        href: "/customer-segments",
        label: "セグメント",
        icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z",
      },
    ],
  },
  {
    items: [
      {
        href: "/settings",
        label: "設定",
        icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      },
    ],
  },
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
  const [lineStatus, setLineStatus] = useState(false);
  const [aiStatus, setAiStatus] = useState(false);
  const [utageStatus, setUtageStatus] = useState(false);
  const userRole = (session?.user as { role?: string } | undefined)?.role || "";

  useEffect(() => {
    const checkStatus = () => {
      setLineStatus(!!getApiKey("line_api_key"));
      setAiStatus(!!getApiKey("ai_api_key"));
      setUtageStatus(!!getApiKey("utage_api_key"));
    };
    checkStatus();

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 min-h-screen bg-sidebar-bg text-sidebar-text flex flex-col shrink-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">占いスピマーケティングツール</h1>
        <p className="text-xs text-sidebar-text/60 mt-1">LINE × UTAGE マーケティング</p>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/40 mb-1">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${lineStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">LINE API: {lineStatus ? "接続済み" : "未設定"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${aiStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">AI API: {aiStatus ? "接続済み" : "未設定"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${utageStatus ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sidebar-text/60">UTAGE: {utageStatus ? "接続済み" : "未設定"}</span>
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
