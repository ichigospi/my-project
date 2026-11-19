// 品質チェックの「機械判定」: AIの主観に頼らず、文字列で検出できる違反を確実に拾う。
// - 禁止した定型文（毎回出る決まり文句）
// - 漢数字（算用数字ルール）
// - 直近の台本との同一文（前回の文の流用）
import type { QualityCheckItem } from "@/lib/project-store";
import { getScriptBanks, extractDrawnCards, extractCardsFromProse } from "@/lib/tarot-draw";

// level: fail=常に禁止（意味不明・ルール違反）／warn=注意／track=繰り返し管理（合格した直近2本の両方で使っていたら3連続→fail。2連続まではOK）
export interface BlacklistRule { pattern: RegExp; level: "fail" | "warn" | "track"; reason: string; fix?: string }

export const QC_BLACKLIST: BlacklistRule[] = [
  { pattern: /加護を[、]?(確かに)?受け取ります/, level: "fail", reason: "軽CTAの意味づけが「守護天使様の加護を受け取る合図」のデフォルト（禁止）", fix: "その動画のコンセプト語（扉・周波数・天秤 等）から意味づけを作る。高評価＝チューニング、コメント＝宣言、のように役割を分ける" },
  { pattern: /言い当て(させ)?ても(いい|よろしい)(ですか|でしょうか)/, level: "fail", reason: "言い当ての前置き「あなたのことを言い当ててもいいですか」（禁止。わざとらしく、視聴者に許可を求める形になる）", fix: "前置きなしで場面から入る（「人と会った帰り道、玄関のドアを閉めた瞬間に、どっと疲れが出ることがありませんか」）" },
  { pattern: /違いますか[？?。、]/, level: "fail", reason: "言い当ての確認形「違いますか？」（禁止。詰問に聞こえる）", fix: "確認は「〜ことがありませんか」「〜はずです」の形で。確認そのものを置かなくてもよい" },
  { pattern: /これ、?本当なんです/, level: "track", reason: "打ち明け口調「これ、本当なんですよ」（毎回入れる決まり文句ではない。2連続まで）", fix: "温度は別の手段で出す（感嘆符つきの口コミ、縮約、呼びかけ）。この句は省く" },
  { pattern: /あなただけのための無料の霊視鑑定/, level: "fail", reason: "LINE誘導の定型文（禁止。「行っています」「お受けしています」等、後ろの言い回しを変えても同じ）", fix: "動画の内容に接続した言い回しに（例:「あなたの場合はどうなのか、概要欄のLINEから友だち追加してくれたら、一人ずつ無料で視ています」）" },
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
  { pattern: /本当に早く言いたかった|早くお伝えしたくて/, level: "track", reason: "導入で中身の前に置く自己満足の一言（使い回し注意）", fix: "導入では中身を先に。強調は「いちばん言いたいところ」の直前に" },
  { pattern: /腑に落ちやすく|奇跡は先に来る/, level: "fail", reason: "効果の捏造（押すとこうなる、と作った効果）", fix: "CTAの意味づけは世界観の中で一言に（守護天使様への合図／欠かせない儀式）" },
  { pattern: /頑張りを数え|頑張りを(一緒に)?数/, level: "fail", reason: "造語「頑張りを数える」は普段の会話で言わない", fix: "「どれだけ頑張ってきたか、ちゃんと分かってくれる人」のように普段の言葉で" },
  { pattern: /おめでとう.{0,4}が届(き|く)/, level: "fail", reason: "遠回しな訴求（おめでとうが届く）。理想の未来を直接の言葉で言い切る", fix: "「頑張りが報われて、奇跡がどんどん流れ込んでくる」のように直接言う" },
  { pattern: /受け取る側/, level: "fail", reason: "目的語のない「受け取る側」は一瞬で意味が取れない", fix: "何を受け取るのかを言う（奇跡を／臨時収入を／連絡を）" },
  { pattern: /守護天使様(は|が|から)[^。]{0,40}(やってほしい|言っています|言ってます|伝えています|おすすめ|(と|って)(伝え|言っ|教え|おっしゃ|告げ|示し)(て|っ)?(くださ|います|てます|ている|てくれ|ていま))/, level: "fail", reason: "本編のアドバイスを守護天使様に帰属させている（無料で守護天使様のメッセージを渡したことになる）", fix: "アドバイスはアリサの言葉か「カードが示している」で言う。守護天使様を主語にするのは固定句と導入の正当化だけ" },
  { pattern: /指に残って|指先が選|指が選|手に吸い付|切り直そうとしたら|手が(ふっと)?止ま(った|り)(んです|ました)?。?[^。]{0,12}(出たのは|この1枚|このカード)/, level: "fail", reason: "鑑定士の手・指の動作を根拠にした引き演出（神秘性が弱い。カード側を主語にする）", fix: "「この1枚、自分から出てきました」「一番上で待っていました」のようにカード・流れを主語に" },
  { pattern: /(この|今日(は|の|引いた)?|引いた|全部で)[2-9２-９二三四五六七]枚(?!目)/, level: "fail", reason: "枚数の明言（「今日この5枚が」「今日引いた5枚」等）は禁止", fix: "「今日のカードが」「引いたカード全部が」のように枚数を言わない" },
  { pattern: /そわそわ/, level: "track", reason: "導入の熱量表現「そわそわ」の使い回し", fix: "熱量の一文は毎回別の言い方にする" },
  { pattern: /答えの半分|残りの半分を.{0,6}カードで/, level: "fail", reason: "抽象フック（答えの半分）: 何が得られるか伝わらない冒頭は禁止", fix: "冒頭は視聴者が得るものを具体的に言う（実る時期に入った・奇跡が舞い込む等）" },
  { pattern: /ふっと/, level: "fail", reason: "「ふっと」は普段の会話で使わない（連絡・通知は擬音と物で映像にする）", fix: "連絡なら「ピコンとスマホに連絡が届く」、息なら「深く息をつく」のように、連想しやすい言い方に" },
  { pattern: /(向き合う|向き合い直す|手放す|変わる)覚悟(が|を|は)/, level: "fail", reason: "覚悟の対象が難易度の高いもの（本当の覚悟に聞こえて視聴者が離れる）", fix: "「結ばれる覚悟」「溺愛される覚悟」「奇跡を迎える覚悟」のように、覚悟と言いつつ中身がメリットになる言い方に" },
  { pattern: /最幸の未来へと、?一歩を踏み出し/, level: "track", reason: "決め台詞は2〜3本に1本のローテーション（毎回入れると飽きられる）", fix: "今回は別の結びに（例: 「あなたの恋は、まもなく大逆転の時を迎えます。私には、もう視えていますからね」）" },
  { pattern: /「?あの日」?(というの)?が、?(まさに)?今日/, level: "track", reason: "既成事実の締め「あの日が今日」の使い回し", fix: "「その分岐点が、まさに今日です」等、言い方を変えるか今回は省く" },
  { pattern: /最初にお伝えしたこと、覚えていますか/, level: "track", reason: "冒頭の予言を全文引用で回収する型の使い回し", fix: "今回は回収を省くか、短い一言で（「3日後、楽しみにしていてくださいね」）" },
  { pattern: /それでは、ここから。/, level: "track", reason: "決め台詞前の切り出しの使い回し", fix: "省く" },
  { pattern: /最高の未来へ/, level: "fail", reason: "決め台詞の表記違い（正しくは「最幸の未来」）", fix: "「一緒に最幸の未来へと、一歩を踏み出していきましょう」" },
  { pattern: /あなたには.{0,25}(クセ|癖)があ/, level: "fail", reason: "欠点の断定（視聴者を責める言い方）", fix: "「〜してしまうこと、ありませんでしたか」の問いかけ形に" },
  { pattern: /見てください[。、]この(カード|絵)/, level: "fail", reason: "倒置（動詞を先に言って目的語を後から足す）", fix: "「このカードの〜を見てください」の語順に" },
  { pattern: /、と。/, level: "fail", reason: "引用の後置（「〜と言っています。〜、と。」の倒置）", fix: "引用を動詞の前に置く（「〜、と伝えているんです」）" },
  { pattern: /ここからが.{0,3}今日.{0,3}(一番|いちばん)大(事|切)/, level: "warn", reason: "3枚目前の離脱防止句「ここからが今日一番大事」（バンクから外した言い回し。読点を挟んでも同じ）", fix: "「次のカードから話が大きく変わります」等、別の言い回しに" },
  { pattern: /カードが.{0,4}決めるんじゃ/, level: "track", reason: "「早めるのも遅らせるのもカードが決めるんじゃない」型の使い回し", fix: "別の締め方に（例: 速さを決めるのは、あなたが顔を上げている時間の長さ）" },
  { pattern: /手のひらに.{0,4}吸い/, level: "track", reason: "引き演出「手のひらに吸い付く／吸い寄せられる」の使い回し", fix: "別の登場演出に" },
  { pattern: /ひとつだけ.{0,3}(心配|気がかり)なこと/, level: "track", reason: "終盤の橋渡し「ひとつだけ心配なことが」の使い回し", fix: "別の切り出しに（例: ひとつだけ、引っかかっていることがあって）" },
  { pattern: /自分を責めないで/, level: "track", reason: "深掘りの締め「当たっていたなら、自分を責めないでくださいね」の使い回し", fix: "別の肯定の締めに（例: 俯いていたのは、あなたが弱いからじゃないので）" },
  { pattern: /一人ひとり(全く|まったく)違/, level: "track", reason: "LINE導線「一人ひとり全く違っていて」の使い回し", fix: "別の言い回しに（例: ここは人によってまるで違うので）" },
  { pattern: /流し見/, level: "track", reason: "離脱防止「流し見しないで」型の使い回し", fix: "別の離脱防止の言い方に" },
  { pattern: /カードじゃな(く|い)/, level: "track", reason: "「決めるのはカードじゃなくてあなた」型の使い回し", fix: "型を外して具体例で言う" },
  { pattern: /すっと(前に)?.{0,4}(出てき|滑り出)/, level: "track", reason: "登場演出「この1枚だけすっと出てきた」の使い回し", fix: "別の登場演出に" },
  { pattern: /(ひとり|一人|お一人|[1１]人).{0,12}視て.{0,20}(限り|順番|順に)/, level: "track", reason: "枠切迫「一人ずつ視ているので限りがある／順番に」型の使い回し", fix: "待機人数型・毎日数十件型など別の型に、具体数を入れて" },
  { pattern: /弱いからじゃない|弱いからで(も|は)/, level: "track", reason: "労い「それはあなたが弱いからじゃない」の使い回し", fix: "労いの型を変える（例: 真剣に想ってきた証拠）" },
  { pattern: /当たっていた(なら|人|方)/, level: "track", reason: "言い当て直後の「当たっていたなら…」型の使い回し", fix: "別の受け方に（例: ここまで聞いて胸がちくっとした人）" },
  { pattern: /個別に.{0,12}視ないと.{0,6}分からない/, level: "track", reason: "LINE導線「個別に視ないと分からない領域」の使い回し", fix: "別の言い回しに（例: あなたの流れを直接視ないと言えません）" },
];

