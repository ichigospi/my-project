// 世界観の固定。このチャンネルの語り手は「守護天使様」。元ネタ（龍神・白蛇・神様・宇宙 など別の世界観）の語を
// 設計表・骨組み・台本・修正に持ち込ませない。生成プロンプトに「置き換え」の指示を入れ、機械判定でも拾う。
import type { QualityCheckItem } from "@/lib/project-store";

export const HOME_WORLDVIEW = "守護天使様";

// 別世界観の語（語と、何に置き換えるか）。固有の存在名だけを対象にし、「神社」「お守り」のような行動語は対象外
export const FOREIGN_WORLDVIEW: { re: RegExp; label: string; replace: string }[] = [
  { re: /龍神様?|竜神様?|龍王様?|龍の|竜の|龍が|龍様|ドラゴン/g, label: "龍神", replace: HOME_WORLDVIEW },
  { re: /白蛇様?|白ヘビ|蛇神様?|蛇の神様?|巳様|巳さん/g, label: "白蛇", replace: HOME_WORLDVIEW },
  { re: /宇宙(の意思|の采配|からの|が味方|のサポート|の法則|からのサイン)/g, label: "宇宙", replace: `${HOME_WORLDVIEW}の導き` },
  { re: /ハイヤーセルフ|アカシック|ソウルメイト|ツインレイ|ツインソウル/g, label: "スピ用語（別系統）", replace: `${HOME_WORLDVIEW}／運命の人` },
  { re: /観音様|弁財天様?|弁天様|大黒天様?|稲荷様?|お稲荷様?|天照様?|アマテラス|菩薩様?|仏様|ご先祖様|先祖の|精霊|妖精|女神様|女神のよう/g, label: "別の神仏・存在", replace: HOME_WORLDVIEW },
  { re: /(?<![龍竜蛇])神様(が|は|から|の)(?!守護)/g, label: "神様", replace: `${HOME_WORLDVIEW}$1` },
];

export function scanWorldview(text: string): { label: string; hits: string[]; replace: string }[] {
  const t = text.replace(/\s+/g, "");
  const out: { label: string; hits: string[]; replace: string }[] = [];
  for (const f of FOREIGN_WORLDVIEW) {
    const re = new RegExp(f.re.source, "g");
    const hits: string[] = [];
    for (const m of t.matchAll(re)) {
      const i = m.index ?? 0;
      let s = i; while (s > 0 && !/[。！？!?]/.test(t[s - 1])) s--;
      let e = i + m[0].length; while (e < t.length && !/[。！？!?]/.test(t[e])) e++;
      const sent = t.slice(s, e + 1);
      if (!hits.includes(sent)) hits.push(sent.length > 100 ? sent.slice(0, 100) + "…" : sent);
      if (hits.length >= 5) break;
    }
    if (hits.length) out.push({ label: f.label, hits, replace: f.replace });
  }
  return out;
}

export function scanWorldviewItems(text: string): QualityCheckItem[] {
  return scanWorldview(text).map((h) => ({
    name: `世界観違反: 「${h.label}」`,
    status: "fail" as const,
    comment: `このチャンネルの世界観は「${HOME_WORLDVIEW}」です。別の世界観の語が入っています。該当（全部直す）:\n${h.hits.map((s) => `「${s}」`).join("\n")}`,
    suggestion: `「${h.replace}」に置き換え、文脈も${HOME_WORLDVIEW}の世界観で言い直す（元ネタの世界観語は持ち込まない）`,
  }));
}

// 生成・設計・修正の各プロンプトに入れる固定ブロック
export function worldviewPromptBlock(): string {
  return `【世界観の固定（必達）】
- このチャンネルの語り手が見ているのは「${HOME_WORLDVIEW}」。守護・導き・メッセージの主体はすべて${HOME_WORLDVIEW}
- 元ネタに龍神・白蛇・神様・宇宙・ハイヤーセルフ・観音様・ご先祖様などの別の世界観の語があっても、そのまま使わない。内容（訴求・構図）だけを引き継ぎ、主体は${HOME_WORLDVIEW}に置き換える
- 別の世界観の語は、設計表・骨組み・台本のどこにも出さない（機械判定で不合格になる）`;
}

// テキスト内の別世界観語を機械的に置き換える（設計表の短文向け。長文の台本は置換ではなく書き直す）
export function replaceWorldview(text: string): string {
  let s = text;
  for (const f of FOREIGN_WORLDVIEW) s = s.replace(new RegExp(f.re.source, "g"), f.replace);
  return s;
}
