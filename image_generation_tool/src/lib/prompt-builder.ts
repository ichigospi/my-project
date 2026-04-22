// 6W1H の選択状態からプロンプト文字列を組み立てる。
//
// SDXL / Illustrious は先頭トークンほど強く効くので、
//   1. キャラ Lora のトリガーワード群（char_xxx_v1 等）← 最重要
//   2. 絵柄 Lora のトリガーワード群 + スタイル形容詞
//   3. アングル・時間・場所（画面のマクロ要素）
//   4. キャラ情報（身長・服装・表情・陰毛・キャラ固有追加）
//   5. 行為（動詞的タグ群）
//   6. ゴム・ユーザー追加・品質タグ
// の順で並べる。
//
// 2 人以上キャラが選択された場合は BREAK 区切りで各キャラのブロックに
// 服装・表情・追加プロンプトを分離する（Regional Prompter 未対応のため
// 完全な属性分離はできないが、単一プロンプト連結よりは混線が減る）。
//
// 重複タグ除去: セクション内で完全一致するタグを後勝ちで削除。
// プリセット同士や extraPrompt とのかぶりで「同じタグが何度も出る」
// 現象を防ぐ（モデルの注意を無駄に割かせないため）。

import { heightCmToTags, type CondomState, CONDOM_OPTIONS } from "./presets";

// キャラの最低限の情報（UI からも参照できるよう lib に置く）
export interface CharacterLite {
  id: string;
  name: string;
  gender: string;
  heightCm: number;
  triggerWord: string | null;
  loraUrl: string | null;
  loraScale: number;
  extraPrompt: string | null;
  defaultOutfitId: string | null;
  pubicHair: string | null; // "none" | "light" | "normal" | "thick" | null
  /** IP-Adapter の顔参照としてマークされている ReferenceImage の枚数。0 の場合は顔参照できない。 */
  faceRefCount?: number;
}

// 陰毛の状態 → プロンプトタグ変換
const PUBIC_HAIR_TAGS: Record<string, string> = {
  none: "shaved, no pubic hair",
  light: "sparse pubic hair, thin pubic hair",
  normal: "pubic hair, trimmed pubic hair",
  thick: "thick pubic hair, bushy pubic hair",
};

// キャラごとの選択（格好・表情）
export interface CharacterSelection {
  outfit?: { tags: string; isNude?: boolean };
  expressionTags?: string[];
}

export interface PromptSelection {
  timeTags?: string;
  // 主体順に並ぶ（1人目が主体）
  characters: CharacterLite[];
  // キャラ ID → そのキャラ固有の選択（未指定キャラはデフォルト動作）
  perCharacter?: Record<string, CharacterSelection>;
  // キャラ未選択時のグローバルフォールバック
  globalOutfit?: { tags: string; isNude?: boolean };
  globalExpressionTags?: string[];
  location?: { tags: string; name?: string };
  angle?: { tags: string };
  action?: { tags: string; isNSFW?: boolean };
  condom: CondomState;
  artStyleTags?: string;
  extraPromptTokens?: string;
  includeBodyTagsAlways?: boolean;
}

// Illustrious / WAI-illustrious で効きが良い品質タグ
const QUALITY_TAGS =
  "masterpiece, best quality, amazing quality, very aesthetic, newest, absurdres, ultra detailed, detailed body, detailed anatomy";

