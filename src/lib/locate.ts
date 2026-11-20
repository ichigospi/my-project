// 品質チェックの指摘（「該当: 「…」」）から台本・骨組みの該当箇所を探す。
// 指摘側は空白を除いた文で引用しているので、本文側も空白を無視して照合し、元の位置に戻す

export interface TextRange { start: number; end: number }

// 指摘コメントから引用文を取り出す（「…」の中。短すぎるものと注記は除く）
export function extractQuotedTargets(comment: string | undefined): string[] {
  if (!comment) return [];
  const out: string[] = [];
  // 機械判定は「文」を「」で引用する。AIの採点は『語』を『』で引用することが多いので両方拾う（『』は短い語でも可）
  for (const m of comment.matchAll(/「([^」]{6,})」|『([^』]{2,})』/g)) {
    let s = (m[1] || m[2] || "").replace(/…$/, "").trim();
    if (s.includes("｜")) s = s.split("｜")[0];
    // 『笏（しゃく）』のような読み仮名の括弧は外す
    s = s.replace(/（[^）]*）/g, "").trim();
    if (s.length >= 2 && !out.includes(s)) out.push(s);
  }
  return out;
}

// 指摘に出てくるセクション番号（❶〜⓴・①〜⑳）。骨組みの該当セクションの見出し行に飛ぶために使う
const CIRCLED = "❶❷❸❹❺❻❼❽❾❿⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴";
const CIRCLED2 = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
export function extractSectionMarkers(comment: string | undefined): number[] {
  if (!comment) return [];
  const out: number[] = [];
  for (const ch of comment) {
    const i = CIRCLED.indexOf(ch) >= 0 ? CIRCLED.indexOf(ch) : CIRCLED2.indexOf(ch);
    if (i >= 0 && !out.includes(i + 1)) out.push(i + 1);
  }
  return out;
}
// 骨組みの「## ❿ 見出し」行の範囲
export function findSectionHeading(skeleton: string, n: number): TextRange | null {
  const marks = [CIRCLED[n - 1], CIRCLED2[n - 1]].filter(Boolean);
  let pos = 0;
  for (const line of skeleton.split("\n")) {
    if (/^\s*##/.test(line) && marks.some((m) => line.includes(m))) return { start: pos, end: pos + line.length };
    pos += line.length + 1;
  }
  return null;
}
// 指摘が「どこか」を指せるか（引用かセクション番号がある）
export function canLocate(comment: string | undefined, opts?: { sections?: boolean }): boolean {
  return extractQuotedTargets(comment).length > 0 || (!!opts?.sections && extractSectionMarkers(comment).length > 0);
}

// 空白を無視して target を text から探し、元の text 上の範囲を返す
export function findInText(text: string, target: string): TextRange | null {
  const norm = (s: string) => s.replace(/\s+/g, "");
  const nt = norm(target);
  if (!nt) return null;
  // 元の位置へのマップ
  const map: number[] = [];
  let compact = "";
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    map.push(i); compact += text[i];
  }
  let idx = compact.indexOf(nt);
  if (idx < 0 && nt.length > 24) {
    // 末尾が切れている引用（「…」で切った）に備えて、前半24字で探す
    idx = compact.indexOf(nt.slice(0, 24));
    if (idx >= 0) return { start: map[idx], end: map[Math.min(compact.length, idx + nt.length) - 1] + 1 };
  }
  if (idx < 0) return null;
  return { start: map[idx], end: map[idx + nt.length - 1] + 1 };
}

// 指摘から最初に見つかる該当範囲を返す
export function locateFirst(text: string, comment: string | undefined, opts?: { sections?: boolean }): TextRange | null {
  const targets = extractQuotedTargets(comment);
  // 長い引用（文）を優先し、短い語は後回し
  for (const t of targets.slice().sort((a, b) => b.length - a.length)) {
    const r = findInText(text, t);
    if (r) return r;
  }
  if (opts?.sections) {
    for (const n of extractSectionMarkers(comment)) {
      const r = findSectionHeading(text, n);
      if (r) return r;
    }
  }
  return null;
}
