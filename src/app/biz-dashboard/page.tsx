"use client";

import { useMemo, useState } from "react";

// ===== モックデータ =====
// 実データ接続前の見た目確認用。数値は生の実績値のみ持ち、
// 率・単価はすべて画面側で導出する（実装時にDB値へ差し替えやすくするため）
type Metrics = {
  threads: number;
  insta: number;
  x: number;
  youtube: number;
  free: number; // 無料鑑定数
  paid: number; // 有料鑑定数
  paidRevenue: number; // 有料鑑定売上
  upsell: number; // アップセル数
  upsellRevenue: number; // アップセル売上
};

type PeriodKey = "all" | "week" | "month" | "lastMonth" | "custom";

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "全期間" },
  { key: "week", label: "今週" },
  { key: "month", label: "今月" },
  { key: "lastMonth", label: "先月" },
  { key: "custom", label: "カスタム" },
];

const ACCOUNTS = [
  { id: "a", name: "サンプルA", dot: "bg-violet-500" },
  { id: "b", name: "サンプルB", dot: "bg-pink-500" },
  { id: "c", name: "サンプルC", dot: "bg-blue-500" },
] as const;

type AccountId = (typeof ACCOUNTS)[number]["id"];

const MOCK: Record<AccountId, Record<Exclude<PeriodKey, "custom">, Metrics>> = {
  a: {
    all: { threads: 70, insta: 240, x: 280, youtube: 150, free: 665, paid: 70, paidRevenue: 3660000, upsell: 25, upsellRevenue: 385000 },
    week: { threads: 3, insta: 10, x: 12, youtube: 6, free: 28, paid: 3, paidRevenue: 155000, upsell: 1, upsellRevenue: 15000 },
    month: { threads: 8, insta: 26, x: 31, youtube: 16, free: 73, paid: 8, paidRevenue: 420000, upsell: 3, upsellRevenue: 46000 },
    lastMonth: { threads: 9, insta: 30, x: 34, youtube: 18, free: 81, paid: 9, paidRevenue: 470000, upsell: 3, upsellRevenue: 47000 },
  },
  b: {
    all: { threads: 45, insta: 152, x: 171, youtube: 96, free: 417, paid: 42, paidRevenue: 2195000, upsell: 14, upsellRevenue: 215000 },
    week: { threads: 2, insta: 6, x: 7, youtube: 4, free: 16, paid: 2, paidRevenue: 105000, upsell: 1, upsellRevenue: 16000 },
    month: { threads: 5, insta: 17, x: 19, youtube: 10, free: 45, paid: 4, paidRevenue: 210000, upsell: 1, upsellRevenue: 15000 },
    lastMonth: { threads: 6, insta: 19, x: 21, youtube: 12, free: 52, paid: 5, paidRevenue: 260000, upsell: 2, upsellRevenue: 31000 },
  },
  c: {
    all: { threads: 35, insta: 100, x: 110, youtube: 60, free: 274, paid: 26, paidRevenue: 1360000, upsell: 9, upsellRevenue: 138000 },
    week: { threads: 1, insta: 4, x: 5, youtube: 2, free: 11, paid: 1, paidRevenue: 52000, upsell: 0, upsellRevenue: 0 },
    month: { threads: 4, insta: 11, x: 12, youtube: 7, free: 30, paid: 3, paidRevenue: 157000, upsell: 1, upsellRevenue: 15000 },
    lastMonth: { threads: 4, insta: 12, x: 14, youtube: 7, free: 33, paid: 3, paidRevenue: 156000, upsell: 1, upsellRevenue: 16000 },
  },
};

// ===== 表示フォーマット =====
function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function num(n: number): string {
  return n.toLocaleString("ja-JP");
}

