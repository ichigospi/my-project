// 完成台本（テロップ用）の整形。
// 台本の文字は一切変えず（言い換え・削除・追加なし。「。」「、」も残す）、
// 意味のまとまりと息継ぎ（読点・句点・話の切れ目）で「1テロップ＝最大2行×約25文字」に区切る。
// 判断に迷った箇所（単語の途中で切らざるを得なかった等）は issues に残す。

export interface TelopOptions {
  maxLineChars?: number;   // 1行の文字数（既定25）
  maxLines?: number;       // 1テロップの最大行数（既定2）
}
export interface TelopIssue { index: number; text: string; reason: string }
export interface TelopResult {
  telops: string[];        // 各テロップ（行は \n 区切り）
  text: string;            // 出力テキスト（テロップごとに空行で区切り）
  issues: TelopIssue[];
  intact: boolean;         // 文字を1つも変えていないことの検証結果
  count: number;
}

const OPEN = "「『（(【";
const CLOSE = "」』）)】";
const UNIT = /^(日|秒|分|時間|週間|か月|ヶ月|カ月|年|回|人|つ|枚|本|件|個|円|万|億|倍|％|%|番|つ目|歳|度|cm|kg|m)/;

// 文に分ける。句点・感嘆符・疑問符で切るが、「」の中では切らない。改行も切れ目として扱う
function splitSentences(script: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  const flush = () => { const s = buf.trim(); if (s) out.push(s); buf = ""; };
  for (const ch of script.replace(/\r/g, "")) {
    if (ch === "\n") { flush(); continue; }
    buf += ch;
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[。！？!?]/.test(ch)) flush();
  }
  flush();
  // 「…」で終わる文の直後の閉じ括弧や「と。」などが分かれていたら前に戻す（例: 『「来たな」。』）
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length > 0 && /^[」』）)】、。]/.test(s)) merged[merged.length - 1] += s;
    else merged.push(s);
  }
  return merged;
}

// 文を「読点で終わる節」に分ける（読点は節の末尾に残す）。
// 「」の中でも読点・句点で切る（長いセリフを行に収めるため）。閉じ括弧や句読点だけが先頭に来た断片は前の断片に付ける
function splitClauses(sentence: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of sentence) {
    buf += ch;
    if (/[、。！？!?]/.test(ch)) { out.push(buf); buf = ""; }
  }
  if (buf) out.push(buf);
  const merged: string[] = [];
  for (const p of out) {
    if (merged.length > 0 && (/^[」』）)】、。！？!?]/.test(p) || p.length <= 2)) merged[merged.length - 1] += p;
    else merged.push(p);
  }
  return merged;
}

// 数字・固定の言い回し（5秒以内 等）の途中かどうか
function insideNumber(s: string, pos: number): boolean {
  const a = s[pos - 1] || "";
  const b = s[pos] || "";
  if (/[0-9０-９]/.test(a) && (/[0-9０-９]/.test(b) || UNIT.test(s.slice(pos)))) return true;
  if (/[0-9０-９]/.test(b) && /[0-9０-９第約]/.test(a)) return true;
  return false;
}

