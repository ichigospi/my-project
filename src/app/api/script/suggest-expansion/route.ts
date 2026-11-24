import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { normalizeAiModel } from "@/lib/ai-model";

// 文字数不足の台本に対して「どこに・何を・何字くらい」足すべきかの増筆指示を生成する。
// 返した指示はそのまま修正（revise）フローに流せる形式のプレーンテキスト。
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, skeleton, targetChars, aiApiKey, referenceTranscripts, recentScripts } = body as {
      script: string; skeleton?: string; targetChars: number; aiApiKey: string;
      referenceTranscripts?: string[];   // 元ネタ台本の書き起こし（増筆の材料）
      recentScripts?: string[];          // 同チャンネルの合格台本（アドバイスの材料）
    };
    const aiModel = normalizeAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!script?.trim()) return NextResponse.json({ error: "台本がありません" }, { status: 400 });

    const current = script.replace(/\s/g, "").length;
    const deficit = Math.max(0, (targetChars || 0) - current);

    const prompt = `あなたは占いスピリチュアル系YouTube台本の編集者です。
以下の台本は目標文字数に対して不足しています。どこを膨らませるべきか、増筆指示を作ってください。

【現在】${current.toLocaleString()}字 ／ 【目標】約${(targetChars || 0).toLocaleString()}字（あと約${deficit.toLocaleString()}字の増筆が必要）

【増筆の方針（不足量で決める。必達）】
${deficit >= 1000
  ? `- 不足が1,000字以上なので、「カードを1枚追加して、新しいリーディング内容を足す」ことを最優先にする（既存のカードを膨らませて埋めない）。
  元ネタ台本の書き起こしから、元ネタが「カードで視ていた内容」のうち、この台本にまだ無いもの（相手の今の様子・なぜ今動くのか・どんな形で返るか／来るか・前触れのサイン・時期の段階・返った後の毎日 など）を1つ選ぶ
- 増筆指示の1つ目は必ず次の形にする:「◯枚目（カード名）のパートが終わった直後に、新しいカードのパートを約◯字で追加する。カードは『◯◯（正位置／逆位置）』（この台本でまだ使っていないカードで、ウェイト版の正統な意味がその内容に合うもの）。『◯枚目』としてめくる演出→カード名と向き→絵柄1〜2文→視る内容（2〜3文で具体に）。追加後は後ろのカードの番号を1つずつ繰り下げ、終盤の『今日のカードのまとめ』にもこのカードの1文を足す」
- 追加する内容は元ネタの文をそのまま写さず、この台本の語り口・中心メタファーで書き直す指示にする。既存のカードの削除・統合・置き換えはしない
- それでも足りない分だけ、下の補助の優先順位で膨らませる`
  : `- 不足が1,000字未満なので、「新しいアドバイスの追加」を最優先にする。元ネタ台本や、同チャンネルの合格台本にあるアドバイス（今日からできる軽い行動・構え・やらないこと・受け取り方）のうち、この台本にまだ無いものを1つ選び、解決のカード（行動を渡すカード）の中か、その直後に1段落として足す
- アドバイスはハードルが低く今日できるものに限る。本編のアドバイスは占い師の言葉として言う（守護天使様に帰属させない）。元ネタ・過去台本の文をそのまま写さず、この台本の語り口で書き直す指示にする
- それでも足りない分だけ、下の補助の優先順位で膨らませる`}

【重複の照合（必達）】
- 足す要素（アドバイス・口コミ・時期・言い当て・ワーク・理想の未来の場面）が、台本にすでにある場合は提案しない。提案の前に台本を読み、同じ役割の要素が1つでもあれば別の要素にする。同じ要素を2回入れるのは品質チェックで不合格になる

【増筆指示の作り方】
- 増筆ポイントを2〜4箇所提案する。合計でおよそ${deficit.toLocaleString()}字増える配分にする
- 各ポイントは「どの箇所（台本内の文を短く引用して特定）の後に」「何を」「約何字」の形で、具体的な内容の方向まで書く。上の方針で足す内容は、元ネタ・合格台本のどの部分から取ったかも一言添える
- 足す内容は台本の既存の流れ・世界観・中心メタファーに沿ったものだけ。新しい訴求の発明や構成の変更はしない。カードの追加・削除はしない
- 補助の優先順位（方針で足りない分だけ）: ①悩みの深掘り共感（言い当て・労い・内心の声） ②理想の未来（行動と感情のディテール・複数ジャンルの具体未来） ③常識破壊の「現実がどう変わるか」 ④絵柄の実況。CTAや終盤の導線はいじらない
- 出力は増筆指示のみ（前置き・後書き・コードブロック禁止）。そのままAIへの修正指示として使える文章にする

${skeleton?.trim() ? `【骨組み（この設計に対して薄い箇所を探す手がかり）】\n${skeleton.slice(0, 6000)}\n\n` : ""}${(referenceTranscripts || []).filter((t) => t && t.trim()).length
  ? `【元ネタ台本の書き起こし（増筆の材料。ここから「台本にまだ無い内容」を抜き出す。文はそのまま写さない）】\n${(referenceTranscripts || []).filter((t) => t && t.trim()).slice(0, 2).map((t, i) => `■ 元ネタ${i + 1}\n${t.slice(0, 7000)}`).join("\n\n")}\n\n`
  : ""}${deficit < 1000 && (recentScripts || []).filter((t) => t && t.trim()).length
  ? `【同チャンネルの合格台本（アドバイスの材料。ここにある行動・構えのうち、この台本に無いものを選ぶ。文はそのまま写さない）】\n${(recentScripts || []).filter((t) => t && t.trim()).slice(0, 2).map((t, i) => `■ 合格台本${i + 1}\n${t.slice(0, 6000)}`).join("\n\n")}\n\n`
  : ""}【台本】
${script}`;

    const r = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 2000 });
    if (r.error) return NextResponse.json({ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, { status: r.status || 500 });
    const text = r.text;

    if (!text.trim()) return NextResponse.json({ error: "提案が空でした。もう一度お試しください" }, { status: 502 });
    return NextResponse.json({ suggestion: text.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "増筆提案に失敗しました" }, { status: 500 });
  }
}
