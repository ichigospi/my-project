// 6W1H の選択状態からプロンプト文字列を組み立てる。
// プロンプトの語順は HANDOVER.md「プロンプト組み立て順序」に従う。

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
}

export interface PromptSelection {
  timeTags?: string;
  characters: CharacterLite[];          // 1人目が主体
  location?: { tags: string; name?: string };
  outfit?: { tags: string; isNude?: boolean };
  angle?: { tags: string };
  action?: { tags: string; isNSFW?: boolean };
  condom: CondomState;
  artStyleTags?: string;                 // 絵師タグ等
  extraPromptTokens?: string;            // ユーザーが直接足したい追加トークン
  // 全裸/半裸以外でも体タグを混ぜたい場合は true
  includeBodyTagsAlways?: boolean;
}

const QUALITY_TAGS = "masterpiece, best quality, ultra detailed";
const DEFAULT_NEGATIVE = "lowres, bad quality, worst quality, bad anatomy, deformed";

function push(into: string[], value?: string | null) {
  if (!value) return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  into.push(trimmed.replace(/,\s*$/, ""));
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
}

export function buildPrompt(s: PromptSelection): BuiltPrompt {
  const parts: string[] = [];

  // 1. 絵柄タグ
  push(parts, s.artStyleTags);

  // 2. キャラ（Lora トリガー + 数）
  if (s.characters.length > 0) {
    const triggers = s.characters
      .map((c) => c.triggerWord?.trim())
      .filter((t): t is string => !!t && t.length > 0);
    if (triggers.length > 0) push(parts, triggers.join(", "));

    if (s.characters.length === 1) {
      const gender = s.characters[0].gender;
      push(parts, gender === "male" ? "1boy" : gender === "female" ? "1girl" : "1person");
    } else {
      const girls = s.characters.filter((c) => c.gender === "female").length;
      const boys = s.characters.filter((c) => c.gender === "male").length;
      if (girls > 0) push(parts, `${girls}girl${girls > 1 ? "s" : ""}`);
      if (boys > 0) push(parts, `${boys}boy${boys > 1 ? "s" : ""}`);
    }

    // 身長タグ（主体のみ）
    const main = s.characters[0];
    push(parts, heightCmToTags(main.heightCm));
  }

  // 3. アングル
  push(parts, s.angle?.tags);

  // 4. 時間
  push(parts, s.timeTags);

  // 5. 場所
  push(parts, s.location?.tags);

  // 6. 服装
  push(parts, s.outfit?.tags);

  // 7. 行為
  push(parts, s.action?.tags);

  // 8. ゴム
  const condom = CONDOM_OPTIONS.find((o) => o.value === s.condom);
  if (condom?.tags) push(parts, condom.tags);

  // 9. キャラ固有の追加プロンプト
  for (const c of s.characters) push(parts, c.extraPrompt);

  // 10. ユーザーが手書きで足したトークン
  push(parts, s.extraPromptTokens);

  // 11. 品質タグ
  push(parts, QUALITY_TAGS);

  const prompt = parts.join(", ");

  // ネガティブ
  const negativeParts: string[] = [DEFAULT_NEGATIVE];
  if (condom?.negative) push(negativeParts, condom.negative);

  return { prompt, negativePrompt: negativeParts.join(", ") };
}
