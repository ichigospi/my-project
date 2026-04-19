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
      // ─── 基本 6（手コキ / 手マン / フェラ / クンニ / パイズリ / オナニー）───
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
        key: "paizuri",
        label: "パイズリ",
        tags: "paizuri, titfuck, hetero, breasts, penis between breasts",
      },
      {
        key: "masturbation",
        label: "オナニー",
        tags: "masturbation, solo, female masturbation",
      },

      // ─── フェラ応用 5 ───
      {
        key: "fellatio_deepthroat",
        label: "フェラ（喉奥）",
        tags: "fellatio, deepthroat, saliva, tongue out, looking at viewer, pov, hetero",
      },
      {
        key: "fellatio_licking",
        label: "フェラ（ねっとり舐め）",
        tags: "fellatio, licking penis, tongue, saliva trail, glossy lips, hetero",
      },
      {
        key: "fellatio_irrumatio",
        label: "フェラ（イラマチオ）",
        tags: "fellatio, irrumatio, deepthroat, tears, rough sex, hetero",
      },
      {
        key: "fellatio_multiple",
        label: "フェラ（複数相手）",
        tags: "fellatio, multiple penises, 2boys, cum on face",
      },
      {
        key: "fellatio_paizuri",
        label: "フェラ+パイズリ",
        tags: "fellatio, paizuri, titfuck, cum on breasts, pov, hetero",
      },

      // ─── クンニ応用 5 ───
      {
        key: "cunnilingus_strong",
        label: "クンニ（しっかり）",
        tags: "cunnilingus, pussy, tongue, wet, pov, spread legs, hetero",
      },
      {
        key: "cunnilingus_clitoris",
        label: "クンニ（クリ重点）",
        tags: "cunnilingus, clitoris, sucking, trembling, ahegao, hetero",
      },
      {
        key: "cunnilingus_onback",
        label: "クンニ（仰向け）",
        tags: "cunnilingus, lying on back, legs up, pussy juice, hetero",
      },
      {
        key: "cunnilingus_gentle",
        label: "クンニ（優しく）",
        tags: "cunnilingus, gentle, blushing, hetero",
      },
      {
        key: "cunnilingus_forced",
        label: "クンニ（無理やり）",
        tags: "cunnilingus, forced, tears, restrained, hetero",
      },

      // ─── パイズリ応用 5 ───
      {
        key: "paizuri_strong",
        label: "パイズリ（強化）",
        tags: "paizuri, titfuck, breasts, cleavage, penis between breasts, pov, hetero",
      },
      {
        key: "reverse_paizuri",
        label: "逆パイズリ",
        tags: "reverse paizuri, looking back, ass visible, hetero",
      },
      {
        key: "paizuri_cum",
        label: "パイズリ（激しめ）",
        tags: "paizuri, cum on breasts, cumdrip, excessive cum, hetero",
      },
      {
        key: "naizuri",
        label: "ナイズリ（貧乳）",
        tags: "naizuri, flat chest, small breasts, penis on stomach, hetero",
      },
      {
        key: "paizuri_fellatio_combo",
        label: "パイズリ+フェラ同時",
        tags: "paizuri, fellatio, simultaneous paizuri fellatio, cum in mouth and on breasts, hetero",
      },

      // ─── 手コキ応用 5 ───
      {
        key: "handjob_strong",
        label: "手コキ（強化）",
        tags: "handjob, penis, hand on penis, precum, looking at viewer, hetero",
      },
      {
        key: "double_handjob",
        label: "両手コキ",
        tags: "double handjob, two hands on penis, hetero",
      },
      {
        key: "handjob_oiled",
        label: "ねっとり手コキ",
        tags: "handjob, oiled, glossy, slow, teasing, hetero",
      },
      {
        key: "handjob_fellatio_combo",
        label: "手コキ+フェラ",
        tags: "handjob, fellatio, blowjob and handjob, saliva, cum on hands, hetero",
      },
      {
        key: "footjob_handjob",
        label: "足コキ+手コキ",
        tags: "footjob, handjob, multiple penises",
      },

      // ─── 手マン応用 5 ───
      {
        key: "fingering_strong",
        label: "手マン（強化）",
        tags: "fingering, pussy, vaginal, two fingers, pussy juice, wet",
      },
      {
        key: "fingering_gspot",
        label: "手マン（激しめ・潮吹き）",
        tags: "fingering, g-spot, squirting, ahegao, trembling",
      },
      {
        key: "fingering_behind",
        label: "後ろから手マン",
        tags: "fingering, from behind, ass grab, bent over",
      },
      {
        key: "fingering_cunnilingus_combo",
        label: "クンニ+手マン",
        tags: "fingering, cunnilingus, oral and fingering, 69 position",
      },
      {
        key: "fingering_clit",
        label: "クリ+中を同時",
        tags: "fingering, clitoris, rubbing clitoris, double stimulation",
      },

      // ─── オナニー応用 5 ───
      {
        key: "masturbation_panties",
        label: "オナニー（パンティ越し）",
        tags: "masturbation, hand in panties, blush, looking at viewer, pov",
      },
      {
        key: "masturbation_vibrator",
        label: "オナニー（クリバイブ）",
        tags: "masturbation, vibrator, sex toy, clitoris, trembling, ahegao",
      },
      {
        key: "masturbation_dildo",
        label: "オナニー（ディルド）",
        tags: "masturbation, dildo, insertion, vaginal, pussy juice, spread legs",
      },
      {
        key: "masturbation_onback",
        label: "オナニー（仰向け2本指）",
        tags: "masturbation, fingering, two fingers, lying on back, legs up, drooling",
      },
      {
        key: "masturbation_breast",
        label: "おっぱいオナニー",
        tags: "masturbation, breast grab, nipple tweak, self grope, moaning",
      },

      // ─── 69 系（末尾に置く） ───
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

