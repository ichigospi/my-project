"use client";

import type { PeriodKey } from "@/lib/dates";

export type AccountLite = { id: string; name: string; color: string };

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "全期間" },
  { key: "week", label: "今週" },
  { key: "month", label: "今月" },
  { key: "lastMonth", label: "先月" },
  { key: "custom", label: "カスタム" },
];

export function PeriodTabs({
  period,
  onChange,
}: {
  period: PeriodKey;
  onChange: (p: PeriodKey) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto flex items-center bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-1">
      {PERIOD_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            period === t.key ? "bg-violet-500 text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function CustomRangeInputs({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <input
        type="date"
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5"
      />
      <span>〜</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onTo(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5"
      />
    </div>
  );
}

export function AccountChips({
  accounts,
  selected,
  onChange,
}: {
  accounts: AccountLite[];
  selected: string | "all";
  onChange: (id: string | "all") => void;
}) {
  const chipClass = (active: boolean) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
      active
        ? "bg-violet-100 border-violet-200 text-violet-700"
        : "bg-white border-gray-200 text-gray-600 hover:border-violet-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button onClick={() => onChange("all")} className={chipClass(selected === "all")}>
        すべて
      </button>
      {accounts.map((a) => (
        <button key={a.id} onClick={() => onChange(a.id)} className={chipClass(selected === a.id)}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
          {a.name}
        </button>
      ))}
    </div>
  );
}
