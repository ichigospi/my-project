import { NextRequest, NextResponse } from "next/server";

// 画像からテキストを抽出（Claude Vision API）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { images, aiApiKey } = body; // images: base64[]

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  if (!isAnthropic) {
    return NextResponse.json({
      error: "画面読み取り（OCR）にはClaude APIキーが必要です（sk-ant-で始まるキー）",
    }, { status: 400 });
  }

  try {
    // 画像を5枚ずつバッチ処理
    const batchSize = 5;
    const allTexts: string[] = [];

    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);

      const content: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[] = [];

      for (const img of batch) {
        // base64のデータ部分を抽出
        const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
        const mediaType = img.match(/^data:(image\/\w+);/)?.[1] || "image/png";

        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64Data,
          },
        });
      }

      content.push({
        type: "text",
        text: `上記の${batch.length}枚の画像は、占い・スピリチュアル系YouTube動画のスクリーンショットです。
画面に表示されているテロップ・テキストをすべて正確に文字起こししてください。

ルール:
- 画面上のテキスト（テロップ）のみを抽出
- 画像の順番通りに出力
- チャンネル名、高評価ボタンなどのUI要素は無視
- 重複するテキストは1回だけ出力
- テキストのみ出力（「画像1:」などのラベルは不要）
- 段落の区切りは空行で区切る`,
      });

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

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "Claude Vision APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      if (text) allTexts.push(text);
    }

    return NextResponse.json({
      transcript: allTexts.join("\n\n"),
      imageCount: images.length,
    });
  } catch {
    return NextResponse.json({ error: "画像からのテキスト抽出に失敗しました" }, { status: 500 });
  }
}
