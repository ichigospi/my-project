"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/icons";
import { PeriodTabs, CustomRangeInputs, AccountChips } from "@/components/FilterBar";
import { useAccounts, useSummary } from "@/lib/use-dashboard-data";
import type { PeriodKey } from "@/lib/dates";
import type { SummaryData } from "@/app/api/summary/route";

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function num(n: number): string {
  return n.toLocaleString("ja-JP");
}

function rate(numer: number, denom: number): number | null {
  if (denom === 0) return null;
  return (numer / denom) * 100;
}

function pctStr(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

// ファネル各段階の人数・件数を summary から取り出す
function funnelCounts(s: SummaryData) {
  return {
    listIn: s.listIn,
    freeApply: s.freeApply,
    paid: s.salesByCategory["paid_reading"]?.quantity ?? 0,
    upsell: s.salesByCategory["upsell"]?.quantity ?? 0,
    course: s.salesByCategory["course"]?.quantity ?? 0,
  };
}

const FUNNEL_STAGES: { key: keyof ReturnType<typeof funnelCounts>; label: string }[] = [
  { key: "listIn", label: "リストイン" },
  { key: "freeApply", label: "無料鑑定" },
  { key: "paid", label: "有料鑑定" },
  { key: "upsell", label: "アップセル" },
  { key: "course", label: "講座" },
];

function FunnelView({ current, previous }: { current: SummaryData; previous: SummaryData | null }) {
  const cur = funnelCounts(current);
  const prev = previous ? funnelCounts(previous) : null;

  // 隣接段階間の移行率と前期間比（pt差）
  const steps = FUNNEL_STAGES.slice(0, -1).map((stage, i) => {
    const next = FUNNEL_STAGES[i + 1];
    const curRate = rate(cur[next.key], cur[stage.key]);
    const prevRate = prev ? rate(prev[next.key], prev[stage.key]) : null;
    const delta = curRate !== null && prevRate !== null ? curRate - prevRate : null;
    return { from: stage, to: next, curRate, delta };
  });

  // 前期間比が最も悪化している段階＝ボトルネック候補
  const worst = steps.reduce<(typeof steps)[number] | null>((acc, s) => {
    if (s.delta === null || s.delta >= 0) return acc;
    if (!acc || s.delta < (acc.delta as number)) return s;
    return acc;
  }, null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5">
      <div className="text-[13px] font-medium text-gray-500 mb-4">ファネル（導線の移行率）</div>
      <div className="overflow-x-auto">
        <div className="flex items-stretch gap-1 min-w-[720px]">
          {FUNNEL_STAGES.map((stage, i) => {
            const step = i < steps.length ? steps[i] : null;
            const isWorstStep = worst !== null && step === worst;
            return (
              <div key={stage.key} className="flex items-stretch gap-1 flex-1">
                <div className="flex-1 rounded-xl bg-violet-50/60 border border-violet-100 px-3 py-3 text-center">
                  <div className="text-xs text-gray-500">{stage.label}</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">{num(cur[stage.key])}</div>
                </div>
                {step && (
                  <div
                    className={`w-20 shrink-0 flex flex-col items-center justify-center rounded-xl px-1 ${
                      isWorstStep ? "bg-red-50 border border-red-200" : ""
                    }`}
                  >
                    <Icon d={ICONS.arrowRight} className="w-4 h-4 text-gray-300" />
                    <div className={`text-sm font-bold ${isWorstStep ? "text-red-600" : "text-gray-700"}`}>
                      {pctStr(step.curRate)}
                    </div>
                    {step.delta !== null && (
                      <div
                        className={`text-[11px] font-medium ${
                          step.delta < 0 ? "text-red-500" : "text-emerald-600"
                        }`}
                      >
                        {step.delta >= 0 ? "+" : ""}
                        {step.delta.toFixed(1)}pt
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {worst && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <span className="text-red-500 mt-0.5">
            <Icon d={ICONS.warn} className="w-5 h-5" />
          </span>
          <div className="text-sm text-red-700">
            <span className="font-bold">
              {worst.from.label}→{worst.to.label}
            </span>
            の移行率が前期間比 {worst.delta!.toFixed(1)}pt と最も悪化しています。ここがボトルネック候補です。
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  icon: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-gray-500">{label}</div>
        <div className="mt-1.5 text-[26px] leading-tight font-bold text-gray-900 truncate">{value}</div>
        {sub && <div className="mt-1 text-sm text-gray-400">({sub})</div>}
        {delta !== undefined && delta !== null && (
          <div className={`mt-1 text-sm font-medium ${delta < 0 ? "text-red-500" : "text-emerald-600"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}pt 前期間比
          </div>
        )}
      </div>
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
        <Icon d={icon} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [account, setAccount] = useState<string | "all">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { accounts } = useAccounts();
  const { current, previous, loading, refresh } = useSummary(period, account, customFrom, customTo);

  const s = current;
  const p = previous;

  const paid = s?.salesByCategory["paid_reading"] ?? { amount: 0, quantity: 0 };
  const upsell = s?.salesByCategory["upsell"] ?? { amount: 0, quantity: 0 };

  const freeRate = s ? rate(s.freeApply, s.listIn) : null;
  const paidRate = s ? rate(paid.quantity, s.freeApply) : null;
  const upsellRate = s ? rate(upsell.quantity, paid.quantity) : null;

  const freeRateDelta =
    s && p ? diffPt(rate(s.freeApply, s.listIn), rate(p.freeApply, p.listIn)) : null;
  const paidRateDelta =
    s && p
      ? diffPt(
          rate(paid.quantity, s.freeApply),
          rate(p.salesByCategory["paid_reading"]?.quantity ?? 0, p.freeApply)
        )
      : null;

  function diffPt(a: number | null, b: number | null): number | null {
    if (a === null || b === null) return null;
    return a - b;
  }

  const sourceCards = [
    { key: "threads", label: "スレッズ", tint: "bg-gray-100 text-gray-500" },
    { key: "insta", label: "インスタ", tint: "bg-pink-50 text-pink-500" },
    { key: "x", label: "X", tint: "bg-gray-100 text-gray-600" },
    { key: "youtube", label: "YOUTUBE", tint: "bg-red-50 text-red-400" },
    { key: "other", label: "その他", tint: "bg-sky-50 text-sky-500" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto p-5 md:p-8 space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">ダッシュボード</h2>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
        >
          <Icon d={ICONS.refresh} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          更新
        </button>
        <Link
          href="/records"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-violet-600 text-sm font-medium transition-colors"
        >
          <Icon d={ICONS.pencil} className="w-4 h-4" />
          実績を入力
        </Link>
        <div className="ml-auto">
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>
      </div>

      {period === "custom" && (
        <CustomRangeInputs from={customFrom} to={customTo} onFrom={setCustomFrom} onTo={setCustomTo} />
      )}

      <AccountChips accounts={accounts} selected={account} onChange={setAccount} />

      {!s ? (
        <div className="text-gray-400 text-sm py-20 text-center">読み込み中...</div>
      ) : (
        <>
          {/* ファネルビュー */}
          <FunnelView current={s} previous={p} />

          {/* 売上 + リスト単価 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <div className="sm:col-span-2 xl:col-span-2 rounded-2xl p-6 text-white bg-gradient-to-br from-[#a566f0] to-[#7c3aed] shadow-[0_8px_24px_rgba(124,58,237,0.25)] flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/80">売上</div>
                <div className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">{yen(s.salesTotal)}</div>
                {p && (
                  <div className="mt-1 text-sm text-white/80">前期間: {yen(p.salesTotal)}</div>
                )}
              </div>
              <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                <Icon d={ICONS.yen} className="w-8 h-8" />
              </div>
            </div>
            <KpiCard
              label="リスト単価"
              value={s.listIn === 0 ? "—" : yen(s.salesTotal / s.listIn)}
              icon={ICONS.tag}
              tint="bg-emerald-50 text-emerald-500"
            />
          </div>

          {/* リストイン + 媒体別 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="リストイン数" value={num(s.listIn)} icon={ICONS.users} tint="bg-violet-50 text-violet-500" />
            {sourceCards.slice(0, 4).map((c) => (
              <KpiCard
                key={c.key}
                label={c.label}
                value={num(s.bySource[c.key] ?? 0)}
                sub={pctStr(rate(s.bySource[c.key] ?? 0, s.listIn))}
                icon={ICONS.users}
                tint={c.tint}
              />
            ))}
          </div>

          {/* 無料鑑定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="無料鑑定申込" value={num(s.freeApply)} icon={ICONS.eye} tint="bg-sky-50 text-sky-500" />
            <KpiCard
              label="無料鑑定移行率"
              value={pctStr(freeRate)}
              delta={freeRateDelta}
              icon={ICONS.swap}
              tint="bg-indigo-50 text-indigo-500"
            />
            <KpiCard
              label="鑑定送付済み"
              value={num(s.freeSent)}
              sub={s.freeApply > s.freeSent ? `未送付 ${num(s.freeApply - s.freeSent)}` : undefined}
              icon={ICONS.card}
              tint="bg-teal-50 text-teal-500"
            />
          </div>

          {/* 有料鑑定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="有料鑑定数" value={num(paid.quantity)} icon={ICONS.card} tint="bg-amber-50 text-amber-500" />
            <KpiCard
              label="有料鑑定移行率"
              value={pctStr(paidRate)}
              delta={paidRateDelta}
              icon={ICONS.percent}
              tint="bg-orange-50 text-orange-500"
            />
            <KpiCard
              label="有料鑑定 平均単価"
              value={paid.quantity === 0 ? "—" : yen(paid.amount / paid.quantity)}
              icon={ICONS.yen}
              tint="bg-emerald-50 text-emerald-500"
            />
          </div>

          {/* アップセル */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 pb-8">
            <KpiCard label="アップセル数" value={num(upsell.quantity)} icon={ICONS.trendUp} tint="bg-green-50 text-green-500" />
            <KpiCard label="アップセル率" value={pctStr(upsellRate)} icon={ICONS.hands} tint="bg-rose-50 text-rose-400" />
            <KpiCard
              label="アップセル 平均単価"
              value={upsell.quantity === 0 ? "—" : yen(upsell.amount / upsell.quantity)}
              icon={ICONS.tag}
              tint="bg-violet-50 text-violet-500"
            />
          </div>
        </>
      )}
    </div>
  );
}
