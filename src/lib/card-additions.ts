// 文字数不足のときの増筆提案。
// - カードの追加（1,000字以上の不足）: 枚数を1枚増やし、元ネタで占っていた内容を新しいカードとして足す
// - 要素の追加（不足量を問わない）: カードは増やさず、元ネタにあってこの骨組み／台本に無い構成内容を既存セクションに足す
// どちらも「元ネタの文を写す」のではなく「こういう内容を追記する」という要点で提案する（丸写しは類似率が上がるため禁止）。
// 候補を複数作り、ユーザーが選んで骨組み／台本に反映する。
import { CARD_NAMES } from "./tarot-draw";

export interface CardAddition {
  title: string;                                   // 追加カードの見出し（何を視るか。15字以内）
  content: string;                                 // そのカードで視る内容の要点（1〜2文。台本の文ではない）
  after: string;                                   // どのカード／セクションの後に入れるか（骨組み・台本に出てくる言い方で）
  afterIndex?: number;                             // 骨組みならセクション番号、台本なら何枚目か（分かる場合）
  card: { name: string; orientation: "正位置" | "逆位置" };  // 提案するカード（正統な意味が内容に合うもの）
  cardReason: string;                              // そのカードを選んだ理由（絵柄・意味との整合）
  source: string;                                  // 元ネタのどの部分から取ったか（文の引用ではなく、場所と話題で）
  chars: number;                                   // 追加の目安文字数
}

const NO_COPY_RULES = `- 【丸写し禁止（必達）】元ネタ台本の文をそのまま書かない。言い換えただけの文も書かない。「こういう内容を追記する」という要点だけを、自分の言葉で短く書く（台本の本文はあとで別に書く）
- source（出どころ）も文の引用ではなく「元ネタ1の3枚目・前触れのサインの話」のように、場所と話題で書く`;

export function buildCardAdditionPrompt(opts: {
  text: string;                 // 骨組み or 台本本文
  kind: "skeleton" | "script";
  deficit: number;
  targetChars: number;
  transcripts: string[];        // 元ネタの書き起こし
  usedCards: string[];          // すでに使っているカード名（候補から除外）
}): string {
  const { text, kind, deficit, targetChars, transcripts, usedCards } = opts;
  const deck = CARD_NAMES.filter((n) => !usedCards.includes(n)).join("・");
  const unit = kind === "skeleton" ? "セクション" : "カード";
  return `あなたは占いスピリチュアル系YouTube台本の構成プロデューサーです。
次の${kind === "skeleton" ? "台本の骨組み" : "台本"}は、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
不足が1,000字以上なので、「カードを1枚追加して、元ネタで占っていた内容を新しいリーディングとして足す」提案を作ってください。

【提案の作り方（必達）】
- 元ネタ台本の書き起こしを読み、元ネタが「カードで視ていた内容」のうち、この${kind === "skeleton" ? "骨組み" : "台本"}にまだ無いものを2〜4個選ぶ
  （例: 相手の今の様子／なぜ今動き始めたのか／どんな形で返る・来るのか／前触れのサイン／時期の段階／返った後の毎日／二人が近づくきっかけ／乗り越える壁 など）
- 候補1つ＝新しいカード1枚。どの${unit}の後に入れるかを、流れが切れない位置で決める（基本の役割の順序は崩さない。最後のカードの後には入れない）
- content は「そのカードで何を視るか」の要点を1〜2文で（例:「相手が今、周りの信頼を失い始めていること。本人は気づいていないこと」）
${NO_COPY_RULES}
- 内容に合うカードを、下の【使えるカード】から1枚選ぶ（標準的なウェイト版の正統な意味と絵柄が、視る内容と無理なく合うもの。すでに使っているカードは不可）。向きは正位置か逆位置
- 1件あたり400〜700字の目安を付け、合計で約${deficit.toLocaleString()}字増える配分にする
- 既存のカードを削除・統合・置き換える提案はしない。CTA・LINE誘導・口コミのような「カードで視る内容ではないもの」は候補にしない

【使えるカード】
${deck}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "additions": [ { "title": "見出し（15字以内）", "content": "何を視るかの要点1〜2文", "after": "${kind === "skeleton" ? "どのセクションの後か（骨組みのセクション名をそのまま。例: ❸ 3枚目：ペンタクルの4（逆位置）｜どんな形で返るか）" : "どのカードの後か（例: 3枚目 ペンタクルの4）"}", "afterIndex": ${kind === "skeleton" ? "セクション番号（❶=1, ❷=2 …）" : "何枚目の後か"}, "card": { "name": "カード名（使えるカードから）", "orientation": "正位置|逆位置" }, "cardReason": "そのカードを選んだ理由（絵柄・意味との整合を1〜2文）", "source": "元ネタのどの部分か（場所と話題）", "chars": 500 } ] }

【${kind === "skeleton" ? "骨組み" : "台本"}】
${text.slice(0, 12000)}
${transcripts.length ? `\n【元ネタ台本の書き起こし（候補の出どころ。文はそのまま写さない）】\n${transcripts.map((t, i) => `■ 元ネタ${i + 1}\n${t.slice(0, 8000)}`).join("\n\n")}` : "\n【元ネタ台本の書き起こし】（無し。骨組み・台本の流れから、不足しているリーディング内容を補う候補を考える）"}`;
}

