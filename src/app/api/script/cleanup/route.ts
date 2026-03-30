import { NextRequest, NextResponse } from "next/server";

// OCR結果の重複除去・誤読修正・テキスト整理
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { rawText, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `以下はYouTube動画のテロップをOCRで読み取った生テキストです。
重複や誤読が含まれています。以下のルールに従って整理してください。

ルール:
1. 重複するテロップを1回だけにまとめる（同じ内容が連続するのはフレーム重複）
2. OCRの誤読を文脈から修正する（例:「暮らと」→「愛と」、「会い魂」→「魂」）
3. 「画像1:」「1枚目:」「---」などのOCRアーティファクトを除去
4. テロップの表示順序は維持する
5. 各テロップを改行で区切り、場面の切り替わりは空行で区切る
6. 整理後のテキストのみを出力（説明や注釈は不要）

--- OCR生テキスト ---
${rawText}
--- ここまで ---`;

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
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }

      const data = await res.json();
      text = data.content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
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
