"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/revenue", label: "カレンダー", exact: true },
  { href: "/revenue/stats", label: "集計", exact: false },
];

export default function RevenueNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-[#0b1020]/85 backdrop-blur-xl border-b border-white/10">
      <div
        className="max-w-lg mx-auto px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-4 h-4 text-[#0b1020]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
            </svg>
          </div>
          <h1 className="text-white font-bold tracking-tight">収益カレンダー</h1>
        </div>

        <nav className="mt-3 flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${
                  active ? "bg-white text-[#0b1020] shadow" : "text-white/60 hover:text-white/90"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