export function parseCardAdditions(raw: unknown, usedCards: string[]): CardAddition[] {
  const adds = Array.isArray((raw as { additions?: unknown[] })?.additions) ? ((raw as { additions: unknown[] }).additions as Record<string, unknown>[]) : [];
  const out: CardAddition[] = [];
  for (const a of adds) {
    const card = (a.card || {}) as { name?: string; orientation?: string };
    const name = String(card.name || "").trim();
    if (!CARD_NAMES.includes(name) || usedCards.includes(name)) continue;
    const orientation: "正位置" | "逆位置" = card.orientation === "逆位置" ? "逆位置" : "正位置";
    const title = String(a.title || "").trim().slice(0, 20);
    const content = String(a.content || "").trim();
    if (!title || !content) continue;
    const afterIndex = Number(a.afterIndex);
    out.push({
      title, content,
      after: String(a.after || "").trim().slice(0, 60),
      afterIndex: Number.isFinite(afterIndex) && afterIndex > 0 ? afterIndex : undefined,
      card: { name, orientation },
      cardReason: String(a.cardReason || "").trim().slice(0, 200),
      source: String(a.source || "").trim().slice(0, 80),
      chars: Math.min(900, Math.max(300, Number(a.chars) || 500)),
    });
    if (out.length >= 4) break;
  }
  return out;
}

// 選んだ候補を骨組みに入れるときの修正指示（差分パッチ用）
export function skeletonInsertInstruction(a: CardAddition): string {
  return `【カードを1枚追加】セクション「${a.after}」の後に、新しいセクション（カード）を1つ追加してください。
- カード: ${a.card.name}（${a.card.orientation}）。このカードで視る内容: ${a.title}
- セクションの説明（要点。これを元に2〜3文の説明を書く）: ${a.content}
- 参考元: ${a.source || "元ネタ"}（文は写さず、要点だけ反映する）
- 尺の目安: 約${a.chars}字分（1分≒250字で換算）。前後のセクションの時間表記を繰り下げ、以降のセクション番号・「◯枚目」の番号を1つずつ繰り下げる
- 既存のセクション・カードは削除・統合・置き換えしない。他の文言は変えない
- 骨組み冒頭の枚数や「目標文字数」の記載があれば、枚数だけ更新する`;
}