function excerpt(script: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  return script.slice(Math.max(0, i - 25), Math.min(script.length, i + (m[0]?.length || 0) + 25)).replace(/\s+/g, " ");
}
// 該当箇所を「文ごと」返す（修正の find にそのまま使えるように、前後を省略しない）。長すぎる場合だけ末尾を切る
function sentenceAt(script: string, index: number, len: number): string {
  let s = index; while (s > 0 && !/[。！？!?\n]/.test(script[s - 1])) s--;
  let e = index + len;
  // 一致部分が句点で終わっていればそこが文末。そうでなければ次の句点まで延ばす
  if (!/[。！？!?]/.test(script[e - 1] || "")) {
    while (e < script.length && !/[。！？!?\n]/.test(script[e])) e++;
    if (e < script.length && /[。！？!?]/.test(script[e])) e++;
  }
  // 短すぎる文は find として曖昧になるので、直前の文も含める
  if (e - s < 15 && s > 0) { let s2 = s - 1; while (s2 > 0 && !/[。！？!?\n]/.test(script[s2 - 1])) s2--; s = s2; }
  const sent = script.slice(s, e).replace(/\s+/g, " ").trim();
  return sent.length > 140 ? sent.slice(0, 140) + "…" : sent;
}
// パターンの全出現を文ごとに列挙（最大 max 件）。1つだけ直して残りが残る＝同じ不合格が繰り返される、を防ぐ
function allSentences(script: string, pattern: RegExp, max = 5): { count: number; sentences: string[] } {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const sentences: string[] = [];
  let count = 0;
  for (const m of script.matchAll(re)) {
    count++;
    const sent = sentenceAt(script, m.index ?? 0, m[0].length);
    if (sentences.length < max && !sentences.includes(sent)) sentences.push(sent);
  }
  return { count, sentences };
}
function listSentences(found: { count: number; sentences: string[] }): string {
  return `該当${found.count > 1 ? `（${found.count}箇所。全部直す）` : ""}:\n${found.sentences.map((s) => `「${s}」`).join("\n")}${found.count > found.sentences.length ? `\n（他${found.count - found.sentences.length}箇所）` : ""}`;
}

