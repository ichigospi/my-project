import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { imageBase64, mediaType, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    }
    if (!imageBase64) {
      return NextResponse.json({ error: "画像データが必要です" }, { status: 400 });
    }

    const isClaude = apiKey.startsWith("sk-ant-");

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
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/png",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "この画像のテキストをすべて抽出してください。レイアウトや改行をできるだけ維持してください。テキストのみを返してください。",
              },
            ],
          }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return NextResponse.json({ text: data.content?.[0]?.text || "" });
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mediaType || "image/png"};base64,${imageBase64}` },
              },
              {
                type: "text",
                text: "この画像のテキストをすべて抽出してください。レイアウトや改行をできるだけ維持してください。テキストのみを返してください。",
              },
            ],
          }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return NextResponse.json({ text: data.choices?.[0]?.message?.content || "" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "OCR処理エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