// 選んだ候補を台本本文に入れるときの修正指示（差分パッチ用）
export function scriptInsertInstruction(a: CardAddition, totalCards: number): string {
  const n = a.afterIndex ?? 0;
  const pos = n ? `${n}枚目（${a.after}）のパートが終わった直後` : `「${a.after}」のパートが終わった直後`;
  return `【カードを1枚追加】${pos}に、新しいカードのパートを1つ追加してください（約${a.chars}字）。
- カード: ${a.card.name}（${a.card.orientation}）。「${n ? n + 1 : "次の"}枚目」として山から1枚引く演出から始め、カード名と向きを言い、絵柄を1〜2文で説明してから、このカードで視る内容を語る
- 視る内容の要点（${a.title}）: ${a.content}。元ネタの文は写さず、この台本の語り口と中心メタファーで書く
- このカードの正統な意味の範囲で語る。既存のパートの文は変えない。既存のカードを削除・統合・置き換えしない
- 追加した後のカードの番号（「◯枚目」）を1つずつ繰り下げる（最後のカードは${totalCards + 1}枚目になる）。終盤の「今日のカードのまとめ」にも、このカードの1文を同じ位置に足す
- 本編のアドバイスは占い師の言葉として言う。カードの意味づけに「〜とカードが言っています」は使ってよい`;
}

// ===== カードは増やさずに足せる要素（元ネタにあって、この骨組み／台本に無い構成内容） =====
export interface ContentAddition {
  title: string;        // 要素名（例: 予祝の説明／前触れの構え／鑑定を受けた人の口コミ／時期の3段階）
  content: string;      // 追記する内容の要点（1〜2文。台本の文ではない）
  into: string;         // どのセクション（カード）の中に足すか（本文の言い方で）
  intoIndex?: number;   // 骨組みならセクション番号、台本なら何枚目か（分かる場合）
  position: "冒頭" | "途中" | "末尾";  // そのセクションのどこに足すか
  source: string;       // 元ネタのどの部分から取ったか（場所と話題）
  chars: number;        // 目安文字数
}

export function buildContentAdditionPrompt(opts: {
  text: string;
  kind: "skeleton" | "script";
  deficit: number;
  targetChars: number;
  transcripts: string[];
  referenceStructure?: string;   // 元ネタの構成分析（セクション名と目的）
}): string {
  const { text, kind, deficit, targetChars, transcripts, referenceStructure } = opts;
  const unit = kind === "skeleton" ? "セクション" : "カードのパート";
  return `あなたは占いスピリチュアル系YouTube台本の構成プロデューサーです。
次の${kind === "skeleton" ? "台本の骨組み" : "台本"}は、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
カードの枚数は増やさずに、「元ネタにあって、この${kind === "skeleton" ? "骨組み" : "台本"}に無い構成内容」を既存の${unit}に足す候補を提案してください。

【候補にするもの（必達）】
- 元ネタの構成・書き起こしを読み、元ネタが入れているのに、この${kind === "skeleton" ? "骨組み" : "台本"}に無い要素を2〜5個選ぶ。
  例: 予祝（先に叶った体で書く）の説明／コメントの意味づけ／前触れが来たときの構え（広めない・確かめない）／直感の答え合わせ／鑑定を受けた人の口コミと時期／時期の3段階／返った後の毎日の具体場面／因果応報の両面（感謝も倍で返る）／相手の内側の説明／労い／占い師の思い（共感・願い）／既成事実化の一言 など
- それぞれ、意味の近い既存の${unit}の「冒頭／途中／末尾」のどこに足すかを決める。カードの追加・削除・順番変更はしない
- content は「こういう内容を追記する」という要点を1〜2文で（例:「前触れが来ても周りに言わず確かめにも行かない、という構えを伝える」）
${NO_COPY_RULES}
- 1件あたり200〜600字の目安を付け、合計で約${deficit.toLocaleString()}字増える配分にする
- CTAの重複・LINE誘導の追加・枚数の言及・「あなたのことを言い当ててもいいですか」のような禁止表現は候補にしない

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "additions": [ { "title": "要素名（15字以内）", "content": "追記する内容の要点1〜2文", "into": "${kind === "skeleton" ? "どのセクションか（骨組みのセクション名をそのまま。例: ❹ 4枚目：ソードのクイーン（正位置）｜前触れ）" : "どのカードのパートか（例: 4枚目 ソードのクイーン）"}", "intoIndex": ${kind === "skeleton" ? "セクション番号（❶=1, ❷=2 …）" : "何枚目か"}, "position": "冒頭|途中|末尾", "source": "元ネタのどの部分か（場所と話題）", "chars": 400 } ] }

【${kind === "skeleton" ? "骨組み" : "台本"}】
${text.slice(0, 12000)}
${referenceStructure ? `\n【元ネタの構成（分析結果）】\n${referenceStructure.slice(0, 3000)}\n` : ""}${transcripts.length ? `\n【元ネタ台本の書き起こし（候補の出どころ。文はそのまま写さない）】\n${transcripts.map((t, i) => `■ 元ネタ${i + 1}\n${t.slice(0, 8000)}`).join("\n\n")}` : "\n【元ネタ台本の書き起こし】（無し。一般的に効く要素のうち、この骨組み・台本に無いものを候補にする）"}`;
}

