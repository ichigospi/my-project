// 文字数不足（1,000字以上）のときの「カードを1枚追加する」提案。
// 「新しいリーディング内容の追加」＝枚数を1枚増やし、元ネタで占っていた内容を新しいカードとして足すこと。
// 候補を複数作り、ユーザーが選んで骨組み／台本に反映する（カード設計表の追加候補と同じ使い方）。
import { CARD_NAMES } from "./tarot-draw";

export interface CardAddition {
  title: string;                                   // 追加カードの見出し（何を視るか。15字以内）
  content: string;                                 // そのカードで視る内容（2〜3文）
  after: string;                                   // どのカード／セクションの後に入れるか（骨組み・台本に出てくる言い方で）
  afterIndex?: number;                             // 何枚目の後か（分かる場合）
  card: { name: string; orientation: "正位置" | "逆位置" };  // 提案するカード（正統な意味が内容に合うもの）
  cardReason: string;                              // そのカードを選んだ理由（絵柄・意味との整合）
  source: string;                                  // 元ネタのどの部分から取ったか
  chars: number;                                   // 追加の目安文字数
}

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
  return `あなたは占いスピリチュアル系YouTube台本の構成プロデューサーです。
次の${kind === "skeleton" ? "台本の骨組み" : "台本"}は、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
不足が1,000字以上なので、「カードを1枚追加して、元ネタで占っていた内容を新しいリーディングとして足す」提案を作ってください。

【提案の作り方（必達）】
- 元ネタ台本の書き起こしを読み、元ネタが「カードで視ていた内容」のうち、この${kind === "skeleton" ? "骨組み" : "台本"}にまだ無いものを2〜4個選ぶ
  （例: 相手の今の様子／なぜ今動き始めたのか／どんな形で返る・来るのか／前触れのサイン／時期の段階／返った後の毎日／二人が近づくきっかけ／乗り越える壁 など）
- 候補1つ＝新しいカード1枚。どのカード（セクション）の後に入れるかを、流れが切れない位置で決める（基本の役割の順序は崩さない。最後のカードの後には入れない）
- そのカードで視る内容を2〜3文で、台本でそのまま使える具体さで書く。元ネタの文をそのまま写さず、この${kind === "skeleton" ? "骨組み" : "台本"}の語り口・中心メタファーで書き直す
- 内容に合うカードを、下の【使えるカード】から1枚選ぶ（標準的なウェイト版の正統な意味と絵柄が、視る内容と無理なく合うもの。すでに使っているカードは不可）。向きは正位置か逆位置
- 1件あたり400〜700字の目安を付け、合計で約${deficit.toLocaleString()}字増える配分にする
- 既存のカードを削除・統合・置き換える提案はしない。CTA・LINE誘導・口コミのような「カードで視る内容ではないもの」は候補にしない

【使えるカード】
${deck}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "additions": [ { "title": "見出し（15字以内）", "content": "何を視るかを2〜3文", "after": "どのカード／セクションの後か（本文の言い方で。例: 3枚目 ペンタクルの4）", "afterIndex": 3, "card": { "name": "カード名（使えるカードから）", "orientation": "正位置|逆位置" }, "cardReason": "そのカードを選んだ理由（絵柄・意味との整合を1〜2文）", "source": "元ネタのどの部分から取ったか", "chars": 500 } ] }

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
      after: String(a.after || "").trim().slice(0, 40),
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
  const pos = a.afterIndex ? `${a.afterIndex}枚目（${a.after}）の後` : `「${a.after}」の後`;
  return `【カードを1枚追加】${pos}に、新しいセクション（カード）を1つ追加してください。
- カード: ${a.card.name}（${a.card.orientation}）。このカードで視る内容: ${a.title}
- セクションの説明（2〜3文）: ${a.content}
- 参考元: ${a.source || "元ネタ"}
- 尺の目安: 約${a.chars}字分（1分≒250字で換算）。前後のセクションの時間表記を繰り下げ、以降のセクション番号・「◯枚目」の番号を1つずつ繰り下げる
- 既存のセクション・カードは削除・統合・置き換えしない。他の文言は変えない
- 骨組み冒頭の枚数や「目標文字数」の記載があれば、枚数だけ更新する`;
}

// ===== カードは増やさずに足せる要素（元ネタにあって、この骨組み／台本に無い構成内容） =====
export interface ContentAddition {
  title: string;        // 要素名（例: 予祝の説明／前触れの構え／鑑定を受けた人の口コミ／時期の3段階）
  content: string;      // 何を言うかを2〜3文（台本でそのまま使える具体さ）
  into: string;         // どのセクション（カード）の中に足すか（本文の言い方で）
  intoIndex?: number;   // 何枚目か（分かる場合）
  position: "冒頭" | "途中" | "末尾";  // そのセクションのどこに足すか
  source: string;       // 元ネタのどの部分から取ったか
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
  return `あなたは占いスピリチュアル系YouTube台本の構成プロデューサーです。