export function scanBlacklist(script: string): QualityCheckItem[] {
  const items: QualityCheckItem[] = [];
  for (const rule of QC_BLACKLIST) {
    if (rule.level === "track") continue; // 繰り返し管理は scanConsecutive で判定
    const m = script.match(rule.pattern);
    if (!m) continue;
    const found = allSentences(script, rule.pattern);
    items.push({
      name: `定型文: 「${m[0]}」${found.count > 1 ? `（${found.count}箇所）` : ""}`,
      status: rule.level,
      comment: `${rule.reason}。${listSentences(found)}`,
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
      const found = allSentences(script, rule.pattern);
      items.push({
        name: `3本連続の表現: 「${m[0]}」${found.count > 1 ? `（${found.count}箇所）` : ""}`,
        status: "fail",
        comment: `直近2本の合格台本で続けて使った表現を、今回も使っています（${rule.reason}）。${listSentences(found)}`,
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
    const passage = t.slice(c.pos, end).replace(/目が覚め/g, "");  // 「朝、目が覚めた瞬間」は視線の描写ではない
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
  // 中盤にも1文のLINE誘導を置ける運用なので、LINE言及ごとに前後の窓だけを調べる（本編まで巻き込まない）
  const positions = allIndexes(t, /無料の霊視鑑定|無料鑑定|概要欄のLINE|LINEから/g);
  if (positions.length === 0) return [];
  let hit: RegExpMatchArray | null = null;
  for (const m of positions) {
    const win = t.slice(Math.max(0, m - 150), m + 600);
    hit = win.match(/守護天使様(から|の)(の)?メッセージ[^。]{0,30}(お伝え|届け|お届け|伝え)/);
    if (hit) break;
  }
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
    const passage = t.slice(c.pos, end).replace(/目が覚め/g, "");  // 「朝、目が覚めた瞬間」は視線の描写ではない
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
  // 固定句（毎回同じでよい文）は対象外
  const FIXED = /守護天使様が今、このカードをあなたのために運んでくださいました|一緒に、?最幸の未来へと|またここで、お会いしましょうね|アリサの引き寄せ部屋へようこそ/;
  const mine = split(script).filter((s) => !FIXED.test(s));
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
      suggestion: `全カードに1〜${revealed.count}枚目の連番を振る。カードを削除して数を合わせるのは禁止` });
  }
  return items;
}

// 設計（抽選ブロック）のカード枚数より、本文で開示したカードが少ない＝カードが減っている。減らす修正は禁止（合わないカードは差し替える）
export function scanMissingPlannedCards(script: string, drawSpec: string | undefined, revealed: { count: number; cards: string[] }): QualityCheckItem[] {
  if (!drawSpec || revealed.count === 0) return [];
  const planned = Array.from(drawSpec.matchAll(/(\d)枚目[:：]\s*([^（\n]+?)（(正位置|逆位置)）/g)).map((m) => m[2].trim());
  if (planned.length === 0 || revealed.count >= planned.length) return [];
  const missing = planned.filter((n) => !revealed.cards.includes(n));
  return [{
    name: `カードが減っている（設計${planned.length}枚→開示${revealed.count}枚）`,
    status: "fail",
    comment: `設計では${planned.length}枚（${planned.join("・")}）なのに、本文で開示しているのは${revealed.count}枚（${revealed.cards.join("・")}）です。${missing.length ? `本文に無いカード: ${missing.join("・")}。` : ""}カードを減らす修正は禁止です`,
    suggestion: "枚数は設計どおりに戻す。カードが流れに合わないなら、削除ではなく別のカードへの差し替え（カード名・向き・理由）を提案して枚数を維持する",
  }];
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
  // 抽選カード（＝骨組みで確定したカード）と本文のカードの食い違い（枚数・カード名・向き）
  const planned = extractDrawnCards(drawSpec);
  const actual = extractCardsFromProse(script);
  if (planned.length >= 3 && actual.length >= 3) {
    const diffs: string[] = [];
    if (planned.length !== actual.length) diffs.push(`枚数: 指定${planned.length}枚／本文${actual.length}枚`);
    const n = Math.max(planned.length, actual.length);
    for (let i = 0; i < n; i++) {
      const p = planned[i]; const a = actual[i];
      if (!p || !a) { diffs.push(`${i + 1}枚目: 指定「${p ? `${p.name}（${p.orientation}）` : "なし"}」／本文「${a ? `${a.name}（${a.orientation}）` : "なし"}」`); continue; }
      if (p.name !== a.name || p.orientation !== a.orientation) diffs.push(`${i + 1}枚目: 指定「${p.name}（${p.orientation}）」／本文「${a.name}（${a.orientation}）」`);
    }
    if (diffs.length > 0) {
      items.push({ name: `抽選指定と違うカード（${diffs.length}件）`, status: "fail",
        comment: `骨組みで確定したカードと本文のカードが食い違っています。\n${diffs.slice(0, 8).join("\n")}`,
        suggestion: "本文のカードを指定どおりの枚数・カード名・向きに直す（骨組みのカードが正。足したカードは外し、向きを取り違えたカードは読みごと直す）" });
    }
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
  const fixedAt = t.search(/守護天使様が.{0,24}運んで/);
  if (fixedAt < 0) {
    items.push({ name: "固定句: 最後のカードの導入", status: "warn", comment: "「守護天使様が今、このカードをあなたのために運んでくださいました」が見当たりません", suggestion: "最後のカードの直前に固定句を入れる" });
  } else {
    // 固定句は最後のカード専用。固定句の後（まとめより前）にまだ別のカードをめくっていたら、途中のカードで使っている
    let rest = t.slice(fixedAt);
    const sumAt = rest.search(/(カード|今日)のまとめ|振り返(り|っ)/);
    if (sumAt > 0) rest = rest.slice(0, sumAt);
    // 固定句の直後に「最後の1枚は、山の真ん中から…」と最後のカード自身の説明が続くのは正常なので、番号つきのカードだけを見る
    const later = rest.match(/([2-9２-９]枚目)(を|に|です|。|、|は)/);
    if (later) {
      items.push({ name: "固定句: 最後のカード以外で使用", status: "warn",
        comment: `「守護天使様が運んでくださった」の固定句の後に、まだ「${later[1]}」をめくっています。この句は最後のカードだけに使う決まりです（途中で使うと最後の重みが消える）`,
        suggestion: "途中のカードの格上げは別の言い方にし、固定句は最後のカードの直前に移す" });
    }
  }
  // 決め台詞「一緒に最幸の未来へと」は毎回入れないローテーション運用に変更（欠けていても指摘しない。3本連続は scanConsecutive で止める）
  return items;
}

// 正規表現の全ヒット位置
function allIndexes(t: string, re: RegExp): number[] {
  const out: number[] = [];
  const g = re.global ? re : new RegExp(re.source, re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(t)) !== null) { out.push(m.index); if (m[0].length === 0) g.lastIndex++; }
  return out;
}
// 終盤のLINE誘導の位置（最後の言及）。中盤に1文だけ置いた誘導は終盤扱いにしない
function lastLineMention(t: string): number {
  const idx = allIndexes(t, /概要欄のLINE|LINEから|無料の霊視鑑定|無料鑑定/g);
  return idx.length === 0 ? -1 : idx[idx.length - 1];
}

// 終盤の未知数が本編の予言と被っていないか: 本編で時期（◯日後／◯のつく日）を出した回は、無料鑑定の未知数に「いつ・時期」を使わない
export function scanUnknownsVsTiming(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const lineAt = lastLineMention(t);
  if (lineAt < 0) return [];
  const body = t.slice(0, lineAt);
  const tail = t.slice(Math.max(0, lineAt - 400));
  const timing = body.match(/[0-9０-９]+日後|[0-9０-９]+のつく日|[0-9０-９]+週間(後|以内)/);
  if (!timing) return [];
  const unknown = tail.match(/(いつ(その|連絡|動|来|訪|頃)|という「?時期|「時期」|時期(と|、|」)|タイミング(と|」|、))/);
  if (!unknown) return [];
  return [{
    name: "未知数が本編の予言と重複（時期）",
    status: "fail",
    comment: `本編で「${timing[0]}」と時期を出しているのに、無料鑑定の未知数に「${unknown[0]}」を使っています。本編の予言を自分で否定する形になります`,
    suggestion: "時期を出した回の未知数は「あなたの場合、どんな形で来るのか」と「最短で引き寄せるために何をすべきか」の2つにする",
  }];
}

// 終盤の未知数が本編で出した「どんな形で来るか」と被っていないか（形を3例出した回は未知数に「形」を使わない）
export function scanUnknownsVsForms(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const lineAt = lastLineMention(t);
  if (lineAt < 0) return [];
  const body = t.slice(0, lineAt);
  const tail = t.slice(Math.max(0, lineAt - 500));
  const gaveForms = /どんな形で(来る|届く|訪れる)か[^。]{0,40}(視え|3つ|三つ|ひとつは)/.test(body) || /ひとつは[^。]{0,60}。ひとつは[^。]{0,60}。もうひとつは/.test(body);
  if (!gaveForms) return [];
  const m = tail.match(/どんな形で(来る|届く|訪れる)のか|どんな形で(来る|届く|訪れる)か/);
  if (!m) return [];
  return [{
    name: "未知数が本編の予言と重複（形）",
    status: "fail",
    comment: `本編で「どんな形で来るか」を具体例つきで語っているのに、無料鑑定の未知数に「${m[0]}」を使っています`,
    suggestion: "未知数は「あなたの場合に何をすべきか（手段）」と「放置すると元の流れに戻るリスク」で組む",
  }];
}

// コメントCTAで書かせる言葉が、台本の中で食い違っていないか（例: 冒頭「叶いました」→終盤「残します」）
export function scanCommentWordConsistency(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const words = new Set<string>();
  for (const m of t.matchAll(/コメント欄?に「([^」]{1,20})」/g)) words.add(m[1]);
  for (const m of t.matchAll(/「([^」]{1,20})」と(先に|一言|だけ|そっと)?(コメント|書い)/g)) words.add(m[1]);
  const list = Array.from(words);
  if (list.length <= 1) return [];
  return [{
    name: `コメントCTAの文言が食い違い（${list.map((w) => `「${w}」`).join("・")}）`,
    status: "fail",
    comment: "書かせる言葉が台本の中で複数あります。視聴者は冒頭の言葉しか書いていないので、終盤の回収や常連化で別の言葉を出すと幻の文言になります",
    suggestion: "コメントCTAの文言は台本全体で1つに揃える（回収・常連化の一言も同じ言葉で）",
  }];
}

// CTA（高評価・コメント）の意味づけが「内面の変化」になっていないか。意味づけはテーマ・理想の未来に結ぶ（例外なし）
export function scanCtaMeaning(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const items: QualityCheckItem[] = [];
  const re = /高評価|コメント欄|チャンネル登録/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(t)) !== null) {
    const win = t.slice(m.index, Math.min(t.length, m.index + 220));
    const hit = win.match(/気持ち(の向き)?が(変わ|切り替わ|前を向|軽く|整)|前向きに(な|切り替)|心が(整|軽く|落ち着)|自分(の中|自身)が変わ/);
    if (hit && !seen.has(hit[0])) {
      seen.add(hit[0]);
      items.push({
        name: `CTAの意味づけが内面の変化（「${hit[0]}」）`,
        status: "fail",
        comment: `${m[0]}の意味づけが「${hit[0]}」と視聴者の内面の話になっています。本質ではなく、動画のテーマから外れます`,
        suggestion: "意味づけは理想の未来に結ぶ（例: 「叶った未来と今の現実との周波数が重なっていきます」「高次元の守護天使様への合図になります」）",
      });
    }
  }
  return items;
}

