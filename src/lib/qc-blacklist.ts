// 品質チェックの「機械判定」: AIの主観に頼らず、文字列で検出できる違反を確実に拾う。
// - 禁止した定型文（毎回出る決まり文句）
// - 漢数字（算用数字ルール）
// - 直近の台本との同一文（前回の文の流用）
import type { QualityCheckItem } from "@/lib/project-store";

// level: fail=常に禁止（意味不明・ルール違反）／warn=注意／track=繰り返し管理（合格した直近2本の両方で使っていたら3連続→fail。2連続まではOK）
export interface BlacklistRule { pattern: RegExp; level: "fail" | "warn" | "track"; reason: string; fix?: string }

export const QC_BLACKLIST: BlacklistRule[] = [
  { pattern: /加護を[、]?(確かに)?受け取ります/, level: "fail", reason: "軽CTAの意味づけが「守護天使様の加護を受け取る合図」のデフォルト（禁止）", fix: "その動画のコンセプト語（扉・周波数・天秤 等）から意味づけを作る。高評価＝チューニング、コメント＝宣言、のように役割を分ける" },
  { pattern: /あなただけのための無料の霊視鑑定を行っています/, level: "fail", reason: "LINE誘導の定型文（禁止）", fix: "動画の内容に接続した言い回しに（例:「あなたの場合はどうなのか、概要欄のLINEから友だち追加してくれたら、一人ずつ無料で視ています」）" },
  { pattern: /概要欄のLINEから受け取ってください/, level: "warn", reason: "LINE誘導の定型句", fix: "「概要欄のLINEから友だち追加してくださいね」等、言い回しを変える" },
  { pattern: /コメントは[、]?全部読んでいます/, level: "track", reason: "常連化の定型文（3回に1回・抽選に従う）", fix: "今回は省くか、抽選で指定された常連化の一言に差し替える" },
  { pattern: /あなたのことが[、]?(私は)?とても大切/, level: "track", reason: "常連化の定型文", fix: "省くか別の言い回しに" },
  { pattern: /明日もこの枠が残っている保証/, level: "track", reason: "枠切迫の定型文（禁止）", fix: "抽選で指定された希少性の型（先着順／人数限り／受付縮小 等）に従う" },
  { pattern: /毎日数十件のお申し込み/, level: "track", reason: "枠切迫の定型句", fix: "希少性の型を変える" },
  { pattern: /追(う|いかける|いかけ)の?をやめ.{0,20}途端/, level: "track", reason: "社会的証明の決まり文句「追うのをやめた途端」（言い換え含む）", fix: "きっかけ→行動→結果の筋が通る具体に書き換える" },
  { pattern: /受け取る準備ができた/, level: "track", reason: "魂の正当化の定型（4回に1回のみ。抽選指定が「使わない」なら fail）", fix: "採用した選民フックの切り口で正当化する" },
  { pattern: /その証拠に、?守護天使様/, level: "warn", reason: "「その証拠に」が何の証拠か繋がらない接続（意味不明）", fix: "「守護天使様が今、このカードを運んでくださいました」だけにするか、別の演出に" },
  { pattern: /結婚の話まで進/, level: "track", reason: "実績表現の使い回し", fix: "別の具体（何が・どう変わった）に" },
  { pattern: /[0-9０-９三]週間ほどで/, level: "track", reason: "時期の言い回しの使い回し", fix: "期間・言い回しを変える" },
  { pattern: /無駄になってしまう|無駄にしてほしくない/, level: "track", reason: "終盤の汎用句（脈絡なく挟まない）", fix: "心配の内容を本編のカード・訴求から導く" },
  { pattern: /置かれている状況も、まるで違|条件も、あなた自身も/, level: "track", reason: "前回台本の文の流用", fix: "別の言い回しに" },
  { pattern: /そっと棚に戻し/, level: "fail", reason: "金運の定番シーン「値札を見て棚に戻す」の使い回し（テーマ不整合の温床）", fix: "テーマに合う言い当てシーンに差し替える" },
  { pattern: /朝日と夕暮れ/, level: "fail", reason: "対比比喩のデフォルト（禁止）", fix: "抽選で指定された対比の比喩に従う" },
  { pattern: /諦めていた臨時収入|止まっていた入金/, level: "fail", reason: "曖昧で意味の取れない実績表現（禁止）", fix: "何が・どう変わったかの具体（例: 問い合わせが月1件→5件）に" },
  { pattern: /シャッフルの手が|シャッフルの途中/, level: "fail", reason: "録画解説調の演出（禁止）", fix: "「お、この1枚出ましたね」等、その場で引いている言い方に" },
  { pattern: /箱から飛び出/, level: "fail", reason: "シャッフルと矛盾する演出（禁止）", fix: "束から現れる言い方に" },
  { pattern: /心に入れた/, level: "fail", reason: "造語的で意味の取れない表現（禁止）", fix: "「大切に思った」等の普通の言葉に" },
  { pattern: /問いかけさせてください/, level: "warn", reason: "書き言葉（話し言葉に）", fix: "「ひとつ聞いてもいいですか」" },
  { pattern: /受け取る準備ができた[」』]と告げた/, level: "warn", reason: "魂の正当化の定型（3〜4回に1回のみ）", fix: "採用した選民フックの切り口に合わせた正当化に" },
  { pattern: /[0-9０-９]+パーセントもいない/, level: "track", reason: "中盤フック「上位◯%」の使い回し", fix: "別の中盤フックの型に" },
  { pattern: /朝からそわそわ/, level: "track", reason: "熱量表現の使い回し", fix: "別の熱量表現に" },
  { pattern: /本来のあなたに戻る/, level: "track", reason: "波長合わせ型が抽選された回のみ可", fix: "他の型なら言い換える" },
  { pattern: /頭では(もう)?答えが出ているのに/, level: "track", reason: "前回台本の文の流用", fix: "別の言い回しに" },
  { pattern: /執着を手放しなさい/, level: "track", reason: "仮想敵「占い師テンプレ型」の定型", fix: "抽選で指定された仮想敵に従う" },
];

