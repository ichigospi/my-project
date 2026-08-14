// 暦バナー: 全Threadsページ上部に表示。
// 1段目=今日の暦（干支/六曜/神吉日/旧暦）、2段目=開運日（当日・明日・2日後、無ければ次の開運日）。
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  dayAlmanac,
  luckyForDate,
  offsetLabel,
  type DayAlmanac,
  type LuckyEvent,
  type UpcomingNotice,
  upcomingNotices,
} from "@/lib/threads-koyomi";

interface NextDay {
  iso: string;
  m: number;
  d: number;
  days: number;
  events: LuckyEvent[];
}

// 今日から maxDays 先までで最初の開運日を探す（当日〜2日後に無いとき用）
function findNext(maxDays = 60): NextDay | null {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const baseY = jst.getUTCFullYear();
  const baseM = jst.getUTCMonth();
  const baseD = jst.getUTCDate();
  for (let off = 3; off <= maxDays; off++) {
    const dt = new Date(Date.UTC(baseY, baseM, baseD + off));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const events = luckyForDate(y, m, d);
    if (events.length > 0) {
      return { iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, m, d, days: off, events };
    }
  }
  return null;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
function jstWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// 六曜の吉凶に応じた色（大安=吉, 友引=やや吉, 先勝/先負=半, 赤口/仏滅=凶）
function rokuyoClass(label: string): string {
  if (label === "大安") return "bg-emerald-500/25 text-emerald-200";
  if (label === "友引") return "bg-teal-500/20 text-teal-200";
  if (label === "仏滅" || label === "赤口") return "bg-rose-500/20 text-rose-200";
  return "bg-neutral-700/60 text-neutral-200"; // 先勝・先負
}

function eventChips(events: LuckyEvent[]) {
  return events.map((e, i) => (
    <span
      key={i}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
        e.strong ? "bg-amber-400/25 text-amber-200" : "bg-neutral-700/60 text-neutral-200"
      }`}
    >
      {e.emoji}
      {e.label}
    </span>
  ));
}

export default function KoyomiNotice() {
  const [almanac, setAlmanac] = useState<DayAlmanac | null>(null);
  const [notices, setNotices] = useState<UpcomingNotice[] | null>(null);
  const [next, setNext] = useState<NextDay | null>(null);

  useEffect(() => {
    setAlmanac(dayAlmanac());
    const n = upcomingNotices();
    setNotices(n);
    if (n.length === 0) setNext(findNext());
  }, []);

  if (almanac === null || notices === null) return null; // 計算前（SSRとの不一致回避）

  const a = almanac;
  const [, mm, dd] = a.iso.split("-").map(Number);

  return (
    <div className="border-b border-neutral-800">
      {/* 1段目: 今日の暦 */}
      <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 bg-neutral-900/50">
        <span className="text-sm font-bold text-neutral-100">📅 今日の暦</span>
        <span className="text-[11px] font-bold text-neutral-300">
          {mm}/{dd}（{jstWeekday(a.iso)}）
        </span>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-neutral-700/60 text-neutral-200"
          title={`${a.ganshi}（${a.ganshiYomi}）`}
        >
          干支 {a.ganshi}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${rokuyoClass(a.rokuyo.label)}`}
          title={`${a.rokuyo.label}（${a.rokuyo.yomi}）: ${a.rokuyo.desc}`}
        >
          六曜 {a.rokuyo.label}
        </span>
        {a.kamiyoshi && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold bg-indigo-500/25 text-indigo-200"
            title="神吉日: 神社参拝・神事・祈願に吉"
          >
            ⛩️ 神吉日
          </span>
        )}
        <span className="text-[11px] text-neutral-500">
          旧暦 {a.kyureki.leap ? "閏" : ""}
          {a.kyureki.month}/{a.kyureki.day}
        </span>
        <span className="hidden md:inline text-[11px] text-neutral-500">{a.rokuyo.desc}</span>
      </div>

      {/* 2段目: 開運日 */}
      {notices.length > 0 ? (
        (() => {
          const hasStrong = notices.some((n) => n.events.some((e) => e.strong));
          return (
            <div
              className={`px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t ${
                hasStrong
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-transparent"
                  : "border-neutral-800 bg-neutral-900/30"
              }`}
            >
              <span className="text-sm font-bold text-neutral-100">🗓️ 開運日</span>
              {notices.map((n) => (
                <span key={n.offset} className="inline-flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      n.offset === 0 ? "bg-white text-black" : "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {offsetLabel(n.offset)}（{n.m}/{n.d}）
                  </span>
                  {eventChips(n.events)}
                </span>
              ))}
              <Link
                href="/threads/create"
                className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-white text-black hover:bg-neutral-200 whitespace-nowrap"
              >
                この日の投稿を作る →
              </Link>
              <Link href="/threads/calendar" className="text-[11px] text-neutral-400 hover:text-neutral-200 whitespace-nowrap underline">
                カレンダー
              </Link>
            </div>
          );
        })()
      ) : next ? (
        <div className="px-4 md:px-6 py-1.5 border-t border-neutral-800 bg-neutral-900/20 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-neutral-400">
            次の開運日は <span className="text-neutral-200 font-bold">{next.days}日後（{next.m}/{next.d}）</span>
          </span>
          {eventChips(next.events)}
          <Link href="/threads/calendar" className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-300 underline whitespace-nowrap">
            カレンダーを見る
          </Link>
        </div>
      ) : null}
    </div>
  );
}