function pct(numer: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((numer / denom) * 100).toFixed(1)}%`;
}

// ===== アイコン =====
function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  moon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  chart: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  userPlus: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  gear: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  yen: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  swap: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  percent: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  dollar: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  trendUp: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  hands: "M7 11.5V14m0-2.5v-6a1.5 1.5 0 013 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11",
} as const;

// ===== カード部品 =====
function KpiCard({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-gray-500">{label}</div>
        <div className="mt-1.5 text-[26px] leading-tight font-bold text-gray-900 truncate">{value}</div>
        {sub && <div className="mt-1 text-sm text-gray-400">({sub})</div>}
      </div>
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
        <Icon d={icon} />
      </div>
    </div>
  );
}

export default function BizDashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [account, setAccount] = useState<AccountId | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const m = useMemo<Metrics>(() => {
    // カスタム期間はモックでは全期間と同じデータを返す
    const p: Exclude<PeriodKey, "custom"> = period === "custom" ? "all" : period;
    const ids: AccountId[] = account === "all" ? ACCOUNTS.map((a) => a.id) : [account];
    return ids.reduce<Metrics>(
      (acc, id) => {
        const d = MOCK[id][p];
        return {
          threads: acc.threads + d.threads,
          insta: acc.insta + d.insta,
          x: acc.x + d.x,
          youtube: acc.youtube + d.youtube,
          free: acc.free + d.free,
          paid: acc.paid + d.paid,
          paidRevenue: acc.paidRevenue + d.paidRevenue,
          upsell: acc.upsell + d.upsell,
          upsellRevenue: acc.upsellRevenue + d.upsellRevenue,
        };
      },
      { threads: 0, insta: 0, x: 0, youtube: 0, free: 0, paid: 0, paidRevenue: 0, upsell: 0, upsellRevenue: 0 }
    );
  }, [period, account]);

  const listIn = m.threads + m.insta + m.x + m.youtube;
  const sales = m.paidRevenue + m.upsellRevenue;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="min-h-screen flex bg-[#f5f6fa]">
      {/* サイドバー */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col text-white bg-gradient-to-b from-[#ab87f5] via-[#9a6ef2] to-[#8558ee]">
        <div className="p-6 flex items-center gap-2.5">
          <span className="text-amber-300">
            <Icon d={ICONS.moon} className="w-6 h-6" />
          </span>
          <h1 className="text-lg font-bold">占いビジネス管理</h1>
        </div>
        <nav className="px-4 space-y-1">
          <span className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-white/20">
            <Icon d={ICONS.chart} className="w-5 h-5 shrink-0" />
            ダッシュボード
          </span>
        </nav>
      </aside>

      {/* メイン */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto p-5 md:p-8 space-y-5">
          {/* ヘッダー */}
          <div className="flex flex-wrap items-center gap-3">
            {/* モバイルではサイドバーが隠れるためタイトル横にアイコンを出す */}
            <span className="md:hidden text-violet-500">
              <Icon d={ICONS.moon} className="w-6 h-6" />
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">ダッシュボード</h2>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
            >
              <Icon d={ICONS.refresh} className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              更新
            </button>
            <button
              onClick={() => alert("モック版のため未実装です")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-violet-600 text-sm font-medium transition-colors"
            >
              <Icon d={ICONS.userPlus} className="w-4 h-4" />
              アカウント追加
            </button>
            <button
              onClick={() => alert("モック版のため未実装です")}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
              title="設定"
            >
              <Icon d={ICONS.gear} className="w-5 h-5" />
            </button>

            {/* 期間フィルタ */}
            <div className="ml-auto max-w-full overflow-x-auto flex items-center bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-1">
              {PERIOD_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPeriod(t.key)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === t.key ? "bg-violet-500 text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* カスタム期間（モック: データは全期間と同じ） */}
          {period === "custom" && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5"
              />
              <span>〜</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          )}

          {/* アカウントフィルタ */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setAccount("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                account === "all"
                  ? "bg-violet-100 border-violet-200 text-violet-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-violet-200"
              }`}
            >
              すべて
            </button>
            {ACCOUNTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccount(a.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  account === a.id
                    ? "bg-violet-100 border-violet-200 text-violet-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-violet-200"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                {a.name}
              </button>
            ))}
          </div>

          {/* 売上 + リスト単価 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <div className="sm:col-span-2 xl:col-span-2 rounded-2xl p-6 text-white bg-gradient-to-br from-[#a566f0] to-[#7c3aed] shadow-[0_8px_24px_rgba(124,58,237,0.25)] flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/80">売上</div>
                <div className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">{yen(sales)}</div>
              </div>
              <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                <Icon d={ICONS.yen} className="w-8 h-8" />
              </div>
            </div>
            <KpiCard
              label="リスト単価"
              value={listIn === 0 ? "—" : yen(sales / listIn)}
              icon={ICONS.dollar}
              tint="bg-emerald-50 text-emerald-500"
            />
          </div>

          {/* リストイン数 + 媒体別 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="リストイン数" value={num(listIn)} icon={ICONS.users} tint="bg-violet-50 text-violet-500" />
            <KpiCard label="スレッズ" value={num(m.threads)} sub={pct(m.threads, listIn)} icon={ICONS.users} tint="bg-gray-100 text-gray-500" />
            <KpiCard label="インスタ" value={num(m.insta)} sub={pct(m.insta, listIn)} icon={ICONS.users} tint="bg-pink-50 text-pink-500" />
            <KpiCard label="X" value={num(m.x)} sub={pct(m.x, listIn)} icon={ICONS.users} tint="bg-gray-100 text-gray-600" />
            <KpiCard label="YOUTUBE" value={num(m.youtube)} sub={pct(m.youtube, listIn)} icon={ICONS.users} tint="bg-red-50 text-red-400" />
          </div>

          {/* 無料鑑定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="無料鑑定数" value={num(m.free)} icon={ICONS.eye} tint="bg-sky-50 text-sky-500" />
            <KpiCard label="無料鑑定移行率" value={pct(m.free, listIn)} icon={ICONS.swap} tint="bg-indigo-50 text-indigo-500" />
          </div>

          {/* 有料鑑定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
            <KpiCard label="有料鑑定数" value={num(m.paid)} icon={ICONS.card} tint="bg-amber-50 text-amber-500" />
            <KpiCard label="有料鑑定移行率" value={pct(m.paid, m.free)} icon={ICONS.percent} tint="bg-orange-50 text-orange-500" />
            <KpiCard
              label="有料鑑定 平均単価"
              value={m.paid === 0 ? "—" : yen(m.paidRevenue / m.paid)}
              icon={ICONS.dollar}
              tint="bg-emerald-50 text-emerald-500"
            />
          </div>

          {/* アップセル */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 pb-8">
            <KpiCard label="アップセル数" value={num(m.upsell)} icon={ICONS.trendUp} tint="bg-green-50 text-green-500" />
            <KpiCard label="アップセル率" value={pct(m.upsell, m.paid)} icon={ICONS.hands} tint="bg-rose-50 text-rose-400" />
            <KpiCard
              label="アップセル 平均単価"
              value={m.upsell === 0 ? "—" : yen(m.upsellRevenue / m.upsell)}
              icon={ICONS.tag}
              tint="bg-violet-50 text-violet-500"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