次の${kind === "skeleton" ? "台本の骨組み" : "台本"}は、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
カードの枚数は増やさずに、「元ネタにあって、この${kind === "skeleton" ? "骨組み" : "台本"}に無い構成内容」を既存のセクション（カード）に足す候補を提案してください。

【候補にするもの（必達）】
- 元ネタの構成・書き起こしを読み、元ネタが入れているのに、この${kind === "skeleton" ? "骨組み" : "台本"}に無い要素を2〜5個選ぶ。
  例: 予祝（先に叶った体で書く）の説明／コメントの意味づけ／前触れが来たときの構え（広めない・確かめない）／直感の答え合わせ／鑑定を受けた人の口コミと時期／時期の3段階／返った後の毎日の具体場面／因果応報の両面（感謝も倍で返る）／相手の内側の説明／労い／占い師の思い（共感・願い）／既成事実化の一言 など
- それぞれ、意味の近い既存のセクション（カード）の「冒頭／途中／末尾」のどこに足すかを決める。カードの追加・削除・順番変更はしない
- 何を言うかを2〜3文で、台本でそのまま使える具体さで書く。元ネタの文をそのまま写さず、この${kind === "skeleton" ? "骨組み" : "台本"}の語り口・中心メタファーで書き直す
- 1件あたり200〜600字の目安を付け、合計で約${deficit.toLocaleString()}字増える配分にする
- CTAの重複・LINE誘導の追加・枚数の言及・「あなたのことを言い当ててもいいですか」のような禁止表現は候補にしない

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "additions": [ { "title": "要素名（15字以内）", "content": "何を言うかを2〜3文", "into": "どのセクション（カード）の中か（本文の言い方で。例: 4枚目 ソードのクイーン）", "intoIndex": 4, "position": "冒頭|途中|末尾", "source": "元ネタのどの部分から取ったか", "chars": 400 } ] }

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
      into: String(a.into || "").trim().slice(0, 40),
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
  const where = a.intoIndex ? `${a.intoIndex}枚目（${a.into}）のセクション` : `「${a.into}」のセクション`;
  return `【要素を加筆（カードは増やさない）】${where}の${a.position}に、次の要素を加筆してください（約${a.chars}字分。尺の表記もその分だけ繰り下げる）。
- 要素: ${a.title}
- 内容（2〜3文）: ${a.content}
- 参考元: ${a.source || "元ネタ"}
- 既存のセクション・カードは削除・統合・置き換えしない。他の文言は変えない`;
}

// 選んだ要素を台本本文に入れるときの修正指示（差分パッチ用）
export function scriptContentInstruction(a: ContentAddition): string {
  const where = a.intoIndex ? `${a.intoIndex}枚目（${a.into}）のパート` : `「${a.into}」のパート`;
  return `【要素を加筆（カードは増やさない）】${where}の${a.position}に、次の要素を約${a.chars}字で加筆してください。
- 要素: ${a.title}
- 内容: ${a.content}
- このパートのカードの正統な意味の範囲で語る。既存の文は変えない。既存のカードを削除・統合・置き換えしない。本編のアドバイスは占い師の言葉として言う`;
}

// 選んだ候補を台本本文に入れるときの修正指示（差分パッチ用）
export function scriptInsertInstruction(a: CardAddition, totalCards: number): string {
  const n = a.afterIndex ?? 0;
  const pos = n ? `${n}枚目（${a.after}）のパートが終わった直後` : `「${a.after}」のパートが終わった直後`;
  return `【カードを1枚追加】${pos}に、新しいカードのパートを1つ追加してください（約${a.chars}字）。
- カード: ${a.card.name}（${a.card.orientation}）。「${n ? n + 1 : "次の"}枚目」としてめくる演出から始め、カード名と向きを言い、絵柄を1〜2文で説明してから、このカードで視る内容を語る
- 視る内容（${a.title}）: ${a.content}
- このカードの正統な意味の範囲で語る。既存のパートの文は変えない。既存のカードを削除・統合・置き換えしない
- 追加した後のカードの番号（「◯枚目」）を1つずつ繰り下げる（最後のカードは${totalCards + 1}枚目になる）。終盤の「今日のカードのまとめ」にも、このカードの1文を同じ位置に足す
- 本編のアドバイスは占い師の言葉として言う。カードの意味づけに「〜とカードが言っています」は使ってよい`;
}
