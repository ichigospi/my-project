import { NextRequest, NextResponse } from "next/server";

// 1バッチ分（数枚）の画像からテキストを抽出
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { images, aiApiKey } = body; // images: base64[] (少数枚)

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  if (!isAnthropic) {
    return NextResponse.json({ error: "画面読み取りにはClaude APIキーが必要です" }, { status: 400 });
  }

  const content: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[] = [];

  for (const img of images) {
    const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
    const mediaType = img.match(/^data:(image\/\w+);/)?.[1] || "image/png";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    });
  }

  content.push({
    type: "text",
    text: `上の${images.length}枚の画像はYouTube動画のスクリーンショットです。
画面に表示されているテロップ（字幕テキスト）を1枚ずつすべて正確に書き起こしてください。

重要なルール:
- 各画像のテロップを必ず1枚ずつ読み取ること（飛ばさない）
- テロップが無い画像は飛ばしてOK
- YouTubeのUI（チャンネル名、再生バー等）は無視
- テキストのみ出力
- 各テロップの間は空行で区切る`,
  });

  // リトライ付きAPI呼び出し
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{ role: "user", content }],
        }),
      });

      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
        continue;
      }

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      return NextResponse.json({ text });
    } catch {
      if (attempt === 2) {
        return NextResponse.json({ error: "API呼び出しに失敗" }, { status: 500 });
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  return NextResponse.json({ error: "リトライ上限に達しました" }, { status: 500 });
}