// 読点の無い長い節を、言葉の途中にならない位置で分ける。
// 候補: 助詞・接続の直後（は・が・を・に・で・と・も・へ・の・から・まで・って・ので・けど・ても・たら・なら・し）。maxに最も近い候補を選ぶ
function breakLongClause(clause: string, max: number): { parts: string[]; forced: boolean } {
  const parts: string[] = [];
  let rest = clause;
  let forced = false;
  const startsWord = (s: string) => /^[一-龥ァ-ヶ0-9０-９「『（(【]/.test(s);   // 次が漢字・カタカナ・数字・開き括弧＝新しい言葉の頭
  while (rest.length > max) {
    let cut = -1;
    // 第1候補: 助詞・接続の直後で、次が新しい言葉の頭（「にし｜か」「なってし｜まいます」のような言葉の途中を避ける）
    const re = /(から|まで|って|ので|けど|ても|たら|なら|のに|ように|ながら|は|が|を|に|で|と|も|へ|の|て)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest)) !== null) {
      const pos = m.index + m[0].length;
      if (pos > max) break;
      if (pos < 6) continue;                                  // 短すぎる切れ端は作らない
      if (insideNumber(rest, pos)) continue;
      if (!startsWord(rest.slice(pos))) continue;
      cut = pos;
    }
    // 第2候補: ひらがなの直後に漢字・カタカナが来る位置（言葉の境目になりやすい）
    if (cut < 0) {
      for (let pos = Math.min(max, rest.length - 1); pos >= 6; pos--) {
        if (/[ぁ-ん]/.test(rest[pos - 1]) && startsWord(rest.slice(pos)) && !insideNumber(rest, pos)) { cut = pos; forced = true; break; }
      }
    }
    if (cut < 0) {
      // 候補が無い: 数字・閉じ括弧を避けつつ max で強制的に切る（確認対象）
      cut = max;
      while (cut > 6 && (insideNumber(rest, cut) || /^[、。！？!?」』）)】ー]/.test(rest.slice(cut)))) cut--;
      forced = true;
    }
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return { parts, forced };
}

export function formatTelop(script: string, opts?: TelopOptions): TelopResult {
  const max = Math.max(10, opts?.maxLineChars ?? 25);
  const maxLines = Math.max(1, opts?.maxLines ?? 2);
  const telops: string[] = [];
  const issues: TelopIssue[] = [];

  for (const sentence of splitSentences(script)) {
    // 文を「1行に収まる断片」の列にする（読点で切り、長い節はさらに分ける）
    const pieces: string[] = [];
    let forcedAny = false;
    for (const clause of splitClauses(sentence)) {
      if (clause.length <= max) { pieces.push(clause); continue; }
      const { parts, forced } = breakLongClause(clause, max);
      pieces.push(...parts);
      if (forced) forcedAny = true;
    }
    // 断片を行に詰める（1行 max 以内）。行が maxLines を超えたら新しいテロップ
    let lines: string[] = [];
    let cur = "";
    const flushTelop = () => {
      if (cur) lines.push(cur);
      cur = "";
      if (lines.length > 0) telops.push(lines.join("\n"));
      lines = [];
    };
    for (const p of pieces) {
      if (cur && (cur + p).length > max) {
        lines.push(cur); cur = "";
        if (lines.length >= maxLines) { telops.push(lines.join("\n")); lines = []; }
      }
      cur += p;
      if (cur.length > max) {   // 1断片が max を超える（分け切れなかった）
        issues.push({ index: telops.length, text: cur, reason: `1行が${max}文字を超えています（言葉の切れ目が見つからず分けられませんでした）` });
      }
    }
    flushTelop();
    if (forcedAny) {
      issues.push({ index: telops.length - 1, text: sentence.slice(0, 40) + (sentence.length > 40 ? "…" : ""), reason: "読点の無い長い文を、助詞以外の位置（言葉の境目と思われる所）で切りました。言葉の途中になっていないか確認してください" });
    }
  }

  // 1文を複数テロップに分けた場合、末尾が読点で終わらないテロップ（＝途中で切れた）を確認対象に（意味のまとまりの確認）
  telops.forEach((t, i) => {
    const last = t.replace(/\n/g, "").slice(-1);
    if (!/[。！？!?、」』）)】]/.test(last)) {
      issues.push({ index: i, text: t.replace(/\n/g, "／"), reason: "句読点以外で切れています。意味のまとまりとして自然か確認してください" });
    }
  });

  // 文字を変えていないことの検証（空白・改行を除いて一致）
  const strip = (s: string) => s.replace(/\s+/g, "");
  const intact = strip(telops.join("")) === strip(script);
  if (!intact) issues.unshift({ index: -1, text: "", reason: "整形前後で文字が一致しません（ツールの不具合の可能性）。元の台本と見比べてください" });

  // 同じテロップへの重複指摘をまとめる
  const seen = new Set<string>();
  const uniq = issues.filter((it) => { const k = `${it.index}|${it.reason}`; if (seen.has(k)) return false; seen.add(k); return true; });

  return { telops, text: telops.join("\n\n"), issues: uniq, intact, count: telops.length };
}
