import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message, conversationHistory, apiKey, knowledgeContext, templates } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    }

    const systemPrompt = `あなたは占い・スピリチュアル系サービスのLINEカスタマーサポート担当です。
丁寧かつ温かみのある、スピリチュアルな雰囲気を持った返信を作成します。
${knowledgeContext ? `\n参考知識:\n${knowledgeContext}\n` : ""}
${templates ? `\n使用可能なテンプレート:\n${templates}\n` : ""}

3つの異なるトーンの返信候補をJSON配列で返してください:
[
  {"tone": "丁寧", "reply": "返信文"},
  {"tone": "カジュアル", "reply": "返信文"},
  {"tone": "スピリチュアル", "reply": "返信文"}
]`;

    const historyText = conversationHistory
      ? conversationHistory.map((m: { direction: string; content: string }) =>
          `${m.direction === "incoming" ? "お客様" : "自分"}: ${m.content}`
        ).join("\n")
      : "";

    const prompt = `以下のLINEメッセージに対する返信候補を3つ作成してください。

${historyText ? `【会話履歴】\n${historyText}\n\n` : ""}【最新メッセージ】
${message}

JSONのみを返してください。`;

    const isClaude = apiKey.startsWith("sk-ant-");
    let result: string;

    if (isClaude) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      result = data.content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      result = data.choices?.[0]?.message?.content || "";
    }

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "パースエラー", raw: result }, { status: 500 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "返信生成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