function excerpt(script: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  return script.slice(Math.max(0, i - 25), Math.min(script.length, i + (m[0]?.length || 0) + 25)).replace(/\s+/g, " ");
}

export function scanBlacklist(script: string): QualityCheckItem[] {
  const items: QualityCheckItem[] = [];
  for (const rule of QC_BLACKLIST) {
    if (rule.level === "track") continue; // 繰り返し管理は scanConsecutive で判定
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

// 繰り返し表現の連続判定: 「合格した台本」だけを使用済みとみなし、直近2本の合格台本の両方で使っていた表現を今回も使う＝3連続 → fail。2連続まではOK
export function scanConsecutive(script: string, approvedScripts: string[]): QualityCheckItem[] {
  const prev = (approvedScripts || []).slice(0, 2);
  if (prev.length < 2) return [];
  const items: QualityCheckItem[] = [];
  for (const rule of QC_BLACKLIST) {
    if (rule.level !== "track") continue;
    const m = script.match(rule.pattern);
    if (!m) continue;
    if (prev.every((t) => rule.pattern.test(t))) {
      items.push({
        name: `3本連続の表現: 「${m[0]}」`,
        status: "fail",
        comment: `直近2本の合格台本で続けて使った表現を、今回も使っています（${rule.reason}）。該当: …${excerpt(script, m)}…`,
        suggestion: rule.fix || "別の言い回し・別の型に変える",
      });
    }
  }
  return items;
}

// 絵柄の捏造検出（機械）: 開示カードの本文パートに「視線・表情・向き」の描写があるのに、公式絵柄にその記載が無い場合
const VISUAL_CLAIM_WORDS = ["視線", "目は", "目が", "伏し目", "見つめ", "微笑", "笑って", "笑顔", "涙", "表情", "顔を", "背を向け", "振り返", "俯い", "うつむ", "見上げ", "見下ろ"];
const IMG_COVER_WORDS = ["目", "視線", "表情", "顔", "笑", "涙", "背", "振り返", "俯", "うつむ", "見つめ", "見上げ", "見下ろ"];
export function scanImageryClaims(script: string, cards: { name: string; img?: string }[]): QualityCheckItem[] {
  if (!cards.length) return [];
  const t = script.replace(/\s+/g, "");
  // 各カードの開示位置
  const positions = cards.map((c) => {
    const re = new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".{0,14}?(正位置|逆位置)");
    const m = t.match(re);
    return { ...c, pos: m && m.index !== undefined ? m.index : -1 };
  }).filter((c) => c.pos >= 0).sort((a, b) => a.pos - b.pos);
  const items: QualityCheckItem[] = [];
  positions.forEach((c, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].pos : Math.min(t.length, c.pos + 1500);
    const passage = t.slice(c.pos, end);
    // 「カード／絵／女性／人物／描かれ」の近くにある視線・表情語だけを対象（視聴者の描写は除外）
    const cardish = /(カード|絵|この(女性|男性|人物|王|農夫|子ども)|描かれ|見てください)/;
    for (const w of VISUAL_CLAIM_WORDS) {
      const idx = passage.indexOf(w);
      if (idx < 0) continue;
      const around = passage.slice(Math.max(0, idx - 60), idx + 30);
      if (!cardish.test(around)) continue;
      const img = c.img || "";
      if (IMG_COVER_WORDS.some((cw) => img.includes(cw))) continue;
      items.push({
        name: `絵柄の捏造の疑い: ${c.name}「${w}」`,
        status: "warn",
        comment: `${c.name}のパートで人物の視線・表情・向きを語っていますが、公式の絵柄記載にその要素がありません。該当: …${around.replace(/\s+/g, " ")}…`,
        suggestion: "絵柄に記載の無い視線・表情・向きは語らない（メタファーに合わせた捏造）。記載の要素だけで語るか、視聴者側の話として言う",
      });
      break;
    }
  });
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
    name: `合格済み台本と同一の文（${hits.length}件）`,
    status: hits.length >= 3 ? "fail" : "warn",
    comment: hits.map((h) => `「${h.slice(0, 60)}${h.length > 60 ? "…" : ""}」`).join(" ／ "),
    suggestion: "前回の文をそのまま流用せず、言い回し・具体を変える（同じ訴求でも文は毎回書き換える）",
  }];
}