// 離脱防止の損失が「視聴者の内面の後退」になっていないか（損失はテーマのベネフィットが止まる側で言う）
export function scanRetentionLoss(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const head = t.slice(0, Math.min(t.length, 1800));
  const m = head.match(/(途中で(閉じ|離れ|止め)[^。]{0,40})(気持ち|心)が[^。]{0,20}(戻|冷め|沈|萎)/);
  if (!m) return [];
  return [{
    name: "離脱防止の損失が内面の後退",
    status: "fail",
    comment: `「${m[0].slice(0, 60)}」のように、閉じたときの損失を視聴者の気持ちの後退にしています（この動画のテーマではない）`,
    suggestion: "損失はセンターピン側で言う（例: 「恋の大逆転の流れがパタっと止まってしまうかもしれません」）。擬音で軽く、断定しない",
  }];
}

// 平熱の検出: 温度の目印（擬音・感嘆符・口語の縮約・「ですからね」等）が少なすぎる
export function scanTemperature(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  if (t.length < 1500) return [];
  // 温度の目印は「種類」で数える（擬音／感嘆符／縮約／口語の語尾／伸ばし音／問いかけ）。特定の決まり文句は目印にしない（入れれば通る、になって毎回同じ句が出るため）
  const markers = t.match(/[ァ-ヶ]{2,4}っ?と|[ァ-ヶ]{2,3}ン|ドキッ|きゅっ|ぐっすり|ずーっと|ずっーと|めちゃくちゃ|ちゃう|ちゃい|ちゃっ|じゃう|！|ですからね|ますからね|ですよね|でしょう？|ませんか|じゃないですか|なんですよ|だなー|なあ/g) || [];
  const per1000 = (markers.length / t.length) * 1000;
  if (per1000 >= 1.5) return [];
  return [{
    name: `平熱の疑い（温度の目印が${markers.length}個／${t.length}字）`,
    status: per1000 < 0.8 ? "fail" : "warn",
    comment: "擬音・感嘆符つきのセリフ・口語の縮約・呼びかけの語尾がほとんど無く、正しいが冷めた文になっています",
    suggestion: "口コミのセリフに「！」を入れる、場面の描写に擬音を入れる、「〜しちゃう」「〜ますからね」「〜ませんか」の口語を混ぜる。決まり文句（「これ、本当なんですよ」等）を足して済ませない。文そのものを話し言葉にする",
  }];
}

// 文章の癖の機械判定（語尾の偏り・接続語の連打・絵柄説明の定型・同語反復）
export function scanStyleHabits(script: string): QualityCheckItem[] {
  const items: QualityCheckItem[] = [];
  const t = script.replace(/\s+/g, "");
  const sentences = t.split(/(?<=[。！？!?])/).filter((x) => x.length > 3);
  const total = sentences.length || 1;
  const ndesu = sentences.filter((x) => /んです(よ|ね|よね)?[。！]$/.test(x)).length;
  const ratio = ndesu / total;
  if (ratio >= 0.3) {
    items.push({ name: `語尾の偏り: 「〜んです」止めが${Math.round(ratio * 100)}%`, status: ratio >= 0.4 ? "fail" : "warn",
      comment: `全${total}文のうち${ndesu}文が「んです／んですよ／んですね」で終わっています（目安: 25%以下）`,
      suggestion: "言い切り（〜ます／〜でした）、名詞止め、問いかけ（〜ませんか）、呼びかけ（〜してくださいね）を混ぜ、同じ語尾を3文続けない" });
  }
  const count = (re: RegExp) => (t.match(re) || []).length;
  const demone = count(/でもね/g);
  if (demone >= 4) items.push({ name: `接続語の連打: 「でもね」${demone}回`, status: demone >= 6 ? "fail" : "warn", comment: "逆接の切り出しが毎段落「でもね」になっています", suggestion: "「でもね」は台本全体で3回まで。「実は」「ところが」「本当は」や、接続語なしで文を始める" });
  const dash = count(/——/g);
  if (dash >= 12) items.push({ name: `ダッシュ（——）${dash}回`, status: "warn", comment: "ダッシュで文をつなぐ癖が強く、読み上げでは間が不自然になります", suggestion: "ダッシュは台本全体で5回以内。句点で切るか「、」でつなぐ" });
  const mite = count(/見てください/g);
  const honrai = count(/本来この絵|本来の絵は|本来この(カード|絵柄)は/g);
  if (mite >= 3 || honrai >= 2) items.push({ name: `絵柄説明の定型反復（見てください${mite}回／本来この絵${honrai}回）`, status: "fail", comment: "各カードの絵柄説明が同じ型で始まっています。絵柄は一言で止め、入り方を毎回変える", suggestion: "絵柄の説明は「絵柄の一言→意味→当てはめ」で1カード2文まで。「見てください」「本来この絵は」は1回ずつまで" });
  const gyaku = count(/逆さま[—、。]*逆位置で現れ|逆位置で現れ/g);
  if (gyaku >= 3) items.push({ name: `「逆位置で現れ」${gyaku}回`, status: "warn", comment: "逆位置の告げ方が毎回同じです", suggestion: "「逆さまでした」「上下が反対で出ました」「逆位置です」など言い方を変える" });
  // 「〜側」の口癖（縛られる側・回す側・背負う側・眺める側…）
  const gawa = count(/[^両片右左裏表内外相手]側(に|へ|で|から|の|です|でいい|に立|に回)/g);
  if (gawa >= 6) items.push({ name: `「〜側」${gawa}回`, status: "warn", comment: "「◯◯する側／◯◯される側」の対比が口癖になっています。多いと説教調に聞こえます", suggestion: "対比は1本で2〜3回まで。残りは具体的な場面や動作で言い換える" });
  // 同じ演出の出だし（「お、この1枚」「お、出ましたね」が2回以上）
  const oh = count(/(^|[。」！？])お、/g);
  if (oh >= 2) items.push({ name: `めくる演出の出だし「お、」${oh}回`, status: "warn", comment: "カードをめくる演出の出だしが同じです（同じ演出表現を1本で2回使うのは禁止）", suggestion: "2枚目以降は「あ…」「…ほら」「出ました」「これは…」など出だしを変える" });
  // 副詞の口癖（実は／本当は）。5回以上で注意（「ちゃんと」はオーナーの合格台本で10回使われている持ち味なので対象外）
  for (const [w, re] of [["実は", /実は/g], ["本当は", /本当は/g]] as [string, RegExp][]) {
    const n = count(re);
    if (n >= 5) items.push({ name: `口癖: 「${w}」${n}回`, status: "warn", comment: `「${w}」が${n}回出ています。読み上げると同じ言葉の繰り返しが目立ちます`, suggestion: `「${w}」は1本で3回まで。残りは削るか別の言い方に` });
  }
  const daiji = count(/(一番|いちばん)大事/g);
  if (daiji >= 2) items.push({ name: `「一番大事」${daiji}回`, status: "warn", comment: "最上級が複数あると価値が薄れます（「一番大切なカード」の予告は数えていません）", suggestion: "「一番大事」は台本全体で1回。他は「ここは大事」「ここから」に" });
  // 段落内の同語反復（2〜3字の語が同じ段落に4回以上）
  const paras = script.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ""));
  const repeated: string[] = [];
  for (const para of paras) {
    const freq = new Map<string, number>();
    for (const m of para.matchAll(/[一-龥]{2,3}/g)) freq.set(m[0], (freq.get(m[0]) || 0) + 1);
    for (const [w, n] of freq) {
      if (n >= 4 && !/^(あなた|自分|守護天使|天使様|カード|連絡|今日|相手|二人|関係|時間|本当|無料|鑑定|未来|気持|枚目|正位置|逆位置|最後)$/.test(w) && !repeated.includes(w)) repeated.push(`${w}×${n}`);
    }
  }
  if (repeated.length > 0) items.push({ name: `同じ語の反復（段落内4回以上）: ${repeated.slice(0, 5).join("、")}`, status: "warn", comment: "比喩の語が段落に居座り、現実の言葉に戻っていない可能性があります", suggestion: "比喩は1〜2回で現実の言葉（連絡・あの人・縁 等）に言い換える" });
  return items;
}

