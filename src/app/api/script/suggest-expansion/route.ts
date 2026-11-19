import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

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
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!script?.trim()) return NextResponse.json({ error: "台本がありません" }, { status: 400 });

    const current = script.replace(/\s/g, "").length;
    const deficit = Math.max(0, (targetChars || 0) - current);

    const prompt = `あなたは占いスピリチュアル系YouTube台本の編集者です。
以下の台本は目標文字数に対して不足しています。どこを膨らませるべきか、増筆指示を作ってください。

【現在】${current.toLocaleString()}字 ／ 【目標】約${(targetChars || 0).toLocaleString()}字（あと約${deficit.toLocaleString()}字の増筆が必要）

【増筆の方針（不足量で決める。必達）】
${deficit >= 1000
  ? `- 不足が1,000字以上なので、「新しいリーディング内容の追加」を最優先にする。元ネタ台本の書き起こしから、この台本にまだ入っていない「カードで視ている内容」（相手の今の様子・なぜ今動くのか・どんな形で返るか／来るか・前触れのサイン・時期の段階・返った後の毎日 など）を抜き出し、
  意味の近い既存のカードの読みの中に1〜2段落として足す（カードの追加・削除・順番変更はしない。カードの正統な意味の範囲で語る）
- 抜き出すのは「何を視ているか」という内容。元ネタの文をそのまま写さず、この台本の語り口・中心メタファーで書き直す指示にする
- それでも足りない分だけ、下の補助の優先順位で膨らませる`
  : `- 不足が1,000字未満なので、「新しいアドバイスの追加」を最優先にする。元ネタ台本や、同チャンネルの合格台本にあるアドバイス（今日からできる軽い行動・構え・やらないこと・受け取り方）のうち、この台本にまだ無いものを1つ選び、解決のカード（行動を渡すカード）の中か、その直後に1段落として足す
- アドバイスはハードルが低く今日できるものに限る。本編のアドバイスは占い師の言葉として言う（守護天使様に帰属させない）。元ネタ・過去台本の文をそのまま写さず、この台本の語り口で書き直す指示にする
- それでも足りない分だけ、下の補助の優先順位で膨らませる`}

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

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 2000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "AIが混み合っています。少し待ってもう一度お試しください", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }); }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      text = ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2000 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      text = odata.choices?.[0]?.message?.content || "";
    }

    if (!text.trim()) return NextResponse.json({ error: "提案が空でした。もう一度お試しください" }, { status: 502 });
    return NextResponse.json({ suggestion: text.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "増筆提案に失敗しました" }, { status: 500 });
  }
}
