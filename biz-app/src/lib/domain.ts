// ファネル段階・売上カテゴリ・流入媒体の共通定義

export const STAGES = [
  { key: "list_in", label: "リストイン" },
  { key: "free_apply", label: "無料鑑定申込" },
  { key: "free_sent", label: "無料鑑定送付" },
  { key: "paid_purchase", label: "有料鑑定" },
  { key: "upsell_purchase", label: "アップセル" },
  { key: "course_purchase", label: "講座" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const SOURCES = [
  { key: "threads", label: "スレッズ" },
  { key: "insta", label: "インスタ" },
  { key: "x", label: "X" },
  { key: "youtube", label: "YOUTUBE" },
  { key: "other", label: "その他" },
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];

export const SALE_CATEGORIES = [
  { key: "paid_reading", label: "有料鑑定" },
  { key: "upsell", label: "アップセル" },
  { key: "course", label: "講座" },
  { key: "repeat", label: "リピート" },
  { key: "launch", label: "ローンチ" },
  { key: "other", label: "その他" },
] as const;

export type SaleCategoryKey = (typeof SALE_CATEGORIES)[number]["key"];

// 売上カテゴリ→対応するファネル段階（売上登録時にイベントも同時起票する）
export const CATEGORY_TO_STAGE: Partial<Record<SaleCategoryKey, StageKey>> = {
  paid_reading: "paid_purchase",
  upsell: "upsell_purchase",
  course: "course_purchase",
};

export function sourceLabel(key: string): string {
  return SOURCES.find((s) => s.key === key)?.label ?? key;
}

export function categoryLabel(key: string): string {
  return SALE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
