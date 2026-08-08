// 開運日カレンダー（月表示）: 天赦日・一粒万倍日・寅の日・巳の日・満月・新月
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { luckyCalendar, type DayLucky } from "@/lib/threads-koyomi";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const LEGEND = [
  { emoji: "✨", label: "天赦日", note: "最強開運日" },
  { emoji: "🌱", label: "一粒万倍日", note: "始め事が万倍に" },
  { emoji: "🐯", label: "寅の日", note: "金運" },
  { emoji: "🐍", label: "巳の日/己巳の日", note: "金運・弁財天" },
  { emoji: "🌕", label: "満月", note: "手放し・完了" },
  { emoji: "🌑", label: "新月", note: "願い事・始まり" },
];

function todayJst() {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  return { y: jst.getUTCFullYear(), m: jst.getUTCMonth() + 1, d: jst.getUTCDate() };
}

export default function CalendarPage() {
  const t = todayJst();
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: t.y, m: t.m });

  const days = useMemo(() => luckyCalendar(ym.y, ym.m), [ym]);

  // 先頭の空白（1日の曜日ぶん）
  const firstWeekday = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const cells: (DayLucky | null)[] = [...Array(firstWeekday).fill(null), ...days];

  const move = (delta: number) => {
    setYm((cur) => {
      const idx = cur.y * 12 + (cur.m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  };

  // 今月の最強日（天赦日 or 一粒万倍日×天赦日など strongを含む日）
  const strongDays = days.filter((d) => d.events.some((e) => e.strong));

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">開運日カレンダー</h2>
        <p className="text-sm text-neutral-400 mt-1">
          天赦日・一粒万倍日・寅の日・巳の日・満月・新月。占い/開運アカウントの投稿タイミングに。
        </p>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-between">
        <button onClick={() => move(-1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm">
          ← 前月
        </button>
        <div className="text-lg font-bold text-neutral-100">
          {ym.y}年 {ym.m}月
          {(ym.y !== t.y || ym.m !== t.m) && (
            <button onClick={() => setYm({ y: t.y, m: t.m })} className="ml-3 text-xs text-sky-400 hover:underline">
              今月へ
            </button>
          )}
        </div>
        <button onClick={() => move(1)} className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm">
          翌月 →
        </button>
      </div>

      {/* カレンダーグリッド */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`text-center text-xs font-bold py-2 border-b border-neutral-800 ${
                i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-neutral-400"
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e${i}`} className="min-h-[76px] border-b border-r border-neutral-800 bg-neutral-950/40" />;
            const isToday = cell.y === t.y && cell.m === t.m && cell.d === t.d;
            const hasStrong = cell.events.some((e) => e.strong);
            const wd = (firstWeekday + cell.d - 1) % 7;
            return (
              <div
                key={cell.iso}
                className={`min-h-[76px] p-1.5 border-b border-r border-neutral-800 flex flex-col gap-1 ${
                  hasStrong ? "bg-amber-500/10" : ""
                } ${isToday ? "ring-2 ring-inset ring-white" : ""}`}
              >
                <span
                  className={`text-xs font-bold ${
                    isToday ? "text-white" : wd === 0 ? "text-rose-400" : wd === 6 ? "text-sky-400" : "text-neutral-300"
                  }`}
                >
                  {cell.d}
                </span>
                <div className="flex flex-col gap-0.5">
                  {cell.events.map((e, j) => (
                    <span
                      key={j}
                      className={`text-[9px] leading-tight rounded px-1 py-0.5 truncate ${
                        e.strong ? "bg-amber-400/25 text-amber-200 font-bold" : "bg-neutral-800 text-neutral-300"
                      }`}
                      title={e.label}
                    >
                      {e.emoji}
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 今月の最強日 */}
      {strongDays.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 to-transparent border border-amber-500/40 rounded-xl p-4">
          <h3 className="text-sm font-bold text-amber-200 mb-2">✨ 今月の最強クラスの開運日</h3>
          <div className="space-y-1.5">
            {strongDays.map((d) => (
              <div key={d.iso} className="flex items-center gap-2 text-sm">
                <span className="font-bold text-neutral-100 w-14">
                  {d.m}/{d.d}
                </span>
                <span className="flex flex-wrap gap-1">
                  {d.events.map((e, j) => (
                    <span
                      key={j}
                      className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                        e.strong ? "bg-amber-400/25 text-amber-200" : "bg-neutral-700/60 text-neutral-200"
                      }`}
                    >
                      {e.emoji}
                      {e.label}
                    </span>
                  ))}
                </span>
                <Link href="/threads/create" className="ml-auto text-[11px] text-sky-400 hover:underline whitespace-nowrap">
                  投稿を作る →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <h3 className="text-xs font-bold text-neutral-400 mb-2">凡例</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-neutral-300">
              <span>{l.emoji}</span>
              <span className="font-bold">{l.label}</span>
              <span className="text-neutral-500">{l.note}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-neutral-600 mt-3">
          ※ 天赦日・一粒万倍日・寅の日・巳の日は暦（干支・節気）から、満月・新月は天文計算で算出。日本時間基準。
        </p>
      </div>
    </main>
  );
}