// ===== 全文チェック（台本全体にだけ適用。パート単位の採点では名前が「全文:」で始まる項目を除外する） =====

// 全文かどうかの目安: 3枚以上カードをめくっていて、終盤のLINE誘導がある
function looksLikeFullScript(t: string): boolean {
  const cards = (t.match(/[1-9１-９]枚目|最後の(1枚|カード)/g) || []).length;
  return cards >= 3 && lastLineMention(t) >= 0;
}

// コメントCTAの型の混在: 「宣言」と「予祝」の両方でコメントを意味づけていたら不合格（型と語形の一致ルール）
export function scanCommentCtaTypeMix(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const nearComment = (re: RegExp) => {
    for (const m of t.matchAll(/コメント/g)) {
      const win = t.slice(Math.max(0, m.index! - 160), m.index! + 220);
      if (re.test(win)) return true;
    }
    return false;
  };
  const sengen = nearComment(/宣言/);
  const yoshuku = nearComment(/予祝/) || /予祝/.test(t);
  if (!(sengen && yoshuku)) return [];
  return [{
    name: "コメントCTAの型が混在（宣言＋予祝）",
    status: "fail",
    comment: "コメントの意味づけに「宣言」と「予祝」の両方を使っています。宣言型は未来形（受け取ります）、予祝型は完了形（叶いました）で、別の型です。冒頭と終盤で呼び方を揃えてください",
    suggestion: "書かせる言葉が完了形なら冒頭から「予祝（先に叶った体で書く）」で一貫させる。未来形なら「宣言」で一貫させ、終盤で予祝の説明をしない",
  }];
}

// 終盤の「カードのまとめ」の欠落（必須: 1枚1文で振り返り→時期の再掲→「ただし」）
export function scanSummaryPresence(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  if (!looksLikeFullScript(t)) return [];
  // 「めくる」文脈の最後のカード（「6枚目です」「最後の1枚を」）。まとめの中の「5枚目のペンタクルは」は「の」が続くので数えない
  const idx = allIndexes(t, /(最後の(1枚|カード)|[5-9５-９]枚目)(です|を|、|。|にいき|めくり|引き)/g);
  const lastCard = idx.length > 0 ? idx[idx.length - 1] : -1;
  if (lastCard < 0) return [];
  const tail = t.slice(lastCard);
  // 「今日のカードのまとめです」「ここまでが、今日のカードの流れです」「1枚目は〜」のいずれか
  if (/(カード|今日)のまとめ|まとめ(です|ますね|ると|させて)|今日のカードの流れ|ここまでが、?今日の|おさらい|[1１]枚目(の|は|で|から)/.test(tail)) return [];
  return [{
    name: "全文: 終盤のカードのまとめが無い",
    status: "fail",
    comment: "最後のカードの後に「今日のカードのまとめ」（1枚目はこう、2枚目はこう、と1枚1文で振り返り、時期を再掲）が見当たりません。まとめ→「ただし」の放置リスク、の順が必須です",
    suggestion: "最後のカードの後に「最後に、今日のカードのまとめです。1枚目の◯◯は〜。2枚目の◯◯は〜。（全カード）早い人は◯日後から〜」を入れてから「ただし」に繋ぐ",
  }];
}

// 本編の時期の予言と、無料鑑定を受けた人の口コミの欠落（5枚目の役割）
export function scanBodyEssentials(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  if (!looksLikeFullScript(t)) return [];
  const items: QualityCheckItem[] = [];
  const lineAt = lastLineMention(t);
  const body = t.slice(0, lineAt);
  if (!/[0-9０-９]+日後|[0-9０-９]+のつく日|[0-9０-９]+週間(後|以内)|[0-9０-９]+か月(後|以内)|数日(後|で|のうち)/.test(body)) {
    items.push({ name: "全文: 本編に時期の予言が無い", status: "warn",
      comment: "本編に「◯日後」「◯のつく日」のような時期の予言がありません。時期は満足度と既成事実化の柱です（3段階で進める型が有効）",
      suggestion: "5枚目か最後のカードで「早い人は◯日後に小さな変化→◯日後に目に見える形→◯日で出揃う」と段階で出し、「日にちを数えて待たなくていい」を添える。出した場合、終盤の未知数に「時期」は使わない" });
  }
  if (!/鑑定を受け|鑑定の後|鑑定(した|させていただいた|させてもらった)方|鑑定で視|視させて(もらった|いただいた)方|視た方/.test(body)) {
    items.push({ name: "全文: 本編に無料鑑定を受けた人の口コミが無い", status: "warn",
      comment: "本編（5枚目あたり）に「無料鑑定を受けた方」の口コミが無く、終盤でしか鑑定に触れていません。本編の口コミは時期の予言の根拠にもなります",
      suggestion: "5枚目の毎日の変化の後に「無料鑑定を受けた◯◯さんは、◯日後に〜」の口コミを1つ置き、そこから時期へ繋ぐ" });
  }
  return items;
}