// カード枚数の整合: 本文で開示した枚数 vs 冒頭等で言った「◯枚」
export function scanCardCount(script: string, revealed: { count: number; cards: string[] }): QualityCheckItem[] {
  if (revealed.count === 0) return [];
  const t = script.replace(/\s+/g, "");
  const stated: number[] = [];
  for (const m of t.matchAll(/([0-9０-９]+)枚(?:のカード|を引|引き|を順番|で構成)/g)) stated.push(parseInt(m[1].replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d))), 10));
  let maxOrdinal = 0;
  for (const m of t.matchAll(/([0-9０-９]+)枚目/g)) { const n = parseInt(m[1].replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d))), 10); if (n > maxOrdinal) maxOrdinal = n; }
  const items: QualityCheckItem[] = [];
  const statedMax = stated.length ? Math.max(...stated) : 0;
  if (statedMax) {
    items.push({ name: `枚数を言っている（「${statedMax}枚」）`, status: statedMax !== revealed.count ? "fail" : "warn",
      comment: `枚数は言わない方針です（実際に開示したカード: ${revealed.cards.join("・")}＝${revealed.count}枚${statedMax !== revealed.count ? "。しかも数が合っていません" : ""}）`,
      suggestion: "「今日は◯枚引きます」等の枚数の言及を削除し、「この動画で何が明らかになるか／最後まで見るとどうなるか」の予告にする" });
  }
  if (maxOrdinal && maxOrdinal !== revealed.count) {
    items.push({ name: `番号の不整合（最大「${maxOrdinal}枚目」、開示は${revealed.count}枚）`, status: "fail",
      comment: `「◯枚目」の最大が${maxOrdinal}なのに、実際に開示したカードは${revealed.count}枚です（番号外の「もう一枚」がある可能性）`,
      suggestion: `全カードに1〜${revealed.count}枚目の連番を振る` });
  }
  return items;
}

// 「◯枚目」を同じ番号で2回宣言（宣言→脱線→再宣言）
export function scanDuplicateAnnouncements(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const seen = new Map<number, number>();
  const dup: number[] = [];
  for (const m of t.matchAll(/(?:最後の)?([0-9０-９]+)枚目(?:です|にいき|、いき|を引|をめく|。)/g)) {
    const n = parseInt(m[1].replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d))), 10);
    const pos = m.index ?? 0;
    if (seen.has(n) && pos - (seen.get(n) || 0) >= 150 && !dup.includes(n)) dup.push(n);
    if (!seen.has(n)) seen.set(n, pos);
  }
  if (dup.length === 0) return [];
  return [{ name: `カード宣言の重複（${dup.map((n) => `${n}枚目`).join("・")}）`, status: "fail",
    comment: "同じ番号のカードを2回宣言しています（宣言→脱線→もう一度宣言）。宣言したら脱線せずにそのカードを開示する",
    suggestion: "2回目の宣言を削除し、挟んでいた話はカード開示と意味説明の後に移す" }];
}

// 抽選指定との機械照合（文字列で判定できるものだけ）
export function scanDrawSpecCompliance(script: string, drawSpec?: string): QualityCheckItem[] {
  if (!drawSpec) return [];
  const items: QualityCheckItem[] = [];
  if (/【魂の正当化（今回の指定）】[\s\S]{0,40}今回は使わない/.test(drawSpec) && /受け取る準備ができた|魂が告げ/.test(script)) {
    items.push({ name: "抽選指定違反: 魂の正当化", status: "fail", comment: "今回は「魂の正当化を使わない」指定なのに使っています", suggestion: "採用した選民フックの切り口で正当化に書き換える" });
  }
  if (/霊聴（未来の相手のセリフ）/.test(drawSpec) && !/守護天使様を通して/.test(script)) {
    items.push({ name: "霊聴の導入が指定どおりでない", status: "warn", comment: "相手のセリフを「その人からのメッセージが、守護天使様を通して伝わってきました」の導入なしで語っています", suggestion: "指定の導入文を付けてからセリフを置く" });
  }
  return items;
}

export function runMechanicalChecks(script: string, approvedScripts?: string[], opts?: { revealed?: { count: number; cards: string[] }; drawSpec?: string; imagery?: { name: string; img?: string }[] }): QualityCheckItem[] {
  return [
    ...scanBlacklist(script),
    ...scanConsecutive(script, approvedScripts || []),
    ...scanKanjiNumerals(script),
    ...findRepeatedSentences(script, approvedScripts || []),
    ...(opts?.revealed ? scanCardCount(script, opts.revealed) : []),
    ...scanDuplicateAnnouncements(script),
    ...scanDrawSpecCompliance(script, opts?.drawSpec),
    ...(opts?.imagery ? scanImageryClaims(script, opts.imagery) : []),
  ];
}