// ─────────────────────────────────────────────────────────────
// 表情プリセット（複数選択前提・目/口/赤面/幸せイキ/絶頂 等）
// 出典: meta-camp.net/nsfw-face-expression-prompts/
// ─────────────────────────────────────────────────────────────

export interface ExpressionCategorySeed {
  key: string;
  label: string;
  isNSFW: boolean;
  order: number;
  expressions: ExpressionSeed[];
}

export interface ExpressionSeed {
  key: string;
  label: string;
  tags: string;
}

export const EXPRESSION_CATEGORIES: ExpressionCategorySeed[] = [
  {
    key: "expr_eyes",
    label: "目",
    isNSFW: true,
    order: 10,
    expressions: [
      { key: "glassy_eyes", label: "トロトロ濡れ目", tags: "glassy eyes, watery eyes, wet eyes" },
      {
        key: "half_closed_eyes",
        label: "半開き・重たいまぶた",
        tags: "half-closed eyes, heavy-lidded eyes",
      },
      {
        key: "rolling_eyes",
        label: "白目・寄り目",
        tags: "rolling eyes, cross-eyed, uneven eyes, eyes rolled back",
      },
      {
        key: "dazed_eyes",
        label: "呆然・虚ろ",
        tags: "dazed eyes, unfocused eyes, vacant eyes, mindless eyes",
      },
      {
        key: "heart_eyes",
        label: "ハート瞳・星目",
        tags: "heart-shaped pupils, starry eyes, sparkling eyes",
      },
      {
        key: "pleading_eyes",
        label: "懇願目（viewer）",
        tags: "looking at viewer, pleading eyes, begging eyes",
      },
      {
        key: "tears_open_eyes",
        label: "涙を流しながら目開き",
        tags: "tears streaming down face, crying with eyes open",
      },
    ],
  },
  {
    key: "expr_mouth",
    label: "口・舌・よだれ",
    isNSFW: true,
    order: 20,
    expressions: [
      {
        key: "open_mouth",
        label: "口開き",
        tags: "open mouth, half-open mouth, gaping mouth",
      },
      {
        key: "tongue_out",
        label: "舌出し",
        tags: "tongue out, sticking out tongue, tongue hanging out",
      },
      {
        key: "drooling",
        label: "よだれ",
        tags: "drooling, saliva, drool on chin, string of saliva, excessive drool",
      },
      {
        key: "panting",
        label: "荒い息",
        tags: "heavy breathing, panting, open mouth panting",
      },
      {
        key: "o_mouth",
        label: "丸い口・トロ顔",
        tags: "round mouth, o mouth, :o",
      },
      {
        key: "ahegao_base",
        label: "アヘ顔・トロ顔",
        tags: "ahegao, torogao, fucked silly face",
      },
      {
        key: "biting_lip",
        label: "下唇噛み",
        tags: "upper teeth bite lower lip, biting lip",
      },
    ],
  },
  {
    key: "expr_lips_brows",
    label: "唇・眉",
    isNSFW: false,
    order: 30,
    expressions: [
      {
        key: "licking_lips",
        label: "唇舐め・うるうる唇",
        tags: "licking lips, glossy lips, plump lips",
      },
      {
        key: "furrowed_brows",
        label: "眉ひそめ",
        tags: "furrowed brows, raised eyebrows",
      },
    ],
  },
  {
    key: "expr_blush",
    label: "赤面",
    isNSFW: false,
    order: 40,
    expressions: [
      {
        key: "blush_basic",
        label: "基本赤面",
        tags: "blush, cheeks flushed, heavy blush",
      },
      {
        key: "blush_full",
        label: "鼻紅・耳まで・首まで",
        tags: "nose blush, full blush, from ears to neck",
      },
      {
        key: "blush_puffy_cheeks",
        label: "頰ぷくぷく",
        tags: "puffy cheeks, flushed cheeks",
      },
      {
        key: "aroused",
        label: "性的興奮・発情",
        tags: "sexual arousal, aroused, in heat, horny",
      },
      {
        key: "ecstasy",
        label: "恍惚・イキ顔",
        tags: "ecstasy, pleasure face, orgasm face",
      },
    ],
  },
  {
    key: "expr_tears_sweat",
    label: "涙・汗・体液",
    isNSFW: true,
    order: 50,
    expressions: [
      {
        key: "tears",
        label: "涙・泣き顔",
        tags: "tears, crying, teary eyes, sobbing",
      },
      {
        key: "sweat",
        label: "汗だく・テカり",
        tags: "sweat, sweatdrop, excessive sweat, glistening skin",
      },
      {
        key: "nose_blush_heavy",
        label: "鼻まで赤い濃い赤面",
        tags: "nose blush, full-face blush, heavy blush",
      },
      {
        key: "snot",
        label: "鼻水",
        tags: "snot, runny nose",
      },
      {
        key: "humiliation",
        label: "屈辱・恥辱",
        tags: "humiliation, shame, embarrassed, ashamed",
      },
    ],
  },
  {
    key: "expr_nsfw_overall",
    label: "NSFW 表情総合",
    isNSFW: true,
    order: 60,
    expressions: [
      {
        key: "mind_break",
        label: "アヘ・意識崩壊",
        tags: "ahegao, ohogao, torogao, fucked silly, mind break",
      },
      {
        key: "afterglow",
        label: "余韻・ヘロヘロ",
        tags: "afterglow, post-orgasm, after sex, exhausted",
      },
      {
        key: "pervert_craving",
        label: "変態・マゾ・渇望",
        tags: "pervert, masochist, nympho, craving cock",
      },
      {
        key: "frustrated_pleasure",
        label: "悔しがりながら感じる",
        tags: "frustrated, regrettable, conflicted pleasure",
      },
      {
        key: "naughty_seductive",
        label: "いやらしい・誘惑",
        tags: "naughty face, seductive, lewd smile",
      },
      {
        key: "hearts_tears",
        label: "ハート目・快楽の涙",
        tags: "hearts in eyes, heart pupils, pleasure tears",
      },
      {
        key: "trembling",
        label: "震え・ビクビク",
        tags: "trembling, shivering, body trembling",
      },
      {
        key: "shy_bashful",
        label: "恥ずかしがり・照れ",
        tags: "shy, bashful, embarrassed face",
      },
      {
        key: "looking_away",
        label: "目を逸らす・顔を覆う",
        tags: "looking away, hand on mouth, covering face",
      },
      {
        key: "coy_smile",
        label: "はにかみ笑い",
        tags: "coy smile, hand on cheek",
      },
      {
        key: "flustered",
        label: "慌て顔",
        tags: "sweatdrop, flustered",
      },
    ],
  },
  {
    key: "expr_happy_climax",
    label: "幸せイキ",
    isNSFW: true,
    order: 70,
    expressions: [
      {
        key: "smiling_base",
        label: "満面の笑み",
        tags: "smiling, grin, beaming smile, joyful smile, happy face",
      },
      {
        key: "laughing",
        label: "くすくす・にこにこ",
        tags: "laughing, giggling, chuckle",
      },
      {
        key: "blissful_smile",
        label: "至福の笑顔",
        tags: "blissful, ecstasy with smile, rapturous, overjoyed",
      },
      {
        key: "happy_tears",
        label: "幸せの涙・笑い泣き",
        tags: "happy tears, tears of joy, crying with smile, smiling through tears",
      },
      {
        key: "joy_euphoric",
        label: "歓喜・多幸感",
        tags: "joy, delight, euphoric, in bliss",
      },
      {
        key: "hearts_smile",
        label: "ハート目＋笑顔",
        tags: "hearts in eyes, heart pupils with smile",
      },
      {
        key: "joyful_ahegao",
        label: "幸せアヘ・トロ顔",
        tags: "joyful ahegao, smiling ahegao, happy ahegao, torogao with smile",
      },
      {
        key: "smile_drool",
        label: "笑顔でよだれ",
        tags: "happy tears, drooling, smiling with drool, joyful drooling",
      },
      {
        key: "smile_pleasure_tears",
        label: "泣き笑い快楽",
        tags: "tears streaming down smiling face, crying tears of pleasure while smiling",
      },
      {
        key: "drool_grin",
        label: "にこにこよだれ糸引き",
        tags: "excessive drool grin, drooling with happy expression, saliva trail from smiling mouth",
      },
      {
        key: "happy_sweat_blush",
        label: "汗だくの幸せ赤面",
        tags: "sweat happy blush, glistening sweat on joyful face",
      },
      {
        key: "open_mouth_smiling",
        label: "笑ったまま口開け",
        tags: "open mouth smiling, half-open mouth with grin",
      },
      {
        key: "tongue_out_smile",
        label: "舌出し笑顔",
        tags: "tongue out with smile, sticking out tongue happily",
      },
      {
        key: "beaming_drool",
        label: "満面の笑みでよだれ",
        tags: "drooling heavily while beaming, excessive saliva on joyful face",
      },
      {
        key: "o_mouth_smile",
        label: "丸口トロ顔+幸せ目",
        tags: "round mouth smiling, o-shaped mouth with happy eyes",
      },
      {
        key: "happy_nose_blush",
        label: "鼻まで赤い幸せ赤面",
        tags: "heavy blush with happy smile, nose blush on joyful face",
      },
      {
        key: "puffy_cheeks_joy_tears",
        label: "頰ぷくぷく+幸せ涙",
        tags: "puffy cheeks smiling, flushed cheeks with tears of joy",
      },
      {
        key: "sexual_bliss",
        label: "発情喜び",
        tags: "sexual bliss, aroused joy, in heat with smile",
      },
      {
        key: "ecstasy_smile",
        label: "快楽過多の笑顔",
        tags: "ecstasy smile, pleasure overload with grin",
      },
      {
        key: "afterglow_smile",
        label: "絶頂後ニコニコ余韻",
        tags: "afterglow with happy smile, post-orgasm bliss, satisfied joyful face",
      },
      {
        key: "sparkle_heart_smile",
        label: "キラキラ+ハート+笑顔",
        tags: "hearts around face, sparkling eyes with smile",
      },
      {
        key: "craving_joyful",
        label: "欲情渇望だけど幸せ",
        tags: "craving with joyful expression, nympho smile",
      },
      {
        key: "mindbreak_smile",
        label: "意識飛んでもニヤニヤ",
        tags: "mind break but happy, fucked silly with grin",
      },
      {
        key: "trembling_smile",
        label: "ビクビクしながら笑顔",
        tags: "trembling with joy, shivering in pleasure smiling",
      },
    ],
  },
  {
    key: "expr_climax",
    label: "絶頂",
    isNSFW: true,
    order: 80,
    expressions: [
      {
        key: "climax_basic",
        label: "絶頂・クライマックス",
        tags: "climax, orgasm, orgasm face",
      },
      {
        key: "climax_expression",
        label: "快楽頂点",
        tags: "climax expression, peaking pleasure, orgasmic expression",
      },
      {
        key: "multiple_orgasms",
        label: "連続絶頂",
        tags: "multiple orgasms, continuous climax",
      },
      {
        key: "forced_orgasm",
        label: "強制絶頂・強イキ",
        tags: "forced orgasm, reluctant climax",
      },
      {
        key: "mind_shattering_orgasm",
        label: "意識飛ぶ絶頂",
        tags: "mind-shattering orgasm, brain-melting climax",
      },
    ],
  },
  {
    key: "expr_trembling",
    label: "震え・痙攣",
    isNSFW: true,
    order: 90,
    expressions: [
      {
        key: "full_body_trembling",
        label: "全身震え",
        tags: "trembling, body trembling, full body shiver",
      },
      {
        key: "convulsing",
        label: "激しい痙攣",
        tags: "convulsing, muscle spasms, body convulsions",
      },
      {
        key: "quivering",
        label: "肩震え・微震え",
        tags: "trembling shoulders, quivering, quivering body",
      },
      {
        key: "weak_knees",
        label: "膝ガクガク",
        tags: "weak knees, knees buckling, legs shaking",
      },
      {
        key: "facial_twitching",
        label: "首振る・顔震え",
        tags: "head shaking, twitching, facial twitching",
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
