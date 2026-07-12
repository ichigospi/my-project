"use client";

import { useEffect, useMemo, useState } from "react";
import { PeriodTabs, CustomRangeInputs, AccountChips } from "@/components/FilterBar";
import { useAccounts } from "@/lib/use-dashboard-data";
import { SALE_CATEGORIES, categoryLabel } from "@/lib/domain";
import { rangeForPeriod, type PeriodKey } from "@/lib/dates";

type SaleRow = {
  id: string;
  accountId: string;
  category: string;
  productName: string;
  amount: number;
  quantity: number;
  occurredOn: string;
  account: { name: string; color: string };
};

// カテゴリの色（固定順・固定色。フィルタで件数が変わっても色は変えない）
const CATEGORY_COLORS: Record<string, string> = {
  paid_reading: "#7c3aed", // violet
  upsell: "#2563eb", // blue
  course: "#0d9488", // teal
  repeat: "#ea580c", // orange
  launch: "#db2777", // pink
  other: "#6b7280", // gray
};

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function SalesBreakdownPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [account, setAccount] = useState<string | "all">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { accounts } = useAccounts();

  useEffect(() => {
    const params = new URLSearchParams();
    if (period === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    } else {
      const range = rangeForPeriod(period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
    }
    if (account !== "all") params.set("accountId", account);

    // 再取得中も前のデータを表示したままにする
    fetch(`/api/sales?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.sales ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, account, customFrom, customTo]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  const byCategory = useMemo(() => {
    const m: Record<string, { amount: number; quantity: number }> = {};
    for (const r of rows) {
      m[r.category] ??= { amount: 0, quantity: 0 };
      m[r.category].amount += r.amount;
      m[r.category].quantity += r.quantity;
    }
    return m;
  }, [rows]);

  const byAccount = useMemo(() => {
    const m: Record<string, { name: string; color: string; amount: number }> = {};
    for (const r of rows) {
      m[r.accountId] ??= { name: r.account.name, color: r.account.color, amount: 0 };
      m[r.accountId].amount += r.amount;
    }
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  }, [rows]);

  // 月次推移（カテゴリ別の積み上げ）
  const monthly = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const month = r.occurredOn.slice(0, 7);
      m[month] ??= {};
      m[month][r.category] = (m[month][r.category] ?? 0) + r.amount;
    }
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, cats]) => ({
        month,
        cats,
        total: Object.values(cats).reduce((s, v) => s + v, 0),
      }));
  }, [rows]);

  const maxMonth = Math.max(1, ...monthly.map((m) => m.total));
  const usedCategories = SALE_CATEGORIES.filter((c) => (byCategory[c.key]?.amount ?? 0) > 0);

  return (
    <div className="max-w-[1400px] mx-auto p-5 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">売上内訳</h2>
        <div className="ml-auto">
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>
      </div>

      {period === "custom" && (
        <CustomRangeInputs from={customFrom} to={customTo} onFrom={setCustomFrom} onTo={setCustomTo} />
      )}

      <AccountChips accounts={accounts} selected={account} onChange={setAccount} />

      {loading ? (
        <div className="text-gray-400 text-sm py-20 text-center">読み込み中...</div>
      ) : (
        <>
          {/* 合計 + カテゴリ別 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-[#a566f0] to-[#7c3aed] shadow-[0_8px_24px_rgba(124,58,237,0.25)]">
              <div className="text-sm font-medium text-white/80">合計売上</div>
              <div className="mt-2 text-4xl font-bold tracking-tight">{yen(total)}</div>
              <div className="mt-1 text-sm text-white/80">{rows.length}件の記録</div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
              <div className="text-[13px] font-medium text-gray-500 mb-4">カテゴリ別</div>
              <div className="space-y-3">
                {usedCategories.length === 0 && (
                  <div className="text-sm text-gray-400">この期間の売上記録はありません</div>
                )}
                {usedCategories.map((c) => {
                  const v = byCategory[c.key];
                  const share = total === 0 ? 0 : (v.amount / total) * 100;
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c.key] }} />
                      <span className="text-sm text-gray-700 w-24 shrink-0">{c.label}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share}%`, backgroundColor: CATEGORY_COLORS[c.key] }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-28 text-right shrink-0">{yen(v.amount)}</span>
                      <span className="text-xs text-gray-400 w-14 text-right shrink-0">{share.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 月次推移 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
            <div className="text-[13px] font-medium text-gray-500 mb-4">月次推移（カテゴリ別積み上げ・直近12か月）</div>
            {monthly.length === 0 ? (
              <div className="text-sm text-gray-400">データがありません</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-3 h-56 min-w-[480px] pt-6">
                    {monthly.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="text-[11px] text-gray-500 font-medium">{yen(m.total)}</div>
                        <div
                          className="w-full max-w-14 flex flex-col-reverse rounded-t"
                          style={{ height: `${(m.total / maxMonth) * 100}%` }}
                          title={`${m.month}: ${yen(m.total)}`}
                        >
                          {SALE_CATEGORIES.map((c) => {
                            const v = m.cats[c.key] ?? 0;
                            if (v === 0) return null;
                            return (
                              <div
                                key={c.key}
                                className="w-full first:rounded-b last:rounded-t"
                                style={{
                                  height: `${(v / m.total) * 100}%`,
                                  backgroundColor: CATEGORY_COLORS[c.key],
                                  marginTop: 2,
                                }}
                                title={`${categoryLabel(c.key)}: ${yen(v)}`}
                              />
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-400">{m.month.slice(2).replace("-", "/")}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  {usedCategories.map((c) => (
                    <div key={c.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[c.key] }} />
                      {c.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* アカウント別 + 明細 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
              <div className="text-[13px] font-medium text-gray-500 mb-4">アカウント別</div>
              <div className="space-y-3">
                {byAccount.length === 0 && <div className="text-sm text-gray-400">データがありません</div>}
                {byAccount.map((a) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-sm text-gray-700 flex-1 truncate">{a.name}</span>
                    <span className="text-sm font-bold text-gray-900">{yen(a.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
              <div className="text-[13px] font-medium text-gray-500 mb-4">明細（直近）</div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">日付</th>
                      <th className="py-2 pr-3 font-medium">アカウント</th>
                      <th className="py-2 pr-3 font-medium">カテゴリ</th>
                      <th className="py-2 pr-3 font-medium">商品名</th>
                      <th className="py-2 pr-3 font-medium text-right">件数</th>
                      <th className="py-2 font-medium text-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{r.occurredOn}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-700">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.account.color }} />
                            {r.account.name}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{categoryLabel(r.category)}</td>
                        <td className="py-2 pr-3 text-gray-500 truncate max-w-40">{r.productName || "—"}</td>
                        <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{r.quantity}</td>
                        <td className="py-2 text-right font-medium text-gray-900 tabular-nums">{yen(r.amount)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-400">
                          この期間の売上記録はありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
