// 品質チェックの「機械判定」: AIの主観に頼らず、文字列で検出できる違反を確実に拾う。
// - 禁止した定型文（毎回出る決まり文句）
// - 漢数字（算用数字ルール）
// - 直近の台本との同一文（前回の文の流用）
import type { QualityCheckItem } from "@/lib/project-store";

export interface BlacklistRule { pattern: RegExp; level: "fail" | "warn"; reason: string; fix?: string }

export const QC_BLACKLIST: BlacklistRule[] = [
  { pattern: /加護を[、]?(確かに)?受け取ります/, level: "fail", reason: "軽CTAの意味づけが「守護天使様の加護を受け取る合図」のデフォルト（禁止）", fix: "その動画のコンセプト語（扉・周波数・天秤 等）から意味づけを作る。高評価＝チューニング、コメント＝宣言、のように役割を分ける" },
  { pattern: /あなただけのための無料の霊視鑑定を行っています/, level: "fail", reason: "LINE誘導の定型文（禁止）", fix: "動画の内容に接続した言い回しに（例:「あなたの場合はどうなのか、概要欄のLINEから友だち追加してくれたら、一人ずつ無料で視ています」）" },
  { pattern: /概要欄のLINEから受け取ってください/, level: "warn", reason: "LINE誘導の定型句", fix: "「概要欄のLINEから友だち追加してくださいね」等、言い回しを変える" },
  { pattern: /コメントは[、]?全部読んでいます/, level: "fail", reason: "常連化の定型文（3回に1回・抽選に従う）", fix: "今回は省くか、抽選で指定された常連化の一言に差し替える" },
  { pattern: /あなたのことが[、]?(私は)?とても大切/, level: "warn", reason: "常連化の定型文", fix: "省くか別の言い回しに" },
  { pattern: /明日もこの枠が残っている保証/, level: "fail", reason: "枠切迫の定型文（禁止）", fix: "抽選で指定された希少性の型（先着順／人数限り／受付縮小 等）に従う" },
  { pattern: /毎日数十件のお申し込み/, level: "warn", reason: "枠切迫の定型句", fix: "希少性の型を変える" },
  { pattern: /追うのをやめた途端/, level: "fail", reason: "社会的証明の決まり文句（毎回同じ）", fix: "きっかけ→行動→結果の筋が通る具体に書き換える" },
  { pattern: /そっと棚に戻し/, level: "fail", reason: "金運の定番シーン「値札を見て棚に戻す」の使い回し（テーマ不整合の温床）", fix: "テーマに合う言い当てシーンに差し替える" },
  { pattern: /朝日と夕暮れ/, level: "fail", reason: "対比比喩のデフォルト（禁止）", fix: "抽選で指定された対比の比喩に従う" },
  { pattern: /諦めていた臨時収入|止まっていた入金/, level: "fail", reason: "曖昧で意味の取れない実績表現（禁止）", fix: "何が・どう変わったかの具体（例: 問い合わせが月1件→5件）に" },
  { pattern: /シャッフルの手が|シャッフルの途中/, level: "fail", reason: "録画解説調の演出（禁止）", fix: "「お、この1枚出ましたね」等、その場で引いている言い方に" },
  { pattern: /箱から飛び出/, level: "fail", reason: "シャッフルと矛盾する演出（禁止）", fix: "束から現れる言い方に" },
  { pattern: /心に入れた/, level: "fail", reason: "造語的で意味の取れない表現（禁止）", fix: "「大切に思った」等の普通の言葉に" },
  { pattern: /問いかけさせてください/, level: "warn", reason: "書き言葉（話し言葉に）", fix: "「ひとつ聞いてもいいですか」" },
  { pattern: /受け取る準備ができた[」』]と告げた/, level: "warn", reason: "魂の正当化の定型（3〜4回に1回のみ）", fix: "採用した選民フックの切り口に合わせた正当化に" },
  { pattern: /[0-9０-９]+パーセントもいない/, level: "warn", reason: "中盤フック「上位◯%」の使い回し", fix: "別の中盤フックの型に" },
  { pattern: /朝からそわそわ/, level: "warn", reason: "熱量表現の使い回し", fix: "別の熱量表現に" },
  { pattern: /本来のあなたに戻る/, level: "warn", reason: "波長合わせ型が抽選された回のみ可", fix: "他の型なら言い換える" },
  { pattern: /頭では(もう)?答えが出ているのに/, level: "warn", reason: "前回台本の文の流用", fix: "別の言い回しに" },
  { pattern: /執着を手放しなさい/, level: "warn", reason: "仮想敵「占い師テンプレ型」の定型", fix: "抽選で指定された仮想敵に従う" },
];

function excerpt(script: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  return script.slice(Math.max(0, i - 25), Math.min(script.length, i + (m[0]?.length || 0) + 25)).replace(/\s+/g, " ");
}

export function scanBlacklist(script: string): QualityCheckItem[] {
  const items: QualityCheckItem[] = [];
  for (const rule of QC_BLACKLIST) {
    const m = script.match(rule.pattern);
    if (!m) continue;
    items.push({
      name: `定型文: 「${m[0]}」`,
      status: rule.level,
      comment: `${rule.reason}。該当: …${excerpt(script, m)}…`,
      suggestion: rule.fix || "",
    });
  }
  return items;
}

// 漢数字（算用数字ルール）。慣用（一人・一方・一瞬・一度・一本 等）は対象外にし、数えの単位だけを見る
export function scanKanjiNumerals(script: string): QualityCheckItem[] {
  const re = /[一二三四五六七八九十百千]+(枚目|週間|ヶ月|か月|カ月|日後|日以内|分後|時間後|パーセント|件|回目|万円|億円)|[三四五六七八九十]つ/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) { found.add(m[0]); if (found.size >= 10) break; }
  if (found.size === 0) return [];
  return [{
    name: "表記: 漢数字",
    status: "warn",
    comment: `算用数字ルールに反する漢数字: ${Array.from(found).join("、")}`,
    suggestion: "数は算用数字で書く（例: 三週間→3週間、三つ→3つ）",
  }];
}

// 直近の台本との同一文（25字以上の完全一致）
export function findRepeatedSentences(script: string, others: string[]): QualityCheckItem[] {
  const norm = (t: string) => t.replace(/\s+/g, "");
  const split = (t: string) => norm(t).split(/(?<=[。！？!?])/).map((x) => x.trim()).filter((x) => x.length >= 25);
  const mine = split(script);
  const pool = new Set<string>();
  for (const o of others || []) for (const s of split(o)) pool.add(s);
  if (pool.size === 0) return [];
  const hits: string[] = [];
  for (const s of mine) { if (pool.has(s) && !hits.includes(s)) hits.push(s); if (hits.length >= 8) break; }
  if (hits.length === 0) return [];
  return [{
    name: `前回台本と同一の文（${hits.length}件）`,
    status: hits.length >= 3 ? "fail" : "warn",
    comment: hits.map((h) => `「${h.slice(0, 60)}${h.length > 60 ? "…" : ""}」`).join(" ／ "),
    suggestion: "前回の文をそのまま流用せず、言い回し・具体を変える（同じ訴求でも文は毎回書き換える）",
  }];
}

export function runMechanicalChecks(script: string, recentScripts?: string[]): QualityCheckItem[] {
  return [...scanBlacklist(script), ...scanKanjiNumerals(script), ...findRepeatedSentences(script, recentScripts || [])];
}