// 口コミ（体験談）の使い回し: 同じエピソードを1本の中で2回使っていないか（文字2-gramの重なりで判定）
export function scanRepeatedEpisode(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  // 「！」で切ると「〜なったんです！と教えてくださいました」の引用が分断されるので、句点だけで切る
  const sentences = t.split(/(?<=。)/).filter((s) => /(教えてくださ|報告|届きました|届いて|言ってくださ|連絡をくださ)/.test(s) && s.length >= 30);
  // 体験談の「中身の語」（カタカナ語・擬音・2字以上の漢字語）を取り出し、一般語を除く。3語以上重なれば同じエピソード扱い
  const GENERIC = /^(鑑定|報告|連絡|教え|以前|方々|最近|本当|自分|相手|関係|毎日|未来|今日|先日|実際|結果|状態|内容|無料|霊視|大切|最高|幸せ|変化|流れ|仕事|生活|気持|言葉|時間|人生|世界|環境|空気|職場|家族|友達|彼女|彼氏|お金|連絡|報告)$/;
  const tokens = (s: string) => new Set(Array.from(s.matchAll(/[ァ-ヶー]{2,}|[一-龥]{2,}/g), (m) => m[0]).filter((w) => !GENERIC.test(w)));
  const items: QualityCheckItem[] = [];
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const a = tokens(sentences[i]); const b = tokens(sentences[j]);
      const shared = Array.from(a).filter((w) => b.has(w));
      // 擬音・カタカナ語（ピコン・ガラッ 等）が重なっていれば2語で成立
      const hasKana = shared.some((w) => /^[ァ-ヶー]+$/.test(w));
      if (shared.length >= 3 || (hasKana && shared.length >= 2)) {
        items.push({ name: "口コミの使い回し（同じ体験談を2回）", status: "warn",
          comment: `同じエピソードを言い換えて2回使っています（共通の語: ${shared.slice(0, 5).join("・")}）。1本の中で体験談は1回ずつ。\n①${sentences[i].slice(0, 60)}…\n②${sentences[j].slice(0, 60)}…`,
          suggestion: "終盤の口コミは別の人・別の形の報告にする（冒頭が連絡系なら終盤は人間関係の変化系、等）" });
        return items;
      }
    }
  }
  return items;
}

// 既成事実化と「あなた次第」の衝突: 「結果はもう決まっている」と「早めるのも遅らせるのもあなた次第」を同じ台本で言わない
export function scanDestinyConflict(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const fixed = t.match(/(分かれ道|分岐点|結末|未来|結果)は、?(もう|すでに)決まって/);
  const yourCall = t.match(/(あなた|心の状態|選択)次第/);
  if (!fixed || !yourCall) return [];
  return [{
    name: "既成事実と「あなた次第」の衝突",
    status: "warn",
    comment: `「${fixed[0]}」と「${yourCall[0]}」が同じ台本にあります。結果を確定させる言い方と、速さは本人次第という言い方が矛盾します`,
    suggestion: "既成事実化は「流れに入った」「分岐点は今日」までにし、結果そのものを「決まっている」と言わない",
  }];
}

// 格上げの重ね使い: 「気配で分かっていた」「出ると分かっていた」型を1本で2回以上
export function scanAuthorityStack(script: string): QualityCheckItem[] {
  const t = script.replace(/\s+/g, "");
  const hits = t.match(/気配で分かって|出ると分かって|出ると.{0,8}分かっていた|分かっていたから.{0,10}(撮|録)/g) || [];
  if (hits.length < 2) return [];
  return [{
    name: `格上げの重ね使い（${hits.length}回）`,
    status: "warn",
    comment: `「${hits.join("」「")}」。カードが出ることを先に知っていた型の格上げが複数あります。2回目以降は嘘っぽさが増し、引く前に結果が分かっている理屈になります`,
    suggestion: "格上げは1本に1回。残りは削るか、別の型（シャッフル前に守護天使様から「待っている人がいる」と告げられた、等）に替える",
  }];
}

// ===== 同じ文が毎回出る問題への対策 =====

// 固定でよい文（挨拶・固定句・決め台詞）。丸写し・連続使用の判定から除く
const FIXED_LINES = /守護天使様が今、このカードをあなたのために運んでくださいました|一緒に、?最幸の未来へと|またここで、お会いしましょうね|アリサの引き寄せ部屋へようこそ|お待ちしてました/;
const norm = (s: string) => s.replace(/\s+/g, "");

// 抽選バンク・ルール本文の「例文」をそのまま使っていないか。例文は型の説明であって、台本に貼る文ではない
// - バンクの各項目を文に分け、18字以上の文を例文として採用。ルール本文からは「」内の18字以上を採用
export function scanVerbatimExamples(script: string, rules?: string, approvedScripts?: string[]): QualityCheckItem[] {
  const t = norm(script);
  const latest = norm((approvedScripts || [])[0] || "");
  const examples = new Set<string>();
  const addSentences = (text: string) => {
    for (const s of norm(text).split(/(?<=[。！？!?])/)) {
      const x = s.replace(/^[「『（(]+|[」』）)]+$/g, "").replace(/^【[^】]*】/, "").trim();
      if (x.length >= 18 && !FIXED_LINES.test(x)) examples.add(x);
    }
  };
  const addQuotes = (text: string) => {
    for (const m of text.matchAll(/「([^「」]{18,})」/g)) {
      const x = norm(m[1]);
      if (!FIXED_LINES.test(x)) { examples.add(x); addSentences(x); }
    }
  };
  try {
    for (const bank of getScriptBanks()) for (const item of bank.items) { addSentences(item); addQuotes(item); }
  } catch { /* バンクが読めない環境では省略 */ }
  if (rules) addQuotes(rules);
  const hits: string[] = [];
  for (const ex of examples) {
    if (t.includes(ex) && !hits.some((h) => h.includes(ex) || ex.includes(h))) hits.push(ex);
    if (hits.length >= 6) break;
  }
  if (hits.length === 0) return [];
  // 1〜2件は注意、3件以上は不合格。直前の合格台本でも同じ例文を使っていた（＝定着し始めている）場合は件数に関係なく不合格
  const repeated = hits.filter((h) => latest.includes(h));
  const status: "fail" | "warn" = hits.length >= 3 || repeated.length > 0 ? "fail" : "warn";
  return [{
    name: `例文の丸写し（${hits.length}件${repeated.length > 0 ? `・うち${repeated.length}件は前回も使用` : ""}）`,
    status,
    comment: `抽選ブロック・ルールの例文をそのまま使っています。例文は「型」の説明で、台本に貼る文ではありません。毎回同じ文が出る原因です。\n${hits.map((h) => `「${h.slice(0, 50)}${h.length > 50 ? "…" : ""}」${repeated.includes(h) ? "（前回も）" : ""}`).join("\n")}`,
    suggestion: "例文の意味（何を言う場面か）だけを取り、その台本のテーマ語・場面・比喩で文を作り直す。語順・言い回し・例の中身を変える",
  }];
}

// 直近2本の合格台本の両方にある文（8字以上）を今回も使っている＝3本連続。定型句の自動検出（手で登録した型に限らない）
export function scanStockSentences(script: string, approvedScripts: string[]): QualityCheckItem[] {
  const prev = (approvedScripts || []).slice(0, 2);
  if (prev.length < 2) return [];
  const split = (x: string) => new Set(norm(x).split(/(?<=[。！？!?])/).map((s) => s.trim()).filter((s) => s.length >= 8 && !FIXED_LINES.test(s)));
  const mine = split(script);
  const a = split(prev[0]); const b = split(prev[1]);
  const hits = Array.from(mine).filter((s) => a.has(s) && b.has(s)).slice(0, 8);
  if (hits.length === 0) return [];
  return [{
    name: `3本連続で同じ文（${hits.length}件）`,
    status: "fail",
    comment: `直近2本の合格台本の両方にある文を、今回もそのまま使っています。\n${hits.map((h) => `「${h.slice(0, 50)}${h.length > 50 ? "…" : ""}」`).join("\n")}`,
    suggestion: "同じ役目の文でも、言い回し・例・語順を変える（固定句・挨拶・決め台詞は対象外）",
  }];
}

