// 台本ルール・ガイド（教育の型／技カタログ）のオーナー編集分。
// コード側の初期値（guide-content.ts / tarot-draw.ts のバンク）に、ここで保存した上書きを重ねて表示する。
// 保存先はサーバー（AppSetting: guide_overrides）。全端末で同じものが見える。
// ※ 技カタログの「文章全体」を編集しても、台本生成に使う抽選バンク本体は変わらない（表示・学習用の上書き）。

import type { EducationExample } from "./guide-content";

export interface EducationOverride {
  purpose?: string;
  place?: string;
  examples?: EducationExample[];
  points?: string[];
  memo?: string;             // 解説メモ（オーナーが手入力／指示で追記）
  hiddenItems?: string[];    // この教育のデッキから外した技（itemKey）
}
export interface ItemOverride {
  text?: string;             // 文章全体（表示用の上書き）
  place?: string;            // どこで使うか
  eduIds?: string[];         // この技がしている教育（上書き。指定した教育のデッキにも表示される）
  memo?: string;             // 解説メモ
}
export interface StructureOverride {
  goal?: string;
  viewer?: string[];
  flow?: { title: string; desc: string }[];
  points?: string[];
  memo?: string;
}
export interface GuideOverrides {
  education: Record<string, EducationOverride>;
  items: Record<string, ItemOverride>;
  structure?: Record<string, StructureOverride>;   // key: StructureBlock.id
  updatedAt?: string;
}

export const EMPTY_OVERRIDES: GuideOverrides = { education: {}, items: {}, structure: {} };

// 技カタログ項目の安定キー（本文のハッシュ。文面が変わると別キーになる）
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export function itemKey(bankId: string, itemText: string): string {
  return `${bankId}:${djb2(itemText)}`;
}

// 技カタログ項目の見出し。【◯◯型】があればそれ。【汎用】【恋愛】のような短い分類タグだけの場合は、タグ＋本文の先頭を使う
const GENERIC_TAG = /^(汎用|恋愛|金運|恋愛・出会い|恋愛・復縁|仕事|人間関係|総合)$/;
export function techTitle(item: string): string {
  const m = item.match(/^\s*【([^】]{1,24})】\s*([\s\S]*)$/);
  if (m) {
    const tag = m[1];
    const rest = m[2].replace(/\s+/g, " ").trim();
    if (GENERIC_TAG.test(tag) && rest) return `${tag}｜${rest.slice(0, 14)}${rest.length > 14 ? "…" : ""}`;
    return tag;
  }
  const anywhere = item.match(/【([^】]{1,24})】/);
  if (anywhere && !GENERIC_TAG.test(anywhere[1])) return anywhere[1];
  const t = item.replace(/^[「『]/, "").replace(/\s+/g, " ").trim();
  return t.length > 18 ? t.slice(0, 18) + "…" : t;
}

export async function fetchGuideOverrides(): Promise<GuideOverrides> {
  try {
    const res = await fetch("/api/guide-overrides", { cache: "no-store" });
    const d = await res.json();
    if (!res.ok || !d || typeof d !== "object") return EMPTY_OVERRIDES;
    const o = (d.overrides || {}) as Partial<GuideOverrides>;
    return { education: o.education || {}, items: o.items || {}, structure: o.structure || {}, updatedAt: o.updatedAt };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

export async function saveGuideOverrides(next: GuideOverrides): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/guide-overrides", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: { ...next, updatedAt: new Date().toISOString() } }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d as { error?: string }).error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