// 崩壊対策を全面強化したデフォルトネガティブ（Illustrious / WAI-illustrious 想定）。
// Pony/Illustrious 系は重み付き `(xxx:1.2)` と category 毎の列挙が効く。
// 分類:
//   1. 画質全般
//   2. 人体全体の破綻
//   3. 手指・四肢・足
//   4. 顔・目
//   5. 胸・乳首
//   6. 性器（NSFW 用途で崩れやすい）
//   7. 重複・分裂
//   8. 画像のアーティファクト（透かし・テキスト等）
//   9. 未完成・簡素化（SDXL が手抜きしないように）
const DEFAULT_NEGATIVE = [
  // 画質全般
  "(worst quality:1.4)",
  "(low quality:1.3)",
  "(lowres:1.1)",
  "normal quality",
  "jpeg artifacts",
  "compression artifacts",
  "blurry",
  "out of focus",
  "depth of field",
  "chromatic aberration",
  "noise",
  "grainy",
  // 人体全体
  "bad anatomy",
  "(bad proportions:1.2)",
  "wrong proportions",
  "distorted body",
  "twisted body",
  "unnatural body",
  "bad perspective",
  "(deformed:1.1)",
  "(malformed:1.1)",
  "mutated",
  "disfigured",
  "(malformed limbs:1.2)",
  // 手・指・四肢・足
  "bad hands",
  "(fused fingers:1.3)",
  "(extra fingers:1.3)",
  "missing fingers",
  "too many fingers",
  "too few fingers",
  "(mutated hands:1.2)",
  "mutated fingers",
  "poorly drawn hands",
  "bad feet",
  "deformed feet",
  "extra toes",
  "missing toes",
  "fused toes",
  "(extra limbs:1.2)",
  "extra arms",
  "extra legs",
  "missing limb",
  "fused limbs",
  "disconnected limbs",
  // 顔・目
  "bad face",
  "poorly drawn face",
  "ugly face",
  "asymmetric face",
  "(asymmetric eyes:1.1)",
  "cross-eyed",
  "(extra eyes:1.2)",
  "missing eyes",
  "misaligned eyes",
  "bad mouth",
  "bad teeth",
  "extra teeth",
  "fused teeth",
  // 胸・乳首
  "extra breasts",
  "asymmetric breasts",
  "fused breasts",
  "deformed breasts",
  "extra nipples",
  "missing nipples",
  // 性器（NSFW 時に崩れやすい）
  "(deformed genitals:1.2)",
  "(bad genitals:1.2)",
  "fused genitals",
  "multiple genitals",
  "malformed pussy",
  "malformed penis",
  // 重複・分裂
  "duplicate",
  "cloned face",
  "doubled body",
  "twins",
  "mirrored",
  // 画像アーティファクト
  "watermark",
  "signature",
  "username",
  "artist name",
  "logo",
  "text",
  "error",
  "cropped",
  "border",
  "frame",
  // 未完成・簡素化
  "sketch",
  "unfinished",
  "lineart only",
  "monochrome",
  "greyscale",
  "simple background",
].join(", ");

function push(into: string[], value?: string | null) {
  if (!value) return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  into.push(trimmed.replace(/,\s*$/, ""));
}

/**
 * タグ重複除去。セクション（カンマ区切り 1 本）内で後続の完全一致を落とす。
 * 大文字小文字・前後空白は無視して判定。重み付きタグ `(foo:1.2)` は
 * `(foo:1.2)` と `foo` は別物として扱う（重み調整と無指定は意図が違うため）。
 */
function dedupSection(sectionText: string): string {
  const parts = sectionText
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of parts) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.join(", ");
}

/**
 * 最終プロンプトを BREAK 区切りで分割してから各セクション単位で dedup。
 * BREAK を跨いだ dedup はしない（多人数時に同じ outfit タグが両方必要な
 * ケースがあるため）。
 */
function dedupAcrossSections(prompt: string): string {
  return prompt
    .split(/\nBREAK\n/)
    .map((section) => dedupSection(section))
    .join("\nBREAK\n");
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
}

// 1 キャラ分のブロックを構築。
//   triggerWord は先頭グループ（triggerWords）で扱うのでここでは出力しない。
function buildCharacterBlock(
  char: CharacterLite,
  selection: CharacterSelection | undefined,
  options: { includeGenderCount: boolean; isMain: boolean },
): string[] {
  const parts: string[] = [];

  if (options.includeGenderCount) {
    const g = char.gender;
    push(parts, g === "male" ? "1boy" : g === "female" ? "1girl" : "1person");
  }

  // 身長タグ（主体のみ）
  if (options.isMain) {
    push(parts, heightCmToTags(char.heightCm));
  }

  // 表情
  if (selection?.expressionTags && selection.expressionTags.length > 0) {
    push(parts, selection.expressionTags.join(", "));
  }

  // 服装
  push(parts, selection?.outfit?.tags);

  // 陰毛（主体のみ）
  if (options.isMain && char.pubicHair) {
    const pubicTag = PUBIC_HAIR_TAGS[char.pubicHair];
    if (pubicTag) push(parts, pubicTag);
  }

  // キャラ固有の追加プロンプト
  push(parts, char.extraPrompt);

  return parts;
}

