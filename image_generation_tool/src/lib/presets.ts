// ビルトインのプリセット定義。
// DB シードと、UI の初期表示で共有して使う。

export interface ViewAngleSeed {
  key: string;
  label: string;
  tags: string;
  category: "pov" | "angle" | "shot";
  order: number;
}

export const VIEW_ANGLE_PRESETS: ViewAngleSeed[] = [
  { key: "female_pov", label: "女性視点", tags: "pov, female pov", category: "pov", order: 10 },
  { key: "male_pov", label: "男性視点", tags: "pov, male pov", category: "pov", order: 20 },
  { key: "third_person", label: "第三者視点", tags: "third-person view", category: "pov", order: 30 },
  { key: "from_above", label: "天井から", tags: "from above, overhead shot", category: "angle", order: 40 },
  { key: "from_front", label: "前から", tags: "from front", category: "angle", order: 50 },
  { key: "from_side", label: "横から", tags: "from side, profile view", category: "angle", order: 60 },
  { key: "from_behind", label: "後ろから", tags: "from behind", category: "angle", order: 70 },
  { key: "from_below", label: "下から", tags: "from below, low angle", category: "angle", order: 80 },
  { key: "full_body", label: "全身", tags: "full body", category: "shot", order: 90 },
  { key: "upper_body", label: "上半身", tags: "upper body, cowboy shot", category: "shot", order: 100 },
  { key: "lower_body", label: "下半身", tags: "lower body", category: "shot", order: 110 },
  { key: "close_up", label: "顔ドアップ", tags: "close-up, face focus, portrait", category: "shot", order: 120 },
];

export interface TimePresetSeed {
  key: string;
  label: string;
  tags: string;
  category: "time" | "season" | "weather";
  order: number;
}

export const TIME_PRESETS: TimePresetSeed[] = [
  { key: "morning", label: "朝", tags: "morning, sunrise", category: "time", order: 10 },
  { key: "noon", label: "昼", tags: "daytime, noon", category: "time", order: 20 },
  { key: "evening", label: "夕方", tags: "evening, sunset, orange sky", category: "time", order: 30 },
  { key: "night", label: "夜", tags: "night, moonlight", category: "time", order: 40 },
  { key: "midnight", label: "深夜", tags: "midnight, dark", category: "time", order: 50 },
  { key: "spring", label: "春", tags: "spring, cherry blossoms", category: "season", order: 60 },
  { key: "summer", label: "夏", tags: "summer, bright sunlight", category: "season", order: 70 },
  { key: "autumn", label: "秋", tags: "autumn, falling leaves", category: "season", order: 80 },
  { key: "winter", label: "冬", tags: "winter, snow", category: "season", order: 90 },
];

export interface ClothingSeed {
  key: string;
  label: string;
  tags: string;
  category: string;
  order: number;
  isNude?: boolean;
}

export const CLOTHING_PRESETS: ClothingSeed[] = [
  { key: "uniform", label: "制服", tags: "school uniform, blazer", category: "uniform", order: 10 },
  { key: "casual", label: "カジュアル", tags: "casual clothes, t-shirt, jeans", category: "casual", order: 20 },
  { key: "dress", label: "ドレス", tags: "dress, elegant", category: "formal", order: 30 },
  { key: "suit", label: "スーツ", tags: "business suit", category: "formal", order: 40 },
  { key: "swimwear", label: "水着", tags: "swimsuit, bikini", category: "swimwear", order: 50 },
  { key: "underwear", label: "下着", tags: "underwear, bra, panties", category: "underwear", order: 60 },
  { key: "topless", label: "上半身裸", tags: "topless", category: "partial_nude", order: 70, isNude: true },
  { key: "bottomless", label: "下半身裸", tags: "bottomless", category: "partial_nude", order: 80, isNude: true },
  { key: "nude", label: "全裸", tags: "completely nude, nude", category: "nude", order: 90, isNude: true },
];

export interface HairstyleSeed {
  key: string;
  label: string;
  tags: string;
  category: string;
  order: number;
}

export const HAIRSTYLE_PRESETS: HairstyleSeed[] = [
  { key: "short", label: "ショート", tags: "short hair", category: "length", order: 10 },
  { key: "bob", label: "ボブ", tags: "bob cut", category: "length", order: 20 },
  { key: "medium", label: "セミロング", tags: "medium hair", category: "length", order: 30 },
  { key: "long", label: "ロング", tags: "long hair", category: "length", order: 40 },
  { key: "ponytail", label: "ポニーテール", tags: "ponytail", category: "style", order: 50 },
  { key: "twintails", label: "ツインテール", tags: "twintails", category: "style", order: 60 },
  { key: "straight", label: "ストレート", tags: "straight hair", category: "style", order: 70 },
  { key: "wavy", label: "ウェーブ", tags: "wavy hair", category: "style", order: 80 },
];

export interface ActionCategorySeed {
  key: string;
  label: string;
  isNSFW: boolean;
  order: number;
  actions: ActionSeed[];
}

export interface ActionSeed {
  key: string;
  label: string;
  tags: string;
  defaultCondom?: "with" | "without" | "none";
}

