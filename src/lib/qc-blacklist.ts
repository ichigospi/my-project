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
  { pattern: /コメントは.{0,4}全部読んで/, level: "track", reason: "常連化の定型文（3回に1回・抽選に従う）", fix: "今回は省くか、抽選で指定された常連化の一言に差し替える" },
  { pattern: /あなたのことが[、]?(私は)?とても大切/, level: "track", reason: "常連化の定型文", fix: "省くか別の言い回しに" },
  { pattern: /明日もこの枠が残っている保証/, level: "track", reason: "枠切迫の定型文（禁止）", fix: "抽選で指定された希少性の型（先着順／人数限り／受付縮小 等）に従う" },
  { pattern: /毎日数十件のお申し込み/, level: "track", reason: "枠切迫の定型句", fix: "希少性の型を変える" },
  { pattern: /追(う|いかける|いかけ)の?をやめ.{0,20}途端/, level: "track", reason: "社会的証明の決まり文句「追うのをやめた途端」（言い換え含む）", fix: "きっかけ→行動→結果の筋が通る具体に書き換える" },
  { pattern: /守護天使様に[、]?(はっきりと)?選ばれた一人/, level: "track", reason: "冒頭の選民宣言「選ばれた一人です」（型の1つ。2連続まで）", fix: "抽選で指定された冒頭の型（お待ちしてました型・既成事実型・直感型 等）に変える" },
  { pattern: /受け取る準備ができ/, level: "track", reason: "魂の正当化の定型（4回に1回のみ。抽選指定が「使わない」なら fail）", fix: "採用した選民フックの切り口で正当化する" },
  { pattern: /その証拠に、?守護天使様/, level: "warn", reason: "「その証拠に」が何の証拠か繋がらない接続（意味不明）", fix: "「守護天使様が今、このカードを運んでくださいました」だけにするか、別の演出に" },
  { pattern: /結婚の話まで進/, level: "track", reason: "実績表現の使い回し", fix: "別の具体（何が・どう変わった）に" },
  { pattern: /[0-9０-９三]週間ほどで/, level: "track", reason: "時期の言い回しの使い回し", fix: "期間・言い回しを変える" },
  { pattern: /無駄になってしまう|無駄にしてほしくない/, level: "track", reason: "終盤の汎用句（脈絡なく挟まない）", fix: "心配の内容を本編のカード・訴求から導く" },
  { pattern: /置かれている状況も、まるで違|条件も、あなた自身も/, level: "track", reason: "前回台本の文の流用", fix: "別の言い回しに" },
  { pattern: /そっと棚に戻し/, level: "fail", reason: "金運の定番シーン「値札を見て棚に戻す」の使い回し（テーマ不整合の温床）", fix: "テーマに合う言い当てシーンに差し替える" },
  { pattern: /朝日と夕暮れ/, level: "fail", reason: "対比比喩のデフォルト（禁止）", fix: "抽選で指定された対比の比喩に従う" },
  { pattern: /諦めていた臨時収入|止まっていた入金/, level: "fail", reason: "曖昧で意味の取れない実績表現（禁止）", fix: "何が・どう変わったかの具体（例: 問い合わせが月1件→5件）に" },
  { pattern: /シャッフルの手が|シャッフルの途中|シャッフル(を)?していたら/, level: "fail", reason: "録画解説調の演出（禁止）", fix: "「お、この1枚出ましたね」等、その場で引いている言い方に" },
  { pattern: /箱から飛び出/, level: "fail", reason: "シャッフルと矛盾する演出（禁止）", fix: "束から現れる言い方に" },
  { pattern: /心に入れた/, level: "fail", reason: "造語的で意味の取れない表現（禁止）", fix: "「大切に思った」等の普通の言葉に" },
  { pattern: /問いかけさせてください/, level: "warn", reason: "書き言葉（話し言葉に）", fix: "「ひとつ聞いてもいいですか」" },
  { pattern: /受け取る準備ができた[」』]と告げた/, level: "warn", reason: "魂の正当化の定型（3〜4回に1回のみ）", fix: "採用した選民フックの切り口に合わせた正当化に" },
  { pattern: /[0-9０-９]+パーセントもいない/, level: "track", reason: "中盤フック「上位◯%」の使い回し", fix: "別の中盤フックの型に" },
  { pattern: /朝からそわそわ/, level: "track", reason: "熱量表現の使い回し", fix: "別の熱量表現に" },
  { pattern: /本来のあなたに戻る/, level: "track", reason: "波長合わせ型が抽選された回のみ可", fix: "他の型なら言い換える" },
  { pattern: /頭では(もう)?答えが出ているのに/, level: "track", reason: "前回台本の文の流用", fix: "別の言い回しに" },
  { pattern: /執着を手放しなさい/, level: "track", reason: "仮想敵「占い師テンプレ型」の定型", fix: "抽選で指定された仮想敵に従う" },
  { pattern: /カードを([一二三四五六七八九十]|[0-9０-９]+)枚|([一二三四五六七八九十]|[0-9０-９]+)枚(のカード|引き|を引)/, level: "fail", reason: "枚数の明言（「カードを5枚引きます」等）は禁止", fix: "「カードを順番に引いていきます」のように枚数を言わない" },
  { pattern: /次のカードに映って|次のカードに聞いて|はっきり数字まで出し|本当に早く言いたかった|早くお伝えしたくて/, level: "fail", reason: "進行のメタ発言（鑑定士がこれから何をするかの説明・自分の気持ちの説明）", fix: "パート末は労いや共感で着地し、次のカードへは問いや感情でつなぐ" },
  { pattern: /腑に落ちやすく|奇跡は先に来る/, level: "fail", reason: "効果の捏造（押すとこうなる、と作った効果）", fix: "CTAの意味づけは世界観の中で一言に（守護天使様への合図／欠かせない儀式）" },
  { pattern: /頑張りを数え|頑張りを(一緒に)?数/, level: "fail", reason: "造語「頑張りを数える」は普段の会話で言わない", fix: "「どれだけ頑張ってきたか、ちゃんと分かってくれる人」のように普段の言葉で" },
  { pattern: /おめでとう.{0,4}が届(き|く)/, level: "fail", reason: "遠回しな訴求（おめでとうが届く）。理想の未来を直接の言葉で言い切る", fix: "「頑張りが報われて、奇跡がどんどん流れ込んでくる」のように直接言う" },
  { pattern: /受け取る側|受け取る番/, level: "fail", reason: "目的語のない「受け取る」（受け取る側／受け取る番）は一瞬で意味が取れない", fix: "何を受け取るのかを言う（奇跡を／臨時収入を／連絡を）" },
  { pattern: /そわそわ/, level: "track", reason: "導入の熱量表現「そわそわ」の使い回し", fix: "熱量の一文は毎回別の言い方にする" },
  { pattern: /答えの半分|残りの半分を.{0,6}カードで/, level: "fail", reason: "抽象フック（答えの半分）: 何が得られるか伝わらない冒頭は禁止", fix: "冒頭は視聴者が得るものを具体的に言う（実る時期に入った・奇跡が舞い込む等）" },
  { pattern: /最高の未来へ/, level: "fail", reason: "決め台詞の表記違い（正しくは「最幸の未来」）", fix: "「一緒に最幸の未来へと、一歩を踏み出していきましょう」" },
  { pattern: /あなたには.{0,25}(クセ|癖)があ/, level: "fail", reason: "欠点の断定（視聴者を責める言い方）", fix: "「〜してしまうこと、ありませんでしたか」の問いかけ形に" },
  { pattern: /見てください[。、]この(カード|絵)/, level: "fail", reason: "倒置（動詞を先に言って目的語を後から足す）", fix: "「このカードの〜を見てください」の語順に" },
  { pattern: /、と。/, level: "fail", reason: "引用の後置（「〜と言っています。〜、と。」の倒置）", fix: "引用を動詞の前に置く（「〜、と伝えているんです」）" },
  { pattern: /ここからが.{0,3}今日.{0,3}(一番|いちばん)大(事|切)/, level: "track", reason: "3枚目前の離脱防止句の使い回し", fix: "「次のカードから話が大きく変わります」等、別の言い回しに" },
  { pattern: /カードが.{0,4}決めるんじゃ/, level: "track", reason: "「早めるのも遅らせるのもカードが決めるんじゃない」型の使い回し", fix: "別の締め方に（例: 速さを決めるのは、あなたが顔を上げている時間の長さ）" },
  { pattern: /手のひらに.{0,4}吸い/, level: "track", reason: "引き演出「手のひらに吸い付く／吸い寄せられる」の使い回し", fix: "別の登場演出に" },
  { pattern: /ひとつだけ.{0,3}(心配|気がかり)なこと/, level: "track", reason: "終盤の橋渡し「ひとつだけ心配なことが」の使い回し", fix: "別の切り出しに（例: ひとつだけ、引っかかっていることがあって）" },
  { pattern: /自分を責めないで/, level: "track", reason: "深掘りの締め「当たっていたなら、自分を責めないでくださいね」の使い回し", fix: "別の肯定の締めに（例: 俯いていたのは、あなたが弱いからじゃないので）" },
  { pattern: /一人ひとり(全く|まったく)違/, level: "track", reason: "LINE導線「一人ひとり全く違っていて」の使い回し", fix: "別の言い回しに（例: ここは人によってまるで違うので）" },
  { pattern: /流し見/, level: "track", reason: "離脱防止「流し見しないで」型の使い回し", fix: "別の離脱防止の言い方に" },
  { pattern: /カードじゃな(く|い)/, level: "track", reason: "「決めるのはカードじゃなくてあなた」型の使い回し", fix: "型を外して具体例で言う" },
  { pattern: /すっと(前に)?.{0,4}(出てき|滑り出)/, level: "track", reason: "登場演出「この1枚だけすっと出てきた」の使い回し", fix: "別の登場演出に" },
  { pattern: /(ひとり|一人|お一人).{0,12}視て.{0,20}(限り|順番|順に)/, level: "track", reason: "枠切迫「一人ずつ視ているので限りがある／順番に」型の使い回し", fix: "待機人数型・毎日数十件型など別の型に、具体数を入れて" },
  { pattern: /弱いからじゃない|弱いからで(も|は)/, level: "track", reason: "労い「それはあなたが弱いからじゃない」の使い回し", fix: "労いの型を変える（例: 真剣に想ってきた証拠）" },
  { pattern: /当たっていた(なら|人|方)/, level: "track", reason: "言い当て直後の「当たっていたなら…」型の使い回し", fix: "別の受け方に（例: ここまで聞いて胸がちくっとした人）" },
  { pattern: /個別に.{0,12}視ないと.{0,6}分からない/, level: "track", reason: "LINE導線「個別に視ないと分からない領域」の使い回し", fix: "別の言い回しに（例: あなたの流れを直接視ないと言えません）" },
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
    // 「カード／絵／女性／人物／描かれ」が同じ文か直前の文にある視線・表情語だけを対象（視聴者の描写は除外）
    const cardish = /(カード|絵|この(女性|男性|人物|王|農夫|子ども)|描かれ|見てください)/;
    const sentences = passage.split(/(?<=[。！？!?])/);
    for (const w of VISUAL_CLAIM_WORDS) {
      let around = "";
      for (let si = 0; si < sentences.length && !around; si++) {
        // 「◯枚目は／◯枚目が」の「目は」「目が」は視線語ではないので除外
        const stripped = sentences[si].replace(/枚目/g, "枚");
        if (!stripped.includes(w)) continue;
        const scope = (si > 0 ? sentences[si - 1] : "") + sentences[si];
        // 視聴者に向けた文（「あなた」が主語）は対象外
        if (!cardish.test(scope) || (/あなた/.test(sentences[si]) && !cardish.test(sentences[si]))) continue;
        around = scope.slice(-90);
      }
      if (!around) continue;
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

// 無料鑑定の案内文で「守護天使様からのメッセージ」を約束していないか（有料領域）
export function scanFreeReadingScope(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const m = t.search(/無料の霊視鑑定|無料鑑定|概要欄のLINE|LINEから/);
  if (m < 0) return [];
  const tail = t.slice(Math.max(0, m - 150));
  const hit = tail.match(/守護天使様(から|の)(の)?メッセージ[^。]{0,30}(お伝え|届け|お届け|伝え)/);
  if (!hit) return [];
  return [{
    name: "無料鑑定の領域違反: 守護天使様からのメッセージ",
    status: "fail",
    comment: `無料鑑定の案内で「守護天使様からのメッセージ」を伝えると言っています（有料鑑定の領域）。該当: …${hit[0]}…`,
    suggestion: "無料鑑定で伝えるのは「時期（いつ動くか）」と「手段（具体的にどうするか）」。守護天使様からのメッセージは案内文から外す",
  }];
}

// 色の捏造検出: カードのパートで「黄色い／金色の／明るい色のカード」と言っているのに、公式絵柄にその色の記載が無い場合
export function scanColorClaims(script: string, cards: { name: string; img?: string }[]): QualityCheckItem[] {
  if (!cards.length) return [];
  const t = script.replace(/\s+/g, "");
  const positions = cards.map((c) => {
    const re = new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".{0,14}?(正位置|逆位置)");
    const m = t.match(re);
    return { ...c, pos: m && m.index !== undefined ? m.index : -1 };
  }).filter((c) => c.pos >= 0).sort((a, b) => a.pos - b.pos);
  const items: QualityCheckItem[] = [];
  positions.forEach((c, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].pos : Math.min(t.length, c.pos + 1500);
    const passage = t.slice(c.pos, end);
    const m = passage.match(/(黄色|金色|黄金色)(い|の)?(カード|絵)/);
    if (!m) return;
    if (/黄|金色|金の/.test(c.img || "")) return;
    items.push({
      name: `色の捏造の疑い: ${c.name}「${m[0]}」`,
      status: "warn",
      comment: `${c.name}のパートで色を運気の根拠にしていますが、公式の絵柄記載にその色がありません`,
      suggestion: "色の演出は、公式絵柄に黄色・金色の記載があるカードだけで使う（抽選ブロックの「色の演出」欄を参照）",
    });
  });
  return items;
}

