import { NextRequest, NextResponse } from "next/server";

// 最大20枚の画像を一括でClaude Visionに送信してOCR
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { images, aiApiKey } = body;

  if (!aiApiKey || !aiApiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Claude APIキーが必要です" }, { status: 400 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }

  const content: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[] = [];

  for (const img of images) {
    const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
    const mediaType = img.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    });
  }

  content.push({
    type: "text",
    text: `上の${images.length}枚の画像はYouTube動画の連続するスクリーンショットです。
各画面に表示されているテロップ（字幕テキスト）を1枚ずつ漏れなく正確に書き起こしてください。

ルール:
- 各画像のテロップを必ず読み取る（飛ばさない）
- テロップが無い画像はスキップ
- 同じテロップが連続する場合は1回だけ出力
- YouTubeのUI要素は無視
- テロップのテキストのみ出力
- 各テロップは改行で区切り、場面転換は空行で区切る`,
  });

  // リトライ付き
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
          max_tokens: 4096,
          messages: [{ role: "user", content }],
        }),
      });

      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ text: data.content?.[0]?.text || "" });
    } catch {
      if (attempt === 2) return NextResponse.json({ error: "API呼び出し失敗" }, { status: 500 });
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  return NextResponse.json({ error: "リトライ上限" }, { status: 500 });
}
