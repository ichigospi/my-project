// 期間タブ→日付範囲の変換。occurredOn は YYYY-MM-DD 文字列で比較する

export type PeriodKey = "all" | "week" | "month" | "lastMonth" | "custom";

export type DateRange = { from: string | null; to: string | null };

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeForPeriod(period: PeriodKey, now = new Date()): DateRange {
  switch (period) {
    case "week": {
      // 月曜始まり
      const d = new Date(now);
      const diff = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - diff);
      return { from: fmt(d), to: fmt(now) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now) };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    default:
      return { from: null, to: null };
  }
}

// 前期間（比較用）: 今週→先週、今月→先月、先月→先々月。全期間・カスタムは比較なし
export function previousRange(period: PeriodKey, now = new Date()): DateRange | null {
  switch (period) {
    case "week": {
      const d = new Date(now);
      const diff = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - diff);
      const prevEnd = new Date(d);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(d);
      prevStart.setDate(prevStart.getDate() - 7);
      return { from: fmt(prevStart), to: fmt(prevEnd) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return { from: fmt(first), to: fmt(last) };
    }
    default:
      return null;
  }
}

export function todayStr(): string {
  return fmt(new Date());
}