// 離脱阻止の重複: 「最後まで一緒にいてください」と「画面を閉じないでください」は同じ意味。両方言うと「その前に」の論理も壊れる
export function scanRetentionDuplicate(script: string): QualityCheckItem[] {
  const head = norm(script).slice(0, 2200);
  const items: QualityCheckItem[] = [];
  const stay = head.match(/最後まで(一緒に|見て|聞いて|受け取って|ご覧|いて)[^。]{0,16}(ください|くださいね|いてね)/);
  const close = head.match(/(画面|動画)を?[^。]{0,8}閉じないで/);
  if (stay && close) {
    items.push({ name: "離脱阻止の重複（最後まで一緒に＋画面を閉じないで）", status: "warn",
      comment: `「${stay[0]}」と「${close[0]}」は同じお願いです。冒頭で2回頼むとしつこく、間に「その前に」が入ると論理が壊れます`,
      suggestion: "離脱阻止は冒頭で1回。最後のカードの予告に「だから最後まで」を添えるか、「画面を閉じないで」の損失型か、どちらか1つ" });
  }
  const sonomae = head.match(/その前に[。、][^。]{0,40}閉じないで/);
  if (sonomae && !(stay && close)) {
    items.push({ name: "「その前に」の後が離脱阻止", status: "warn",
      comment: `「${sonomae[0]}」。「その前に」は本編に入る前の高評価・コメントの案内に使う言葉です。離脱阻止を置くと前の文と同じ内容の繰り返しになります`,
      suggestion: "「その前に」は軽CTAの直前だけに使う" });
  }
  return items;
}

// 占い師の思い（一人称の感情・願い）の有無。説明と予言だけの台本を止める
// 対象の形: 「私は／私も／私が …（嬉しい・痛い・心配・願って・ほしい）」「あなたには…してほしい／なってほしい」
const FEELING_RE = /(私|わたし|アリサ)(は|も|が|自身|にとって|の)[^。！？]{0,40}(嬉し|うれし|痛(かった|い|く)|胸が(いっぱい|熱|痛|きゅ)|泣|ほっと|悔し|心配|願って|祈って|思っている|思っています|本気で|ほしい|ほしくない|見届けたい|手伝(い|え)|嬉しかった|びっくり)|あなたに(は|も)?[^。！？]{0,40}(なってほしい|してほしい|過ごしてほしい|いてほしい|迎えてほしい|してほしくない|ほしくない)/g;
export function scanFeelingPresence(script: string): QualityCheckItem[] {
  const t = norm(script);
  if (!looksLikeFullScript(t)) return [];
  const all = Array.from(t.matchAll(FEELING_RE));
  const lineAt = lastLineMention(t);
  const tailStart = Math.max(0, lineAt - 700);
  const inTail = all.filter((m) => (m.index ?? 0) >= tailStart).length;
  const items: QualityCheckItem[] = [];
  if (all.length === 0) {
    items.push({ name: "全文: 占い師の思いが無い", status: "fail",
      comment: "「私は〜嬉しい」「私も胸が痛かった」「あなたには〜してほしい」のような、占い師自身の感情や願いが1つもありません。説明と予言だけの台本になっています",
      suggestion: "本編に1箇所（言い当て・免責の直後か理想の未来の中）、終盤のLINE誘導の中に1箇所、一人称の思いを入れる（抽選ブロックの【占い師の思い】の種類で）" });
  } else if (all.length === 1) {
    items.push({ name: "全文: 占い師の思いが1箇所だけ", status: "warn",
      comment: `占い師の思いが「${all[0][0].slice(0, 40)}」の1箇所しかありません。本編1＋終盤1が必須です`,
      suggestion: inTail > 0 ? "本編（言い当て・免責の直後か理想の未来の中）に1箇所足す" : "終盤のLINE誘導の中（未知数・枠の前）に「あなたには◯◯になってほしい。だからこの機会を無駄にしてほしくない」の形で1箇所足す" });
  } else if (inTail === 0) {
    items.push({ name: "全文: 終盤のLINE誘導に占い師の思いが無い", status: "warn",
      comment: "思いは本編にありますが、終盤のLINE誘導の中に一人称の思いがありません。理屈（未知数・枠）だけで案内しています",
      suggestion: "未知数の前に「私は、あなたに◯◯になってほしいと本気で思っている。だからこの機会を無駄にしてほしくない」を置き、思いが先・案内が後の順にする" });
  }
  if (all.length >= 5) {
    items.push({ name: `全文: 占い師の思いが${all.length}箇所`, status: "warn",
      comment: "一人称の感情・願いが多すぎます。4箇所以上は押しつけや自分語りに聞こえます", suggestion: "2〜3箇所に絞る（本編1・終盤1・締め1まで）" });
  }
  return items;
}

// 倒置・言いさし: 助詞で終わる文（「想像してみてください。〜毎日を。」「片足は水に、片足は陸に。」）。動詞を先に言って目的語を後から足す形は禁止
export function scanInvertedEndings(script: string): QualityCheckItem[] {
  const t = norm(script);
  // 「〜ますから。」「〜ですからね。」の理由の「から」は対象外
  const hits = t.split(/(?<=[。！？!?])/).filter((s) => s.length > 8 && /(を|へ|まで|(?<!ます|です|ません|せん)から|[^こもの]に)[。！？!?]$/.test(s)).slice(0, 5);
  if (hits.length === 0) return [];
  return [{
    name: `倒置・言いさし（${hits.length}文）`,
    status: "fail",
    comment: `助詞で終わる文があります。動詞の後に目的語を足す倒置か、述語の無い言いさしです。\n${hits.map((h) => `「${h.slice(-50)}」`).join("\n")}`,
    suggestion: "目的語を動詞の前に置いて1文にする（「〜毎日を、想像してみてください」）。言いさしは述語で締める",
  }];
}

// 「◯枚目でお話しした」の多用: 視聴者は細かく覚えていないので、前に戻る言い方は1本で2回まで
export function scanBackrefOveruse(script: string): QualityCheckItem[] {
  const t = norm(script);
  const hits = Array.from(t.matchAll(/([1-9１-９]枚目|冒頭|最初|さっき|先ほど)で[、]?[^。]{0,30}?(言いました|言った|お話しし|お伝えし|触れ|申し上げ)/g)).map((m) => m[0]).slice(0, 8);
  if (hits.length < 3) return [];
  return [{
    name: `前のカードへの言及が${hits.length}回`,
    status: hits.length >= 4 ? "fail" : "warn",
    comment: `「◯枚目でお話しした」型の言い方が多すぎます。視聴者は前のカードの中身を細かく覚えていません。\n${hits.map((h) => `「${h}」`).join("\n")}`,
    suggestion: "戻る言い方は1本で2回まで（冒頭フックの回収と、核心の1回）。それ以外は前を参照せず、その場で言い直す",
  }];
}

// 比喩の連続: 出たカードの絵柄の語（杯・水・道・輪・灯り 等）が1段落に4回以上出ているのに、「つまり」「ということです」で現実の言葉に戻していない
export function scanMetaphorPileup(script: string, imagery?: { name: string; img?: string }[]): QualityCheckItem[] {
  const words = new Set<string>();
  for (const im of imagery || []) {
    for (const m of (im.img || "").matchAll(/[一-龥]{2,3}|[ァ-ヶー]{2,}/g)) words.add(m[0]);
  }
  // 台本側の比喩語（絵柄に無くても台本で比喩として使われやすい語）
  for (const w of ["灯り", "帳簿", "請求書", "水位", "輪", "鎖", "窓の外", "扉", "器", "川", "畑", "種", "鍵", "天秤", "歯車"]) words.add(w);
  const GENERIC = /^(人物|女性|男性|若者|老人|人間|男女|2人|二人|一人|背景|遠く|手前|足元|頭上|背後|両手|片手|左右|上下|正面|全体|部分|場面|様子|状態|意味|中|上|下|前|後|外|内|空|町|山|海|雲|夜|朝|光)$/;
  const metaphors = Array.from(words).filter((w) => !GENERIC.test(w) && w.length >= 1);
  const items: QualityCheckItem[] = [];
  const paras = script.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ""));
  for (const para of paras) {
    if (para.length < 80) continue;
    // 絵柄そのものの説明段落（「〜の絵です」「描かれています」「〜を表すカード」）は対象外。比喩の連続は、絵を離れて語り続ける段落で見る
    if (/の絵|絵です|絵が|描かれ|描いた|描いて|表すカード|を表し|という意味|正位置|逆位置/.test(para)) continue;
    const hits = metaphors.filter((w) => para.includes(w));
    const count = hits.reduce((n, w) => n + (para.split(w).length - 1), 0);
    const grounded = /つまり|ということです|要するに|現実で言うと|言い換えると|簡単に言うと/.test(para);
    if (hits.length >= 3 && count >= 5 && !grounded) {
      items.push({ name: `比喩の連続（${hits.slice(0, 5).join("・")}）`, status: "warn",
        comment: `1つの段落に比喩の語が${count}回（${hits.length}種類）出ていて、「つまり」で現実の言葉に戻していません。視聴者には何の話か分からなくなります。\n「${para.slice(0, 60)}…」`,
        suggestion: "絵柄や比喩の説明は2文まで。そのあと必ず「つまり、〜ということです」で、あの人・気持ち・毎日・連絡のような現実の言葉に言い換える。1段落に比喩は2種類まで" });
      if (items.length >= 3) break;
    }
  }
  return items;
}

