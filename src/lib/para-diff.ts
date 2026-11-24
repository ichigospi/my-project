// 段落単位の差分（提出台本 vs 完成台本）。横並び表示と「修正ポイント」の材料に使う
import { splitParagraphs } from "@/lib/paragraph-edit";

export type ParaDiffRow =
  | { kind: "same"; left: string; right: string }
  | { kind: "changed"; left: string; right: string }
  | { kind: "removed"; left: string; right: "" }
  | { kind: "added"; left: ""; right: string };

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[「」『』、。！？!?…・]/g, "");
// 2段落の近さ（4文字断片の一致率）。書き換えの対になる段落を探すのに使う
function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  const grams = new Set<string>(); for (let i = 0; i + 4 <= x.length; i++) grams.add(x.slice(i, i + 4));
  if (grams.size === 0) return x === y ? 1 : 0;
  let hit = 0; for (const g of grams) if (y.includes(g)) hit++;
  return hit / grams.size;
}

export function paraDiff(before: string, after: string): ParaDiffRow[] {
  const a = splitParagraphs(before), b = splitParagraphs(after);
  const na = a.map(norm), nb = b.map(norm);
  // LCS（完全一致の段落を軸に揃える）
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: ParaDiffRow[] = [];
  let i = 0, j = 0;
  const delBuf: string[] = [], insBuf: string[] = [];
  const flush = () => {
    // 削除と追加が溜まったら、似ている段落同士を「書き換え」として対にする
    while (delBuf.length && insBuf.length) {
      const l = delBuf.shift()!;
      let best = -1, bestS = 0.25;
      insBuf.forEach((r, k) => { const s = similarity(l, r); if (s > bestS) { bestS = s; best = k; } });
      if (best >= 0) { const r = insBuf.splice(best, 1)[0]; rows.push({ kind: "changed", left: l, right: r }); }
      else rows.push({ kind: "removed", left: l, right: "" });
    }
    while (delBuf.length) rows.push({ kind: "removed", left: delBuf.shift()!, right: "" });
    while (insBuf.length) rows.push({ kind: "added", left: "", right: insBuf.shift()! });
  };
  while (i < n && j < m) {
    if (na[i] === nb[j]) { flush(); rows.push({ kind: "same", left: a[i], right: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { delBuf.push(a[i]); i++; }
    else { insBuf.push(b[j]); j++; }
  }
  while (i < n) delBuf.push(a[i++]);
  while (j < m) insBuf.push(b[j++]);
  flush();
  return rows;
}

export function diffStats(rows: ParaDiffRow[]): { changed: number; removed: number; added: number; same: number } {
  return rows.reduce((s, r) => { s[r.kind]++; return s; }, { changed: 0, removed: 0, added: 0, same: 0 });
}
