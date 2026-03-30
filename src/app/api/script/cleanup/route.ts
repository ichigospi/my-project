import { NextRequest, NextResponse } from "next/server";

// OCR結果 + サンプル画像を基に、Claudeが最終補正
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { rawText, sampleImages, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // コンテンツ組み立て
  const content: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[] = [];

  // サンプル画像があれば添付（最大10枚）
  if (isAnthropic && sampleImages && sampleImages.length > 0) {
    const samples = sampleImages.slice(0, 10);
    for (const img of samples) {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
      const mediaType = img.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data },
      });
    }
  }

  content.push({
    type: "text",
    text: `以下はYouTube動画のテロップをOCRで読み取った生テキストです。
${sampleImages ? "上の画像はその動画のサンプルフレームです。画像を参考にしてください。" : ""}

このテキストを以下のルールで整理してください：

1. 重複するテロップを1回だけにまとめる
2. OCRの誤読を文脈から修正する（例: 文字化け、句読点の欠落）
3. 画像を見て、OCRテキストに抜けているテロップがあれば追加する
4. テロップの表示順序を維持する
5. 各テロップは改行で区切り、場面転換は空行で区切る
6. 整理後のテキストのみ出力（説明は不要）

--- OCR生テキスト ---
${rawText.substring(0, 15000)}
--- ここまで ---`,
  });

  try {
    let text = "";

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
          max_tokens: 8192,
          messages: [{ role: "user", content }],
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.content?.[0]?.text || "";
    } else {
      // OpenAI（画像なし、テキストのみ）
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: content[content.length - 1].text }],
          max_tokens: 8192,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "テキスト整理に失敗しました" }, { status: 500 });
  }
}