// 目的語のない動詞: 「整えた人」「手放した方」「受け取ったあなた」のように「何を」が無い言い方
export function scanMissingObject(script: string): QualityCheckItem[] {
  const t = norm(script);
  const re = /(整え|整っ|手放し|受け取っ|満たされ|緩め|溜め|戻し)(た|る)(人|方|あなた|もの|分|側|瞬間|とき)/g;
  const hits: string[] = [];
  for (const m of t.matchAll(re)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    if (/[をがも]|まで|から/.test(before)) continue;   // 直前に「気持ちを」「流れが」「最後の1枚まで」があればよい
    hits.push(before.slice(-8) + m[0]);
    if (hits.length >= 6) break;
  }
  if (hits.length === 0) return [];
  return [{
    name: `「何を」が無い動詞（${hits.length}件）`,
    status: hits.length >= 3 ? "fail" : "warn",
    comment: `動詞に目的語が無く、何の話か分かりません。\n${hits.map((h) => `「…${h}」`).join("\n")}`,
    suggestion: "必ず「何を」を付ける（「気持ちを整えた人」「あの人の荷物を手放した方」「連絡を受け取った瞬間」）",
  }];
}

// シャッフルは冒頭の1回だけ。2枚目以降でシャッフルし直す・切り直す描写があれば不合格（冒頭のシャッフルを振り返る言い方は可）
export function scanReshuffle(script: string): QualityCheckItem[] {
  const t = norm(script);
  const second = t.search(/[2２]枚目(?!の)/);
  if (second < 0) return [];
  const tail = t.slice(second);
  const hits: string[] = [];
  for (const m of tail.matchAll(/シャッフル|切り直|混ぜ直|カードを切(っ|り)/g)) {
    const around = tail.slice(Math.max(0, m.index! - 14), m.index! + 20);
    // 冒頭のシャッフルを振り返る言い方（「シャッフルの時から」「シャッフルをする前に」「シャッフルの間」）は対象外
    if (/シャッフル(の時|のとき|をする前|する前|の前|の間|中に|している時|していた)/.test(around)) continue;
    hits.push(around);
    if (hits.length >= 3) break;
  }
  if (hits.length === 0) return [];
  return [{
    name: `2枚目以降でシャッフルしている（${hits.length}件）`,
    status: "fail",
    comment: `シャッフルは1枚目をめくる前の1回だけです。2枚目以降は山から1枚ずつ引く演出にします。\n${hits.map((h) => `「…${h}…」`).join("\n")}`,
    suggestion: "「山の上から1枚」「束からはみ出した1枚」「山を崩したら表を向いた1枚」のように、山から引く演出に書き換える",
  }];
}

// 同じ文が続けて2回出ている（修正パッチで「元の文＋直した文」を重ねて置いたときに起きる）。放置すると同一文の繰り返しとして毎回不合格になる
export function scanAdjacentDuplicates(script: string): QualityCheckItem[] {
  const sents = script.replace(/\s+/g, "").split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
  const exact: string[] = [];
  const near: string[] = [];
  const prefixLen = (x: string, y: string) => { let n = 0; while (n < x.length && n < y.length && x[n] === y[n]) n++; return n; };
  for (let i = 1; i < sents.length; i++) {
    const a = sents[i - 1], b = sents[i];
    if (b.length >= 12 && a === b) { if (!exact.includes(b)) exact.push(b); continue; }
    // 前半が20字以上同じで、短い方が長い方の7割以上＝「元の文を残したまま直した文を足した」形
    const shorter = Math.min(a.length, b.length);
    if (shorter >= 15 && prefixLen(a, b) >= Math.max(20, Math.floor(shorter * 0.7))) { const pair = `${a}｜${b}`; if (!near.includes(pair)) near.push(pair); }
    if (exact.length + near.length >= 5) break;
  }
  const items: QualityCheckItem[] = [];
  const cut = (h: string) => (h.length > 160 ? h.slice(0, 160) + "…" : h);
  if (exact.length > 0) items.push({
    name: `同じ文が続けて2回（${exact.length}件）`,
    status: "fail",
    comment: `同じ文が連続しています（修正で重ねて置かれた可能性）。該当（片方を消す）:\n${exact.map((h) => `「${cut(h)}」`).join("\n")}`,
    suggestion: "連続している2文のうち片方を削除する（文は変えない）",
  });
  if (near.length > 0) items.push({
    name: `ほぼ同じ文が続いている（${near.length}件）`,
    status: "warn",
    comment: `前半が同じ文が2つ並んでいます（修正で元の文を残したまま直した文を足した形の可能性）。該当:\n${near.map((h) => `「${cut(h)}」`).join("\n")}`,
    suggestion: "2文のうち古い方（直す前の文）を削除し、1文にする",
  });
  return items;
}

export function runMechanicalChecks(script: string, approvedScripts?: string[], opts?: { revealed?: { count: number; cards: string[] }; drawSpec?: string; imagery?: { name: string; img?: string }[]; rules?: string }): QualityCheckItem[] {
  return [
    ...scanAdjacentDuplicates(script),
    ...scanVerbatimExamples(script, opts?.rules, approvedScripts),
    ...scanStockSentences(script, approvedScripts || []),
    ...scanRetentionDuplicate(script),
    ...scanFeelingPresence(script),
    ...scanInvertedEndings(script),
    ...scanBackrefOveruse(script),
    ...scanMetaphorPileup(script, opts?.imagery),
    ...scanMissingObject(script),
    ...scanReshuffle(script),
    ...scanUnknownsVsTiming(script),
    ...scanUnknownsVsForms(script),
    ...scanCommentWordConsistency(script),
    ...scanCtaMeaning(script),
    ...scanRetentionLoss(script),
    ...scanTemperature(script),
    ...scanStyleHabits(script),
    ...scanBlacklist(script),
    ...scanConsecutive(script, approvedScripts || []),
    ...scanKanjiNumerals(script),
    ...scanFixedPhrases(script),
    ...scanFreeReadingScope(script),
    ...findRepeatedSentences(script, approvedScripts || []),
    ...(opts?.revealed ? scanCardCount(script, opts.revealed) : []),
    ...(opts?.revealed ? scanMissingPlannedCards(script, opts.drawSpec, opts.revealed) : []),
    ...scanDuplicateAnnouncements(script),
    ...scanCommentCtaTypeMix(script),
    ...scanSummaryPresence(script),
    ...scanBodyEssentials(script),
    ...scanRepeatedEpisode(script),
    ...scanDestinyConflict(script),
    ...scanAuthorityStack(script),
    ...scanDrawSpecCompliance(script, opts?.drawSpec),
    ...(opts?.imagery ? scanImageryClaims(script, opts.imagery) : []),
    ...(opts?.imagery ? scanColorClaims(script, opts.imagery) : []),
  ];
}