// 漢数字（算用数字ルール）。慣用（一人・一方・一瞬・一度・一本 等）は対象外にし、数えの単位だけを見る
export function scanKanjiNumerals(script: string): QualityCheckItem[] {
  const re = /[一二三四五六七八九十百千]+(枚目|枚|週間|ヶ月|か月|カ月|日後|日以内|分後|時間後|パーセント|件|回目|万円|億円)|[三四五六七八九十]つ/g;
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
  if (/【冒頭の選民宣言の型（今回の指定・必達）】/.test(drawSpec) && !/【選ばれた型】/.test(drawSpec.split("【冒頭の選民宣言の型")[1]?.split("【選民・的中の追加演出")[0] || "") && /守護天使様に[、]?(はっきりと)?選ばれた一人/.test(script)) {
    items.push({ name: "抽選指定違反: 冒頭の選民宣言", status: "fail", comment: "今回は「選ばれた型」以外の冒頭が指定されているのに、「守護天使様に選ばれた一人です」で始めています", suggestion: "指定された冒頭の型に書き換える" });
  }
  if (/霊聴（未来の相手のセリフ）/.test(drawSpec) && !/守護天使様を通して/.test(script)) {
    items.push({ name: "霊聴の導入が指定どおりでない", status: "warn", comment: "相手のセリフを「その人からのメッセージが、守護天使様を通して伝わってきました」の導入なしで語っています", suggestion: "指定の導入文を付けてからセリフを置く" });
  }
  return items;
}

