// 添削部屋の差分表示用: 文単位のLCS差分。
// 提出時の台本（old）とオーナー添削後（new）を比較し、変更/追加/削除セグメントを返す。

export interface DiffSeg {
  type: "same" | "changed" | "added" | "removed";
  text: string;      // 表示するテキスト（removedの場合は空）
  original: string;  // 変更前テキスト（same/addedの場合は空）
}

function tokenize(s: string): string[] {
  return s.split(/(?<=[。．！!？?\n])/).filter((t) => t.length > 0);
}

// トークンが多すぎる場合は隣接トークンを結合してLCSを安全な規模に抑える
function coarsen(arr: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2).join(""));
  return out;
}

export function diffTexts(oldText: string, newText: string): DiffSeg[] {
  let a = tokenize(oldText || "");
  let b = tokenize(newText || "");
  while (a.length * b.length > 400000 && (a.length > 1 || b.length > 1)) {
    a = coarsen(a);
    b = coarsen(b);
  }

  const n = a.length, m = b.length;
  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // バックトラックで del/ins の連続をまとめ、del+ins→changed に変換
  const segs: DiffSeg[] = [];
  let i = 0, j = 0;
  let delBuf: string[] = [], insBuf: string[] = [];
  const flush = () => {
    const del = delBuf.join("");
    const ins = insBuf.join("");
    if (del && ins) segs.push({ type: "changed", text: ins, original: del });
    else if (ins) segs.push({ type: "added", text: ins, original: "" });
    else if (del) segs.push({ type: "removed", text: "", original: del });
    delBuf = []; insBuf = [];
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      // 連続するsameをまとめる
      const buf: string[] = [];
      while (i < n && j < m && a[i] === b[j]) { buf.push(a[i]); i++; j++; }
      segs.push({ type: "same", text: buf.join(""), original: "" });
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      delBuf.push(a[i]); i++;
    } else {
      insBuf.push(b[j]); j++;
    }
  }
  while (i < n) { delBuf.push(a[i]); i++; }
  while (j < m) { insBuf.push(b[j]); j++; }
  flush();
  return segs;
}

// コメントの紐付けキー（内容ベースなので、他の箇所を編集してもキーが保たれる）
export function segKey(seg: DiffSeg): string {
  return `${seg.type}|${seg.original}|${seg.text}`;
}

// 元ネタ台本の表示用整形: 文末（。！？）で改行し、余分な空白を除去して読みやすくする
export function formatTranscript(t: string): string {
  return (t || "")
    .replace(/\r/g, "")
    .replace(/[ \t　]+/g, " ")
    .replace(/([。．！!？?])\s*/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
