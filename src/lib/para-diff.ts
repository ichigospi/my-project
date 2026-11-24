// 提出台本 vs 完成台本 の「領域」差分。横並び表示と「修正ポイント」の材料に使う。
// 段落ではなく文で揃える（提出台本は1文1行、完成台本は複数文1段落、のように段落の切り方が違っても対応が取れる）。
// 文が一致する区間を軸に、両側の間の文をまとめて1行（書き換え／削除／追加）にする。両方の全文が順番どおりに全部並ぶ。

export type ParaDiffRow =
  | { kind: "same"; left: string; right: string }
  | { kind: "changed"; left: string; right: string }
  | { kind: "removed"; left: string; right: "" }
  | { kind: "added"; left: ""; right: string };

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[「」『』、。！？!?…・，．]/g, "");

// 文に分ける（文末記号と改行で切る。改行は直前の文にくっつけて、表示のときに元の段落分けが残るようにする）
function sentences(text: string): string[] {
  const raw = (text || "").replace(/\r/g, "").split(/(?<=[。！？!?])|(?<=\n)(?=[^\n])/);
  const out: string[] = [];
  for (const t of raw) {
    if (!t) continue;
    if (norm(t) === "" && out.length) out[out.length - 1] += t; // 空白・改行だけなら前の文に付ける
    else out.push(t);
  }
  return out;
}

function coarsen(arr: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2).join(""));
  return out;
}

export function paraDiff(before: string, after: string): ParaDiffRow[] {
  let a = sentences(before), b = sentences(after);
  while (a.length * b.length > 600000 && (a.length > 1 || b.length > 1)) { a = coarsen(a); b = coarsen(b); }
  const na = a.map(norm), nb = b.map(norm);
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  // まず「一致の連続」と「不一致の連続」の区間に分ける
  type Run = { kind: "same" | "diff"; l: string[]; r: string[] };
  const runs: Run[] = [];
  let i = 0, j = 0;
  const push = (kind: "same" | "diff", l: string[], r: string[]) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) { last.l.push(...l); last.r.push(...r); } else runs.push({ kind, l: [...l], r: [...r] });
  };
  while (i < n && j < m) {
    if (na[i] === nb[j]) { push("same", [a[i]], [b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("diff", [a[i]], []); i++; }
    else { push("diff", [], [b[j]]); j++; }
  }
  while (i < n) { push("diff", [a[i]], []); i++; }
  while (j < m) { push("diff", [], [b[j]]); j++; }

  // 不一致に挟まれた短い一致（「はい。」のような1文）は前後の不一致に吸収して、行が細切れにならないようにする
  const merged: Run[] = [];
  for (let k = 0; k < runs.length; k++) {
    const r = runs[k];
    const prev = merged[merged.length - 1];
    const next = runs[k + 1];
    if (r.kind === "same" && prev?.kind === "diff" && next?.kind === "diff" && norm(r.l.join("")).length < 12) {
      prev.l.push(...r.l); prev.r.push(...r.r);
      continue;
    }
    if (prev && prev.kind === r.kind) { prev.l.push(...r.l); prev.r.push(...r.r); }
    else merged.push({ kind: r.kind, l: [...r.l], r: [...r.r] });
  }

  const trim = (s: string) => s.replace(/^\n+|\n+$/g, "");
  const rows: ParaDiffRow[] = [];
  for (const r of merged) {
    const left = trim(r.l.join("")), right = trim(r.r.join(""));
    if (r.kind === "same") rows.push({ kind: "same", left, right });
    else if (left && right) rows.push({ kind: "changed", left, right });
    else if (left) rows.push({ kind: "removed", left, right: "" });
    else if (right) rows.push({ kind: "added", left: "", right });
  }
  return rows;
}

export function diffStats(rows: ParaDiffRow[]): { changed: number; removed: number; added: number; same: number } {
  return rows.reduce((s, r) => { s[r.kind]++; return s; }, { changed: 0, removed: 0, added: 0, same: 0 });
}

// 書き換え行の中で「どの言葉が変わったか」を示すための文字単位の差分
export interface InlineSeg { text: string; mark: boolean }
export function inlineDiff(left: string, right: string): { left: InlineSeg[]; right: InlineSeg[] } {
  const split = (s: string) => Array.from(s);
  let a = split(left), b = split(right);
  // 大きすぎるときは2文字ずつにまとめて計算量を抑える
  while (a.length * b.length > 400000 && (a.length > 1 || b.length > 1)) { a = coarsen(a); b = coarsen(b); }
  const n = a.length, m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const L: InlineSeg[] = [], R: InlineSeg[] = [];
  const add = (arr: InlineSeg[], text: string, mark: boolean) => {
    const last = arr[arr.length - 1];
    if (last && last.mark === mark) last.text += text; else arr.push({ text, mark });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { add(L, a[i], false); add(R, b[j], false); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { add(L, a[i], true); i++; }
    else { add(R, b[j], true); j++; }
  }
  while (i < n) { add(L, a[i], true); i++; }
  while (j < m) { add(R, b[j], true); j++; }
  // 1〜2文字だけ一致する島（助詞など）は変更側に寄せて、まだら模様にならないようにする
  const smooth = (arr: InlineSeg[]) => {
    const out: InlineSeg[] = [];
    for (const s of arr) {
      const prev = out[out.length - 1];
      const tiny = !s.mark && norm(s.text).length <= 2 && prev?.mark;
      if (tiny) { prev.text += s.text; continue; }
      if (prev && prev.mark === s.mark) prev.text += s.text; else out.push({ ...s });
    }
    return out;
  };
  return { left: smooth(L), right: smooth(R) };
}