// 固定句の欠落: 最後のカードの「守護天使様が今、このカードを運んでくださいました」／決め台詞
export function scanFixedPhrases(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const items: QualityCheckItem[] = [];
  if (!/守護天使様が.{0,24}運んで/.test(t)) {
    items.push({ name: "固定句: 最後のカードの導入", status: "warn", comment: "「守護天使様が今、このカードをあなたのために運んでくださいました」が見当たりません", suggestion: "最後のカードの直前に固定句を入れる" });
  }
  if (!/最幸の未来/.test(t)) {
    items.push({ name: "固定句: 決め台詞", status: "warn", comment: "「一緒に最幸の未来へと、一歩を踏み出していきましょう」が見当たりません", suggestion: "締めの直前に決め台詞を入れる" });
  }
  return items;
}

export function runMechanicalChecks(script: string, approvedScripts?: string[], opts?: { revealed?: { count: number; cards: string[] }; drawSpec?: string; imagery?: { name: string; img?: string }[] }): QualityCheckItem[] {
  return [
    ...scanBlacklist(script),
    ...scanConsecutive(script, approvedScripts || []),
    ...scanKanjiNumerals(script),
    ...scanFixedPhrases(script),
    ...scanFreeReadingScope(script),
    ...findRepeatedSentences(script, approvedScripts || []),
    ...(opts?.revealed ? scanCardCount(script, opts.revealed) : []),
    ...scanDuplicateAnnouncements(script),
    ...scanDrawSpecCompliance(script, opts?.drawSpec),
    ...(opts?.imagery ? scanImageryClaims(script, opts.imagery) : []),
    ...(opts?.imagery ? scanColorClaims(script, opts.imagery) : []),
  ];
}
