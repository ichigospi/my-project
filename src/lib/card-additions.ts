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
