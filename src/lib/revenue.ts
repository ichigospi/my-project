// ===== 収益カレンダーツール（単体）共通ロジック =====

export type RevenueType = "income" | "expense";

export interface RevenueEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: RevenueType;
  amount: number; // 常に正の値
  label: string;
  category: string;
  memo: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export const QUICK_LABELS = ["売上", "報酬", "アフィリ", "コンサル", "物販", "経費", "広告費", "仕入"];

// ===== 日付ユーティリティ（すべてローカル時間のYYYY-MM-DD文字列で扱う） =====
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`,
  };
}

export function addMonths(year: number, month: number, diff: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + diff;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// 期間に含まれる日数（両端含む）
export function daysBetween(from: string, to: string): number {
  const diff = parseKey(to).getTime() - parseKey(from).getTime();
  return Math.floor(diff / 86400000) + 1;
}

export function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}年${m}月${d}日(${DOW[parseKey(key).getDay()]})`;
}

export function formatShortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}(${DOW[parseKey(key).getDay()]})`;
}

// ===== 金額ユーティリティ =====
// 入力された金額を正の整数に変換する（全角数字・カンマ・「円」を許容）。
// 数値として解釈できない場合は NaN を返す。
export function parseAmount(input: unknown): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(Math.abs(input)) : NaN;
  }
  if (typeof input !== "string") return NaN;
  const normalized = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9.]/g, "");
  if (!normalized) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(Math.abs(n)) : NaN;
}

export function yen(n: number): string {
  return `${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`;
}

export function signedAmount(e: RevenueEntry): number {
  return e.type === "expense" ? -e.amount : e.amount;
}

// カレンダーのマス目用に短縮表示（12,345 → 1.2万）
export function compactAmount(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}億`;
  if (abs >= 10000) {
    const man = abs / 10000;
    return `${sign}${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, "")}万`;
  }
  return `${sign}${abs.toLocaleString("ja-JP")}`;
}

// ===== 集計 =====
export interface Summary {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function summarize(entries: RevenueEntry[]): Summary {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === "expense") expense += e.amount;
    else income += e.amount;
  }
  return { income, expense, net: income - expense, count: entries.length };
}

// 日付ごとの合計（収入 - 支出）
export function netByDate(entries: RevenueEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.date, (map.get(e.date) || 0) + signedAmount(e));
  }
  return map;
}

// 日付ごとにグループ化（日付の降順）
export function groupByDate(entries: RevenueEntry[]): { date: string; entries: RevenueEntry[]; net: number }[] {
  const map = new Map<string, RevenueEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      entries: list,
      net: list.reduce((sum, e) => sum + signedAmount(e), 0),
    }));
}

// 月別の集計（YYYY-MM 昇順）
export function summarizeByMonth(entries: RevenueEntry[]): { month: string; summary: Summary }[] {
  const map = new Map<string, RevenueEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, list]) => ({ month, summary: summarize(list) }));
}

// 項目名（未入力ならカテゴリ、それも無ければ「未分類」）ごとの集計
export function summarizeByLabel(entries: RevenueEntry[]): { name: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const name = e.label.trim() || e.category.trim() || "未分類";
    const cur = map.get(name) || { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(name, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
}
