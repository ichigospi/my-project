// 骨組みの「字数配分」。
// 骨組みの各セクション見出しに「（m:ss-m:ss｜約N字）」を持たせ、合計が目標字数に一致するようにツール側で再配分する。
// 尺は字数から 1分=250字 で引き直す（元ネタの話す速さに引きずられないようにする）。
export const CHARS_PER_MINUTE = 250;

export interface SkeletonSection {
  index: number;        // 0始まり
  line: number;         // 見出し行の行番号
  title: string;        // 見出し本文（番号記号・時間・字数を除く）
  startSec?: number;
  endSec?: number;
  chars?: number;       // 「約N字」の値
}

const HEAD_RE = /^(##\s*[❶❷❸❹❺❻❼❽❾❿⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴①-⑳]?\s*)(.*?)\s*（\s*(?:(\d{1,3}):(\d{2})\s*[-〜~ー–]\s*(\d{1,3}):(\d{2}))?\s*(?:[｜|]\s*約?\s*([0-9,，]+)\s*字)?\s*）\s*$/;

const toSec = (m: string, s: string) => Number(m) * 60 + Number(s);
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

// 見出し行を読む
export function parseSkeletonSections(skeleton: string): SkeletonSection[] {
  const lines = skeleton.split("\n");
  const out: SkeletonSection[] = [];
  lines.forEach((ln, i) => {
    if (!/^##\s/.test(ln)) return;
    const m = ln.match(HEAD_RE);
    if (!m) {
      // 時間も字数も無い見出し
      const t = ln.replace(/^##\s*[❶-❿⓫-⓴①-⑳]?\s*/, "").trim();
      if (t && !/^#/.test(t)) out.push({ index: out.length, line: i, title: t });
      return;
    }
    out.push({
      index: out.length, line: i, title: m[2].trim(),
      startSec: m[3] !== undefined ? toSec(m[3], m[4]) : undefined,
      endSec: m[5] !== undefined ? toSec(m[5], m[6]) : undefined,
      chars: m[7] ? Number(m[7].replace(/[,，]/g, "")) : undefined,
    });
  });
  return out;
}

// 字数表記の合計（3セクション以上に字数があるときだけ有効）
export function sumSkeletonChars(skeleton: string): { total: number; annotated: number; sections: SkeletonSection[] } {
  const sections = parseSkeletonSections(skeleton);
  const annotated = sections.filter((s) => s.chars && s.chars > 0);
  return { total: annotated.reduce((n, s) => n + (s.chars || 0), 0), annotated: annotated.length, sections };
}

// 目標字数に合わせて各セクションの字数を再配分し、尺を引き直して見出しに書き戻す。
// 重み: 「約N字」があればそれ、無ければ尺の長さ、どちらも無ければ均等。
export function reallocateSkeletonChars(skeleton: string, targetChars: number, opts?: { rate?: number; minChars?: number }): { skeleton: string; sections: { title: string; chars: number; start: string; end: string }[] } {
  const rate = opts?.rate ?? CHARS_PER_MINUTE;
  const minChars = opts?.minChars ?? 150;
  const lines = skeleton.split("\n");
  const sections = parseSkeletonSections(skeleton);
  if (sections.length === 0 || !targetChars) return { skeleton, sections: [] };
  const weights = sections.map((s) => {
    if (s.chars && s.chars > 0) return s.chars;
    if (s.startSec !== undefined && s.endSec !== undefined && s.endSec > s.startSec) return (s.endSec - s.startSec) / 60 * rate;
    return 0;
  });
  const hasAny = weights.some((w) => w > 0);
  const w = weights.map((x) => (hasAny ? (x > 0 ? x : minChars) : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  let alloc = w.map((x) => Math.max(minChars, Math.round((targetChars * x) / sum / 10) * 10));
  // 丸めで出たズレは最後のセクションで吸収
  const diff = targetChars - alloc.reduce((a, b) => a + b, 0);
  alloc[alloc.length - 1] = Math.max(minChars, alloc[alloc.length - 1] + diff);
  let cursor = 0;
  const result: { title: string; chars: number; start: string; end: string }[] = [];
  sections.forEach((s, i) => {
    const sec = Math.round((alloc[i] / rate) * 60);
    const start = cursor; const end = cursor + sec; cursor = end;
    const prefix = (lines[s.line].match(/^(##\s*[❶-❿⓫-⓴①-⑳]?\s*)/) || ["", "## "])[1];
    lines[s.line] = `${prefix}${s.title}（${fmt(start)}-${fmt(end)}｜約${alloc[i].toLocaleString()}字）`;
    result.push({ title: s.title, chars: alloc[i], start: fmt(start), end: fmt(end) });
  });
  // 冒頭の「推定尺 | 目標文字数」行を更新
  const totalMin = Math.round(cursor / 60);
  for (let i = 0; i < lines.length; i++) {
    if (/推定尺[:：]/.test(lines[i]) && /目標文字数/.test(lines[i])) {
      lines[i] = `推定尺: 約${totalMin}分 | 目標文字数: 約${targetChars.toLocaleString()}字（各セクションの「約N字」の合計＝目標。1分≒${rate}字）`;
      break;
    }
  }
  return { skeleton: lines.join("\n"), sections: result };
}

// 生成プロンプト用: セクションごとの目安字数の一覧
export function formatSectionTargets(skeleton: string): string {
  const { sections, annotated } = sumSkeletonChars(skeleton);
  if (annotated < 3) return "";
  return sections.filter((s) => s.chars).map((s) => `- ${s.title}: 約${s.chars!.toLocaleString()}字`).join("\n");
}
