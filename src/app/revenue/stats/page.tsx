"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RevenueNav from "@/components/revenue/RevenueNav";
import {
  addMonths,
  daysBetween,
  formatShortDate,
  monthRange,
  netByDate,
  summarize,
  summarizeByLabel,
  summarizeByMonth,
  todayKey,
  yen,
  type RevenueEntry,
  type RevenueType,
} from "@/lib/revenue";

type PresetKey = "thisMonth" | "lastMonth" | "last30" | "thisYear" | "all" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "thisMonth", label: "今月" },
  { key: "lastMonth", label: "先月" },
  { key: "last30", label: "過去30日" },
  { key: "thisYear", label: "今年" },
  { key: "all", label: "全期間" },
  { key: "custom", label: "カスタム" },
];

function presetRange(key: PresetKey, allFrom: string, allTo: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  switch (key) {
    case "thisMonth":
      return monthRange(y, m);
    case "lastMonth": {
      const prev = addMonths(y, m, -1);
      return monthRange(prev.year, prev.month);
    }
    case "last30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return {
        from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`,
        to: todayKey(),
      };
    }
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    default:
      return { from: allFrom, to: allTo };
  }
}

export default function RevenueStatsPage() {
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PresetKey>("thisMonth");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rankType, setRankType] = useState<RevenueType>("income");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/revenue");
      if (!res.ok) throw new Error(`取得に失敗しました (${res.status})`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 全期間の端（記録が無ければ今日）
  const allFrom = useMemo(
    () => entries.reduce((min, e) => (min && min < e.date ? min : e.date), "") || todayKey(),
    [entries]
  );
  const allTo = useMemo(
    () => entries.reduce((max, e) => (max && max > e.date ? max : e.date), "") || todayKey(),
    [entries]
  );

  // プリセット変更・データ読み込み後に期間を同期（カスタム時は触らない）
  useEffect(() => {
    if (preset === "custom") return;
    const range = presetRange(preset, allFrom, allTo);
    setFrom(range.from);
    setTo(range.to);
  }, [preset, allFrom, allTo]);

  const allTime = useMemo(() => summarize(entries), [entries]);

  const periodEntries = useMemo(() => {
    if (!from || !to) return [];
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    return entries.filter((e) => e.date >= lo && e.date <= hi);
  }, [entries, from, to]);

  const period = useMemo(() => summarize(periodEntries), [periodEntries]);

  const periodDays = useMemo(() => {
    if (!from || !to) return 0;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    return Math.max(daysBetween(lo, hi), 1);
  }, [from, to]);

  const activeDays = useMemo(() => new Set(periodEntries.map((e) => e.date)).size, [periodEntries]);

  const bestDay = useMemo(() => {
    const map = netByDate(periodEntries);
    let best: { date: string; net: number } | null = null;
    for (const [date, net] of map) {
      if (!best || net > best.net) best = { date, net };
    }
    return best;
  }, [periodEntries]);

  const monthly = useMemo(() => summarizeByMonth(periodEntries), [periodEntries]);
  const monthlyMax = useMemo(
    () => Math.max(1, ...monthly.map((m) => Math.abs(m.summary.net))),
    [monthly]
  );

  const ranking = useMemo(
    () => summarizeByLabel(periodEntries.filter((e) => e.type === rankType)).slice(0, 8),
    [periodEntries, rankType]
  );
  const rankingMax = useMemo(() => Math.max(1, ...ranking.map((r) => r.total)), [ranking]);
  const rankingTotal = rankType === "income" ? period.income : period.expense;

  // 桁が多いときだけ文字サイズを落として折り返さないようにする
  const periodIncomeText = period.income.toLocaleString("ja-JP");

  const setCustom = (which: "from" | "to", value: string) => {
    setPreset("custom");
    if (which === "from") setFrom(value);
    else setTo(value);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <RevenueNav />

      <main className="max-w-lg mx-auto px-4 pb-16">
        {/* 累計 */}
        <section className="mt-4 rounded-3xl p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-white border border-emerald-200">
          <div className="text-[11px] font-semibold text-emerald-700">累計売上（全期間）</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">
            {allTime.income.toLocaleString("ja-JP")}
            <span className="text-lg font-semibold text-gray-500 ml-1">円</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white border border-gray-200 py-2.5">
              <div className="text-[10px] text-gray-400">累計支出</div>
              <div className="text-sm font-bold text-rose-500 mt-0.5">{yen(allTime.expense)}</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 py-2.5">
              <div className="text-[10px] text-gray-400">累計利益</div>
              <div className={`text-sm font-bold mt-0.5 ${allTime.net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {yen(allTime.net)}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 py-2.5">
              <div className="text-[10px] text-gray-400">記録件数</div>
              <div className="text-sm font-bold mt-0.5">{allTime.count}件</div>
            </div>
          </div>
          {entries.length > 0 && (
            <div className="mt-3 text-[11px] text-gray-400">
              {allFrom.replace(/-/g, "/")} 〜 {allTo.replace(/-/g, "/")}
            </div>
          )}
        </section>

        {error && (
          <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* 期間選択 */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 px-1">期間を絞って見る</h2>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition active:scale-95 ${
                  preset === p.key
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setCustom("from", e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <span className="text-gray-400">〜</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setCustom("to", e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </section>

        {/* 期間サマリー */}
        <section className="mt-2 rounded-3xl bg-white border border-gray-200 shadow-sm px-5 pt-4 pb-5">
          <div
            className={`font-bold tracking-tight text-emerald-600 leading-none ${
              periodIncomeText.length > 9 ? "text-4xl" : "text-5xl"
            }`}
          >
            {periodIncomeText}
            <span className="text-xl font-semibold text-gray-400 ml-1.5">円</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white border border-gray-200 px-3 py-2.5">
              <div className="text-[10px] text-gray-400">支出</div>
              <div className="text-sm font-bold text-rose-500 mt-0.5">{yen(period.expense)}</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 px-3 py-2.5">
              <div className="text-[10px] text-gray-400">差引合計</div>
              <div className={`text-sm font-bold mt-0.5 ${period.net >= 0 ? "text-gray-900" : "text-rose-500"}`}>
                {yen(period.net)}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 px-3 py-2.5">
              <div className="text-[10px] text-gray-400">1日平均（{periodDays}日）</div>
              <div className="text-sm font-bold mt-0.5">{yen(Math.round(period.income / periodDays))}</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 px-3 py-2.5">
              <div className="text-[10px] text-gray-400">記録のあった日</div>
              <div className="text-sm font-bold mt-0.5">
                {activeDays}日 <span className="text-gray-400 font-normal">/ {period.count}件</span>
              </div>
            </div>
          </div>

          {bestDay && (
            <div className="mt-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-emerald-700">最高日 {formatShortDate(bestDay.date)}</span>
              <span className="text-sm font-bold text-emerald-600">{yen(bestDay.net)}</span>
            </div>
          )}
        </section>

        {/* 月別推移 */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 px-1">月別の推移</h2>
          {loading ? (
            <div className="mt-3 h-32 rounded-3xl bg-gray-100 animate-pulse" />
          ) : monthly.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400 px-1">この期間の記録はありません</p>
          ) : (
            <div className="mt-3 rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-2.5">
              {monthly.map(({ month, summary }) => {
                const width = Math.round((Math.abs(summary.net) / monthlyMax) * 100);
                const [y, m] = month.split("-");
                return (
                  <div key={month}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-gray-500">
                        {Number(y)}年{Number(m)}月
                      </span>
                      <span className={summary.net >= 0 ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
                        {yen(summary.net)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          summary.net >= 0
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-rose-500 to-orange-500"
                        }`}
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 項目別 */}
        <section className="mt-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-gray-500">項目別の内訳</h2>
            <div className="flex gap-1 p-0.5 rounded-xl bg-gray-100 border border-gray-200">
              {(["income", "expense"] as RevenueType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setRankType(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    rankType === t ? "bg-gray-900 text-white" : "text-gray-500"
                  }`}
                >
                  {t === "income" ? "収入" : "支出"}
                </button>
              ))}
            </div>
          </div>

          {ranking.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400 px-1">この期間の記録はありません</p>
          ) : (
            <div className="mt-3 rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
              {ranking.map((r) => {
                const share = rankingTotal > 0 ? Math.round((r.total / rankingTotal) * 100) : 0;
                return (
                  <div key={r.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="truncate">
                        {r.name}
                        <span className="text-gray-400 ml-1.5 text-[11px]">{r.count}件</span>
                      </span>
                      <span className="font-bold ml-2 shrink-0">
                        {yen(r.total)}
                        <span className="text-gray-400 font-normal ml-1.5">{share}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          rankType === "income"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-rose-500 to-orange-500"
                        }`}
                        style={{ width: `${Math.max(Math.round((r.total / rankingMax) * 100), 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
