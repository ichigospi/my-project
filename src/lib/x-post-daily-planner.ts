// デイリープランのスロット構造を算出するロジック（サーバ専用）
// AIに渡す前の「どの教育タイプを何スロット目に置くか」を決める

import type {
  EducationType,
  DailyPlanSlot,
  EducationFrequencyConfig,
  ConnectionType,
} from "./x-post-types";

interface RecentPostsByEducation {
  // 教育タイプごとに、最後にポストされた日（YYYY-MM-DD）
  // ポストがなければ null
  [type: string]: string | null;
}

interface Options {
  postsPerDay: number;
  educationConfig: EducationFrequencyConfig;
  recentPostsByEducation: RecentPostsByEducation;
  todayDate: string; // YYYY-MM-DD
}

// 「教育タイプごとに何日経ったか」を計算
function daysSince(targetDate: string | null, today: string): number {
  if (!targetDate) return Number.MAX_SAFE_INTEGER; // 一度も投稿してなければ無限
  const t = new Date(today + "T00:00:00");
  const d = new Date(targetDate.slice(0, 10) + "T00:00:00");
  const diff = Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// スロット構造を算出
export function buildSlotStructure(opts: Options): DailyPlanSlot[] {
  const { postsPerDay, educationConfig, recentPostsByEducation, todayDate } = opts;
  const minPerDays = educationConfig.minPerDays;

  // 各教育タイプが「期限切れ」かを判定
  // expired = ( 最後の投稿からの日数 >= minPerDays )
  const expiry: { type: EducationType; daysSinceLast: number; minPerDays: number; isExpired: boolean }[] =
    Object.entries(minPerDays).map(([type, min]) => {
      const last = recentPostsByEducation[type] ?? null;
      const days = daysSince(last, todayDate);
      const minRequired = min ?? Number.MAX_SAFE_INTEGER;
      return { type: type as EducationType, daysSinceLast: days, minPerDays: minRequired, isExpired: days >= minRequired };
    });

  // 期限切れ度合いが高い順にソート
  // ratio = daysSinceLast / minPerDays （大きいほど不足）
  const expiredSorted = [...expiry]
    .filter((e) => e.isExpired)
    .sort((a, b) => (b.daysSinceLast / b.minPerDays) - (a.daysSinceLast / a.minPerDays));

  // 「目的の教育」を Slot 1 に必須で入れる（毎日ポストする教材ルール）
  const slots: DailyPlanSlot[] = [];
  const usedTypes = new Set<EducationType>();

  const purposeRequired: EducationType = "目的";
  slots.push(makeSlot(1, purposeRequired));
  usedTypes.add(purposeRequired);

  // Slot 2 以降に期限切れの教育タイプを入れていく（重複しないように）
  for (const e of expiredSorted) {
    if (slots.length >= postsPerDay) break;
    if (usedTypes.has(e.type)) continue;
    slots.push(makeSlot(slots.length + 1, e.type));
    usedTypes.add(e.type);
  }

  // まだスロットが余っていれば、残りの教育タイプから直近頻度が低い順に埋める
  const remaining = expiry
    .filter((e) => !usedTypes.has(e.type))
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast);

  for (const e of remaining) {
    if (slots.length >= postsPerDay) break;
    slots.push(makeSlot(slots.length + 1, e.type));
    usedTypes.add(e.type);
  }

  // それでも足りなければ「目的」をもう1個入れて埋める
  while (slots.length < postsPerDay) {
    slots.push(makeSlot(slots.length + 1, purposeRequired));
  }

  return slots;
}

function makeSlot(slotNum: number, educationType: EducationType, connectionType: ConnectionType | "" = ""): DailyPlanSlot {
  return {
    slot: slotNum,
    educationType,
    theme: "",
    reasoning: "",
    hookType: "",
    connectionType: slotNum === 1 ? "consecutive" : connectionType,
    status: "draft",
  };
}

// シンプルな引用RT接続の自動付与: 連続する2スロットがあれば一定確率で「引用RT」にする
export function applyConnectionRandomization(
  slots: DailyPlanSlot[],
  rates: { quoteRtRate: number; consecutiveRate: number; independentRate: number; storyChainRate: number },
): DailyPlanSlot[] {
  const total = rates.quoteRtRate + rates.consecutiveRate + rates.independentRate + rates.storyChainRate;
  if (total <= 0) return slots;
  return slots.map((s, i) => {
    if (i === slots.length - 1) return { ...s, connectionType: "" };
    const r = Math.random() * total;
    let cum = 0;
    cum += rates.quoteRtRate;
    if (r < cum) return { ...s, connectionType: "quote_rt" };
    cum += rates.consecutiveRate;
    if (r < cum) return { ...s, connectionType: "consecutive" };
    cum += rates.independentRate;
    if (r < cum) return { ...s, connectionType: "independent" };
    return { ...s, connectionType: "story_chain" };
  });
}