export const ACTION_CATEGORIES: ActionCategorySeed[] = [
  {
    key: "sfw_daily",
    label: "日常動作",
    isNSFW: false,
    order: 10,
    actions: [
      { key: "standing", label: "立ちポーズ", tags: "standing" },
      { key: "sitting", label: "座る", tags: "sitting" },
      { key: "walking", label: "歩く", tags: "walking" },
      { key: "running", label: "走る", tags: "running" },
      { key: "smile", label: "笑顔", tags: "smile, happy" },
      { key: "crying", label: "泣く", tags: "crying, tears" },
      { key: "sleeping", label: "寝る", tags: "sleeping, closed eyes" },
      { key: "eating", label: "食べる", tags: "eating" },
    ],
  },
  {
    key: "sfw_affection",
    label: "SFW 触れ合い",
    isNSFW: false,
    order: 20,
    actions: [
      { key: "kiss", label: "キス", tags: "kissing, french kiss" },
      { key: "hug", label: "ハグ", tags: "hugging, embrace" },
      { key: "hand_holding", label: "手を繋ぐ", tags: "holding hands" },
      { key: "headpat", label: "頭なで", tags: "head pat" },
    ],
  },
  {
    key: "nsfw_foreplay",
    label: "前戯",
    isNSFW: true,
    order: 30,
    actions: [
      { key: "handjob", label: "手コキ", tags: "handjob, penis grab, stroking" },
      { key: "fingering", label: "手マン", tags: "fingering, pussy juice, spread pussy" },
      { key: "fellatio", label: "フェラ", tags: "fellatio, oral sex, penis in mouth" },
      { key: "cunnilingus", label: "クンニ", tags: "cunnilingus, oral sex, licking pussy" },
      { key: "sixtynine", label: "シックスナイン", tags: "69, sixtynine, oral sex" },
    ],
  },
  {
    key: "nsfw_sex",
    label: "体位・挿入",
    isNSFW: true,
    order: 40,
    actions: [
      {
        key: "missionary",
        // 正常位: 女性が仰向けを強制（うつ伏せ誤生成の防止）
        label: "正常位",
        tags: "missionary, sex, vaginal, penetration, lying on back, spread legs, face up",
      },
      {
        key: "doggystyle",
        // バック: 四つん這いを強制
        label: "バック",
        tags: "doggystyle, sex from behind, vaginal, penetration, all fours, on all fours",
      },
      {
        key: "standing_sex",
        label: "立ちバック",
        tags: "standing sex, sex from behind, bent over, vaginal, penetration",
      },
      {
        key: "mating_press",
        label: "種付けプレス",
        tags: "mating press, missionary, sex, vaginal, penetration, legs up, folded legs",
      },
      {
        key: "cowgirl",
        label: "騎乗位",
        tags: "cowgirl position, girl on top, straddling, sex, vaginal, penetration",
      },
      {
        key: "carry_fuck",
        label: "駅弁",
        tags: "carry fuck, suspended congress, standing, sex, held up, vaginal, penetration",
      },
      {
        key: "face_to_face",
        label: "対面座位",
        tags: "sitting sex, face-to-face, sitting on lap, sex, vaginal, penetration",
      },
      {
        key: "kissing_sex",
        label: "キスハメ",
        tags: "kissing, sex, french kiss, missionary, face-to-face, vaginal, penetration",
      },
    ],
  },
  {
    key: "nsfw_other",
    label: "その他",
    isNSFW: true,
    order: 50,
    actions: [
      { key: "after_sex", label: "事後", tags: "after sex, afterglow, cum, post-sex" },
    ],
  },
];

export interface BodyPartTypeSeed {
  key: string;
  label: string;
}

export const BODY_PART_TYPES: BodyPartTypeSeed[] = [
  { key: "face", label: "顔" },
  { key: "hair", label: "髪型" },
  { key: "eyes", label: "目" },
  { key: "lips", label: "唇" },
  { key: "breasts", label: "胸と乳輪" },
  { key: "fgenitals", label: "女性器" },
  { key: "mgenitals", label: "男性器" },
];

// 身長 → タグ自動マッピング（設定画面で編集可能にする想定）
export interface HeightTagRange {
  maxCm: number; // 以下（なら true）
  tags: string;
}

export const HEIGHT_TAG_RANGES: HeightTagRange[] = [
  { maxCm: 145, tags: "petite, very short" },
  { maxCm: 155, tags: "short" },
  { maxCm: 165, tags: "average height" },
  { maxCm: 172, tags: "tall" },
  { maxCm: 999, tags: "very tall" },
];

export function heightCmToTags(cm: number): string {
  for (const range of HEIGHT_TAG_RANGES) {
    if (cm <= range.maxCm) return range.tags;
  }
  return "";
}

// ゴム有無
export type CondomState = "with" | "without" | "none";

export const CONDOM_OPTIONS: Array<{ value: CondomState; label: string; tags: string; negative?: string }> = [
  { value: "none", label: "指定なし", tags: "" },
  { value: "with", label: "ゴムあり", tags: "condom, wearing condom" },
  { value: "without", label: "ゴムなし", tags: "bareback, no condom", negative: "condom" },
];
