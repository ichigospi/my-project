import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic, sectionName, sectionDescription, templateName, allSections, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({
      error: "AI APIキーが設定されていません。設定ページから登録してください。",
    }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const systemPrompt = `あなたは占い・スピリチュアル系YouTubeチャンネルの台本ライターです。

以下のルールに従って台本を書いてください：
- 視聴者に語りかける温かく親しみやすい口調
- スピリチュアルな雰囲気を出しつつも、わかりやすい言葉を使う
- 視聴者の共感を得られるフレーズを散りばめる
- 「〜なんですね」「〜していきましょう」など親しみのある語尾
- 具体的なアドバイスや行動指針を入れる
- 台本のテキストのみ出力（見出しやラベルは不要）`;

  const sectionList = allSections
    ? `\n\n台本全体の構成:\n${allSections.map((s: { name: string; description: string }, i: number) => `${i + 1}. ${s.name} - ${s.description}`).join("\n")}`
    : "";

  const userPrompt = `テンプレート: ${templateName}
セクション: ${sectionName}
セクションの目的: ${sectionDescription}
テーマ: ${topic || "（テーマ未指定・汎用的に書いてください）"}${sectionList}

このセクションの台本を書いてください。`;

  try {
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": aiApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (!res!.ok) {
        const error = await res!.json();
        return NextResponse.json(
          { error: error.error?.message || "Claude APIエラー" },
          { status: res!.status }
        );
      }

      const data = await res!.json();
      const text = data.content?.[0]?.text || "";
      return NextResponse.json({ text });
    } else {
      // OpenAI互換
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "OpenAI APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      return NextResponse.json({ text });
    }
  } catch (error) {
    return NextResponse.json({ error: "台本生成に失敗しました" }, { status: 500 });
  }
}
