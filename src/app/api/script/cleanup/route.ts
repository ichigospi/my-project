import { NextRequest, NextResponse } from "next/server";

// 画像バッチとOCRテキストを照合して、抜けを補完・誤読を修正
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { images, currentText, aiApiKey } = body;

  if (!aiApiKey || !aiApiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Claude APIキーが必要です" }, { status: 400 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
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
    text: `上の${images.length}枚の画像はYouTube動画の連続するスクリーンショットです。

【現在のOCRテキスト（一部抜けや誤読あり）】
${currentText.substring(0, 6000)}

【あなたのタスク】
1. 各画像のテロップ（字幕テキスト）を1枚ずつ正確に読み取る
2. 現在のOCRテキストと照合して、抜けているテロップがあれば追加する
3. 誤読があれば画像を見て正しいテキストに修正する

出力ルール:
- この画像バッチに対応するテロップのみ出力
- 画像の順番通りに出力
- 重複は1回だけ
- テロップのテキストのみ出力（説明やラベルは不要）
- 段落は空行で区切る
- YouTubeのUI要素は無視`,
  });

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
        await new Promise((resolve) => setTimeout(resolve, 20000));
        continue;
      }

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ text: data.content?.[0]?.text || "" });
    } catch {
      if (attempt === 2) return NextResponse.json({ error: "API呼び出しに失敗" }, { status: 500 });
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  return NextResponse.json({ error: "リトライ上限" }, { status: 500 });
}
