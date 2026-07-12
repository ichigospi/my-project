"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Icon, ICONS } from "./icons";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: ICONS.chart },
  { href: "/sales", label: "売上内訳", icon: ICONS.pie },
  { href: "/records", label: "実績入力", icon: ICONS.pencil },
  { href: "/settings", label: "設定", icon: ICONS.gear },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <nav className="px-4 space-y-1 flex-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              active ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon d={item.icon} className="w-5 h-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = session?.user && (
    <div className="p-4 border-t border-white/15 flex items-center justify-between text-xs text-white/80">
      <span className="font-medium truncate">{session.user.name}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-white/60 hover:text-white transition-colors shrink-0 ml-2"
      >
        ログアウト
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#f5f6fa]">
      {/* デスクトップサイドバー */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col text-white bg-gradient-to-b from-[#ab87f5] via-[#9a6ef2] to-[#8558ee] sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-2.5">
          <span className="text-amber-300">
            <Icon d={ICONS.moon} className="w-6 h-6" />
          </span>
          <h1 className="text-lg font-bold">占いビジネス管理</h1>
        </div>
        {nav}
        {userFooter}
      </aside>

      {/* モバイルヘッダー + ドロワー */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3 text-white bg-gradient-to-r from-[#ab87f5] to-[#8558ee] shadow-lg">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 -ml-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="font-bold text-sm">占いビジネス管理</span>
      </div>
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="md:hidden fixed top-14 left-0 bottom-0 z-50 w-64 flex flex-col text-white bg-gradient-to-b from-[#ab87f5] to-[#8558ee]">
            <div className="pt-4" />
            {nav}
            {userFooter}
          </aside>
        </>
      )}

      <main className="flex-1 overflow-x-hidden pt-14 md:pt-0">{children}</main>
    </div>
  );
}
