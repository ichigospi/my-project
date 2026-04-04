import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, aiApiKey, context } = body;

  if (!aiApiKey) {
    return NextResponse.json(
      { error: "AI APIキーが設定されていません。" },
      { status: 400 }
    );
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const systemPrompt = `あなたは占い・スピリチュアル分野のプロライターです。
SEOを意識した記事を作成します。

ルール:
- 読みやすいMarkdown形式で出力
- H2/H3の見出し構造を使用
- 導入文で読者の興味を引く
- 具体的なアドバイスを含める
- 温かく親しみやすいトーン
- 2000〜4000文字程度`;

  let userPrompt = "";

  switch (type) {
    case "from_script": {
      const { scriptContent, scriptTitle } = context || {};
      userPrompt = `以下のYouTube台本をブログ記事にリライトしてください。

台本タイトル: ${scriptTitle || "（未指定）"}
台本内容:
${scriptContent || "（台本が入力されていません）"}

口語体を書き言葉に変換し、記事として読みやすい形に整えてください。
SEO向けのタイトル案も3つ提案してください。`;
      break;
    }

    case "trend": {
      const { trendKeyword, angle } = context || {};
      userPrompt = `以下のトレンドキーワードを占い・スピリチュアルの視点から解説する記事を作成してください。

キーワード: ${trendKeyword || "（未指定）"}
${angle ? `切り口: ${angle}` : ""}

SEO向けのタイトル案も3つ提案してください。`;
      break;
    }

    case "curated": {
      const { topic, tweets } = context || {};
      userPrompt = `以下のトピックに関するまとめ記事を作成してください。

トピック: ${topic || "（未指定）"}
${tweets ? `参考ツイート:\n${tweets}` : ""}

占い・スピリチュアルの視点を交えつつ、多様な意見をバランスよくまとめてください。
SEO向けのタイトル案も3つ提案してください。`;
      break;
    }

    default:
      return NextResponse.json({ error: "不正な記事タイプです" }, { status: 400 });
  }

  try {
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "Claude APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json({ content: data.content?.[0]?.text || "" });
    } else {
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
          max_tokens: 4096,
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
      return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
    }
  } catch {
    return NextResponse.json({ error: "記事生成に失敗しました" }, { status: 500 });
  }
}