export function parseContentAdditions(raw: unknown): ContentAddition[] {
  const adds = Array.isArray((raw as { additions?: unknown[] })?.additions) ? ((raw as { additions: unknown[] }).additions as Record<string, unknown>[]) : [];
  const out: ContentAddition[] = [];
  for (const a of adds) {
    const title = String(a.title || "").trim().slice(0, 20);
    const content = String(a.content || "").trim();
    if (!title || !content) continue;
    const intoIndex = Number(a.intoIndex);
    const pos = String(a.position || "");
    out.push({
      title, content,
      into: String(a.into || "").trim().slice(0, 60),
      intoIndex: Number.isFinite(intoIndex) && intoIndex > 0 ? intoIndex : undefined,
      position: pos === "冒頭" || pos === "末尾" ? pos : "途中",
      source: String(a.source || "").trim().slice(0, 80),
      chars: Math.min(800, Math.max(150, Number(a.chars) || 300)),
    });
    if (out.length >= 5) break;
  }
  return out;
}

// 選んだ要素を骨組みに入れるときの修正指示（差分パッチ用。カードは増やさない）
export function skeletonContentInstruction(a: ContentAddition): string {
  return `【要素を加筆（カードは増やさない）】セクション「${a.into}」の${a.position}に、次の要素を加筆してください（約${a.chars}字分。尺の表記もその分だけ繰り下げる）。
- 要素: ${a.title}
- 追記する内容の要点（これを元に、セクションの説明として2〜3文で書く。元ネタの文は写さない）: ${a.content}
- 参考元: ${a.source || "元ネタ"}
- 既存のセクション・カードは削除・統合・置き換えしない。他の文言は変えない`;
}

// 複数の要素をまとめて骨組みに入れるときの修正指示
export function skeletonContentBatchInstruction(list: ContentAddition[]): string {
  return `【要素をまとめて加筆（カードは増やさない。${list.length}件すべて反映する）】
${list.map((a, i) => `${i + 1}. セクション「${a.into}」の${a.position}に【${a.title}】を約${a.chars}字分
   要点: ${a.content}
   参考元: ${a.source || "元ネタ"}（文は写さず要点だけ反映）`).join("\n")}
- 各要素は、そのセクションの説明として2〜3文で書き足す。尺の表記も足した分だけ繰り下げる
- 既存のセクション・カードは削除・統合・置き換えしない。指示に無い箇所は変えない`;
}

// 選んだ要素を台本本文に入れるときの修正指示（差分パッチ用）
export function scriptContentInstruction(a: ContentAddition): string {
  const where = a.intoIndex ? `${a.intoIndex}枚目（${a.into}）のパート` : `「${a.into}」のパート`;
  return `【要素を加筆（カードは増やさない）】${where}の${a.position}に、次の要素を約${a.chars}字で加筆してください。
- 要素: ${a.title}
- 内容の要点: ${a.content}（元ネタの文は写さず、この台本の語り口と中心メタファーで書く）
- このパートのカードの正統な意味の範囲で語る。既存の文は変えない。既存のカードを削除・統合・置き換えしない。本編のアドバイスは占い師の言葉として言う`;
}
