// 品質チェックの指摘（「該当: 「…」」）から台本・骨組みの該当箇所を探す。
// 指摘側は空白を除いた文で引用しているので、本文側も空白を無視して照合し、元の位置に戻す

export interface TextRange { start: number; end: number }

// 指摘コメントから引用文を取り出す（「…」の中。短すぎるものと注記は除く）
export function extractQuotedTargets(comment: string | undefined): string[] {
  if (!comment) return [];
  const out: string[] = [];
  for (const m of comment.matchAll(/「([^」]{6,})」/g)) {
    let s = m[1].replace(/…$/, "").trim();
    // 「A｜B」のように2文を区切って並べたものは最初の文だけ
    if (s.includes("｜")) s = s.split("｜")[0];
    if (s.length >= 6 && !out.includes(s)) out.push(s);
  }
  return out;
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
export function locateFirst(text: string, comment: string | undefined): TextRange | null {
  for (const t of extractQuotedTargets(comment)) {
    const r = findInText(text, t);
    if (r) return r;
  }
  return null;
}