export function buildPrompt(s: PromptSelection): BuiltPrompt {
  // 0. 先頭グループ: キャラ triggerWord を全部集めて最前列に置く。
  //    SDXL は先頭トークンの重みが最大なので、Lora 発動の確実性が上がる。
  const triggerWords: string[] = [];
  for (const char of s.characters) {
    if (char.triggerWord) push(triggerWords, char.triggerWord);
  }

  const globalPrefix: string[] = [];

  // 1. 絵柄タグ（style trigger + style tags が既に結合されて渡ってくる）
  push(globalPrefix, s.artStyleTags);

  // 2. アングル・時間・場所（全体共通）
  push(globalPrefix, s.angle?.tags);
  push(globalPrefix, s.timeTags);
  push(globalPrefix, s.location?.tags);

  // キャラブロックを構築
  let characterBlocks: string[] = [];
  const chars = s.characters;

  if (chars.length === 0) {
    // キャラなし: グローバル表情・服装を直接使う
    const globalBlock: string[] = [];
    if (s.globalExpressionTags && s.globalExpressionTags.length > 0) {
      push(globalBlock, s.globalExpressionTags.join(", "));
    }
    push(globalBlock, s.globalOutfit?.tags);
    if (globalBlock.length > 0) characterBlocks.push(globalBlock.join(", "));
  } else if (chars.length === 1) {
    // 1 人: BREAK 不要、フラットに並べる
    const block = buildCharacterBlock(chars[0], s.perCharacter?.[chars[0].id], {
      includeGenderCount: true,
      isMain: true,
    });
    characterBlocks.push(block.join(", "));
  } else {
    // 2 人以上: 全体の性別カウントは BREAK 前に出す（モデルが主語の数を理解する）
    const girls = chars.filter((c) => c.gender === "female").length;
    const boys = chars.filter((c) => c.gender === "male").length;
    const countTags: string[] = [];
    if (girls > 0) countTags.push(`${girls}girl${girls > 1 ? "s" : ""}`);
    if (boys > 0) countTags.push(`${boys}boy${boys > 1 ? "s" : ""}`);
    if (countTags.length > 0) globalPrefix.push(countTags.join(", "));

    // 各キャラを BREAK 区切りで
    const blocks = chars.map((c, idx) =>
      buildCharacterBlock(c, s.perCharacter?.[c.id], {
        includeGenderCount: false,
        isMain: idx === 0,
      }).join(", "),
    );
    characterBlocks = blocks;
  }

  // 3. 共通末尾: 行為・ゴム・ユーザー追加・品質
  const globalSuffix: string[] = [];
  push(globalSuffix, s.action?.tags);
  const condom = CONDOM_OPTIONS.find((o) => o.value === s.condom);
  if (condom?.tags) push(globalSuffix, condom.tags);
  push(globalSuffix, s.extraPromptTokens);
  push(globalSuffix, QUALITY_TAGS);

  // 最終プロンプト組み立て
  const sections: string[] = [];
  if (triggerWords.length > 0) sections.push(triggerWords.join(", "));
  if (globalPrefix.length > 0) sections.push(globalPrefix.join(", "));
  if (chars.length >= 2) {
    // BREAK でキャラ間を分離
    sections.push(characterBlocks.filter((b) => b.length > 0).join("\nBREAK\n"));
  } else if (characterBlocks.length > 0) {
    sections.push(characterBlocks.join(", "));
  }
  if (globalSuffix.length > 0) sections.push(globalSuffix.join(", "));

  const rawPrompt = sections.filter((s) => s.length > 0).join(", ");
  // BREAK 区切りごとに dedup（BREAK を跨いだ重複は許容 = 多人数の同 outfit 対応）
  const prompt = dedupAcrossSections(rawPrompt);

  // ネガティブ（重複はしないので dedup 不要だが、一応 pass）
  const negativeParts: string[] = [DEFAULT_NEGATIVE];
  if (condom?.negative) push(negativeParts, condom.negative);
  const negativePrompt = dedupSection(negativeParts.join(", "));

  return { prompt, negativePrompt };
}
