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
      {
        key: "handjob",
        label: "手コキ",
        tags: "handjob, hetero, girl holding penis, stroking, erect penis",
      },
      {
        key: "fingering",
        label: "手マン",
        tags: "fingering, fingers in pussy, spread pussy, pussy juice",
      },
      {
        key: "fellatio",
        label: "フェラ",
        tags: "fellatio, oral sex, hetero, penis in mouth, girl sucking penis",
      },
      {
        key: "cunnilingus",
        label: "クンニ",
        tags: "cunnilingus, oral sex, hetero, man licking pussy, spread legs",
      },
      {
        key: "sixtynine",
        label: "シックスナイン",
        tags: "69, sixtynine, mutual oral, hetero, fellatio, cunnilingus, upside down, penis in mouth, tongue out",
      },
      {
        key: "standing_69",
        label: "立ち69",
        tags: "69, standing 69, mutual oral, hetero, fellatio, cunnilingus, upside down, carried, penis in mouth, tongue out, legs wrapped",
      },
    ],
  },
  {
    key: "nsfw_sex",
    label: "体位・挿入",
    isNSFW: true,
    order: 40,
    actions: [
      // ─── 正常位系 ───
      {
        key: "missionary",
        label: "正常位",
        tags: "missionary, hetero, vaginal, penis in pussy, lying on back, spread legs, face up, girl on back, man on top, between her legs, face-to-face",
      },
      {
        key: "missionary_deep",
        label: "正常位（深め）",
        tags: "missionary, deep penetration, hetero, vaginal, penis in pussy, legs on shoulders, folded, blush, open mouth, girl on back, man on top",
      },
      {
        key: "missionary_leg_lock",
        label: "正常位（脚ロック）",
        tags: "missionary, leg lock, hetero, vaginal, penis in pussy, lying on back, arms around neck, hug, deep penetration, girl on back, man on top",
      },
      {
        key: "mating_press",
        label: "種付けプレス",
        tags: "missionary, mating press, folded, legs up, hetero, vaginal, deep penetration, penis in pussy, blush, open mouth, sweat, girl on back, man on top, leaning forward",
      },
      {
        key: "standing_missionary",
        label: "立ち正常位",
        tags: "standing missionary, standing sex, face to face, hetero, vaginal, legs wrapped around waist, deep penetration, penis in pussy, wall, lifted, girl lifted, man standing",
      },
      {
        key: "desk_missionary",
        label: "机の上正常位",
        tags: "missionary, on table, lying on back, legs spread, hetero, vaginal, penis in pussy, desk sex, girl on back, man standing",
      },
      {
        key: "kissing_sex",
        label: "キスハメ",
        tags: "kissing, french kiss, hetero, sex, vaginal, penis in pussy, missionary, face-to-face, girl on back, man on top",
      },

      // ─── バック系 ───
      {
        key: "doggystyle",
        label: "バック",
        tags: "doggystyle, sex from behind, hetero, vaginal, bent over, ass up, penis in pussy, arched back, girl on all fours, man behind, kneeling behind",
      },
      {
        key: "doggystyle_high",
        label: "バック（尻高め）",
        tags: "doggystyle, sex from behind, hetero, vaginal, ass up high, arched back, penis in pussy, bent over, from behind, ass focus, girl on all fours, man behind",
      },
      {
        key: "standing_sex",
        label: "立ちバック",
        tags: "standing doggystyle, standing sex, from behind, hetero, vaginal, bent over, wall, penis in pussy, girl bent over, man standing behind",
      },
      {
        key: "prone_bone",
        label: "寝バック（うつ伏せ）",
        tags: "prone bone, prone position, sex from behind, hetero, vaginal, lying face down, ass up, penis in pussy, girl lying face down, man on top behind",
      },

      // ─── 騎乗位系 ───
      {
        key: "cowgirl",
        label: "騎乗位",
        tags: "cowgirl position, girl on top, hetero, vaginal, straddling, bouncing, penis in pussy, man lying on back, face-to-face",
      },
      {
        key: "cowgirl_intense",
        label: "騎乗位（激しい）",
        tags: "cowgirl position, squatting cowgirl, hetero, vaginal, bouncing breasts, intense, sweat, penis in pussy, girl on top, man lying on back",
      },
      {
        key: "cowgirl_ahegao",
        label: "騎乗位（アヘ顔）",
        tags: "cowgirl position, girl on top, hetero, vaginal, straddling, bouncing breasts, ahegao, tongue out, rolling eyes, sweat, intense, penis in pussy, man lying on back",
      },
      {
        key: "reverse_cowgirl",
        label: "背面騎乗位",
        tags: "reverse cowgirl, girl on top, hetero, vaginal, facing away, ass focus, penis in pussy, bouncing, man lying on back",
      },

      // ─── 座位系 ───
      {
        key: "face_to_face",
        label: "対面座位",
        tags: "lotus position, sitting, face to face, hetero, vaginal, straddling, hug, penis in pussy, arms around neck, legs wrapped around waist, girl on lap, man sitting, kiss",
      },
      {
        key: "reverse_sitting",
        label: "背面座位",
        tags: "reverse upright straddle, reverse cowgirl, sitting, facing away, hetero, vaginal, ass focus, penis in pussy, bouncing breasts, arched back, girl on lap, man sitting",
      },

      // ─── 抱き上げ系 ───
      {
        key: "carry_fuck",
        label: "駅弁",
        tags: "suspended congress, standing missionary, held up, carrying, hetero, vaginal, legs wrapped around waist, deep penetration, penis in pussy, arms around neck, girl held up, man standing",
      },
      {
        key: "reverse_carry",
        label: "背面駅弁",
        tags: "reverse suspended congress, hetero, vaginal, standing, deep penetration, pussy focus, bouncing breasts, holding legs, m legs, back carry, girl held up, man standing behind",
      },

      // ─── 横向き系 ───
      {
        key: "spooning",
        label: "スプーン（横寝バック）",
        tags: "spooning, lying on side, sex from behind, hetero, vaginal, penis in pussy, hug, from side, leg up, intimate",
      },
      {
        key: "sideways_missionary",
        label: "松葉崩し（横）",
        tags: "sideways missionary, spooning, hetero, vaginal, lying on side, penis in pussy, leg up, from side",
      },

      // ─── アクロバティック系 ───
      {
        key: "piledriver",
        label: "パイルドライバー",
        tags: "piledriver position, upside down, legs up, hetero, vaginal, deep penetration, penis in pussy, flexible, girl upside down, man on top",
      },
      {
        key: "piledriver_deep",
        label: "パイルドライバー（逆さ深め）",
        tags: "piledriver position, upside down, legs folded back, hetero, vaginal, deep penetration, penis in pussy, flexible, blush, ahegao, girl upside down",
      },
      {
        key: "full_nelson",
        label: "フルネルソン",
        tags: "full nelson, held up, from behind, hetero, vaginal, arms held, legs spread, penis in pussy, girl restrained, man behind",
      },

      // ─── その他 ───
      {
        key: "penetration_closeup",
        label: "挿入クローズアップ",
        tags: "close-up, penis in pussy, vaginal, hetero, penetration, pussy juice, cum, detailed pussy, spread legs",
      },
      {
        key: "anal_doggy",
        label: "アナル（バック）",
        tags: "doggystyle, anal, sex from behind, hetero, penis in anus, ass focus, arched back, bent over, anal penetration, girl on all fours, man behind",
      },
    ],
  },
  {
    key: "nsfw_other",
    label: "その他",
    isNSFW: true,
    order: 50,
    actions: [
      {
        key: "after_sex",
        label: "事後",
        tags: "after sex, afterglow, cum, post-sex, satisfied expression",
      },
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
