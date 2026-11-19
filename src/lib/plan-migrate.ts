// 旧フロー（抽象ロジックの文章）で進めていた企画を、新フロー（カード設計表にカード＋伝えること）へ変換する。
// AIは使わず、抽象ロジック／骨組みの文章を読んで設計表に流し込む。
import type { CardPlan, CardSlot, CardPlanBackbone } from "./project-store";
import { extractDrawnCards, getCardMeaning, getCardImagery, CARD_NAMES } from "./tarot-draw";

export interface ParsedAbstractCard {
  index: number;
  name: string;
  orientation: "正位置" | "逆位置";
  role?: string;
  meaning?: string;
  highlight?: string;
  message?: string;
  flow?: string;
}
export interface ParsedAbstract { backbone?: CardPlanBackbone; cards: ParsedAbstractCard[] }

const strip = (s: string) => s.replace(/^[「『（(]+|[」』）)]+$/g, "").trim();

// 抽象ロジックの文章（## N枚目: カード名（向き）｜役割 ／ - 正統な意味: ／ - 絵柄の見せ場: ／ - 伝えること: ／ - 流れ:）を読む
export function parseAbstractLogic(text: string): ParsedAbstract {
  const out: ParsedAbstract = { cards: [] };
  if (!text?.trim()) return out;
  const theme = text.match(/メインテーマと主張[:：]\s*(.+)/)?.[1];
  const metaphor = text.match(/中心メタファー[:：]\s*(.+)/)?.[1];
  const promise = text.match(/(?:一本線|冒頭の約束)[:：]\s*(.+)/)?.[1];
  if (theme || metaphor || promise) {
    out.backbone = {
      theme: strip(theme || "").replace(/（.*?）$/, "").trim(),
      metaphor: strip((metaphor || "").match(/「([^」]+)」/)?.[1] || metaphor || "").replace(/（.*$/, "").trim(),
      promise: strip((promise || "").match(/「([^」]+)」/)?.[1] || promise || "").trim(),
    };
  }
  const sections = text.split(/\n(?=##\s*\d+枚目)/);
  for (const sec of sections) {
    const head = sec.match(/##\s*(\d+)枚目[:：]\s*([^（\n]+?)（(正位置|逆位置)）(?:[｜|]\s*([^\n]+))?/);
    if (!head) continue;
    const name = head[2].trim();
    if (!CARD_NAMES.includes(name)) continue;
    const get = (label: string) => strip((sec.match(new RegExp(`[-・]\\s*${label}[:：]\\s*([^\\n]+)`))?.[1] || ""));
    out.cards.push({
      index: Number(head[1]),
      name,
      orientation: head[3] as "正位置" | "逆位置",
      role: head[4]?.trim(),
      meaning: get("正統な意味"),
      highlight: get("絵柄の見せ場"),
      message: get("伝えること"),
      flow: get("流れ"),
    });
  }
  out.cards.sort((a, b) => a.index - b.index);
  return out;
}

// 設計表に、抽象ロジック（あれば）と骨組み（カードの保険）から、カードと伝えることを流し込む。
// 戻り値の filled が true なら全スロットに伝えることが入った＝抽象ロジックを消してよい
export function migratePlanToNewFlow(plan: CardPlan | null | undefined, abstractLogic: string | undefined, skeleton: string | undefined): { plan: CardPlan; filled: boolean; changed: boolean } | null {
  const parsed = parseAbstractLogic(abstractLogic || "");
  const skeletonCards = extractDrawnCards(skeleton || "");
  const cards = parsed.cards.length >= 3
    ? parsed.cards
    : skeletonCards.map((c, i) => ({ index: c.slot ?? i + 1, name: c.name, orientation: c.orientation } as ParsedAbstractCard));
  if (cards.length < 3) return null;

  // 設計表が無い場合は、カードの役割から設計表を起こす
  const baseSlots: CardSlot[] = plan?.slots?.length
    ? [...plan.slots]
    : cards.map((c, i) => ({
        role: c.role && /問題提起|深掘り|常識破壊|解決|未来/.test(c.role) ? (c.role.match(/問題提起|深掘り|常識破壊|解決|未来/)![0]) : (i < 5 ? ["問題提起", "深掘り", "常識破壊", "解決", "未来"][i] : "追加"),
        kind: i < 5 ? "core" : "extra",
        title: c.role || `${i + 1}枚目`, content: c.message || "", source: "旧・抽象ロジックから取り込み", reason: "",
      }));
  // 枚数が設計表より多ければ追加スロットを足す（骨組みでカードを足していた場合）
  while (baseSlots.length < cards.length) {
    const c = cards[baseSlots.length];
    baseSlots.push({ role: "追加", kind: "extra", title: c.role || `${baseSlots.length + 1}枚目`, content: c.message || "", source: "旧・抽象ロジックから取り込み", reason: "" });
  }
  let changed = false;
  const slots = baseSlots.map((sl, i) => {
    const c = cards[i];
    if (!c) return sl;
    const already = sl.card && sl.card.name === c.name && sl.card.orientation === c.orientation && sl.message;
    if (already) return sl;
    changed = true;
    return {
      ...sl,
      card: { name: c.name, orientation: c.orientation },
      meaning: c.meaning || getCardMeaning(c.name, c.orientation) || sl.meaning || "",
      imagery: sl.imagery || getCardImagery(c.name) || "",
      highlight: c.highlight || sl.highlight || "",
      message: c.message || sl.message || "",
      flow: c.flow || sl.flow || "",
    };
  });
  const backbone = parsed.backbone && (parsed.backbone.theme || parsed.backbone.metaphor || parsed.backbone.promise) ? parsed.backbone : plan?.backbone;
  if (backbone && JSON.stringify(backbone) !== JSON.stringify(plan?.backbone)) changed = true;
  const filled = slots.every((sl) => sl.card && sl.message && sl.message.trim());
  return {
    plan: { ...(plan || { updatedAt: "" }), slots, backbone, drawnAt: plan?.drawnAt || new Date().toISOString(), filledAt: filled ? (plan?.filledAt || new Date().toISOString()) : plan?.filledAt, updatedAt: new Date().toISOString() },
    filled, changed,
  };
}
