import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { channelData, recentVideoTitles, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `あなたはYouTubeチャンネルの分析専門家です。

以下のチャンネル情報を分析して、アカウント設計を提案してください。

【チャンネル情報】
チャンネル名: ${channelData.name}
説明: ${channelData.description || "なし"}
登録者数: ${channelData.subscribers?.toLocaleString() || "不明"}人
総再生回数: ${channelData.totalViews?.toLocaleString() || "不明"}回
動画数: ${channelData.videoCount || "不明"}本

【最近の動画タイトル】
${recentVideoTitles?.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") || "取得できませんでした"}

以下のJSON形式で提案してください。JSONのみ出力してください。

{
  "channelName": "チャンネル名",
  "concept": "このチャンネルのコンセプト（動画内容から推測、1-2文）",
  "tone": "口調・話し方の特徴（動画タイトルやチャンネル説明から推測）",
  "target": "ターゲット層（推測）",
  "genres": ["得意ジャンル1", "得意ジャンル2", "得意ジャンル3"],
  "mainStyle": "healing または education または both",
  "characteristics": "その他の特徴・強み（推測）"
}`;

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
          max_tokens: 2048,
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
          max_tokens: 2048,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "提案のパースに失敗", raw: text }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof SyntaxError ? "JSONパースに失敗" : "プロフィール提案に失敗",
    }, { status: 500 });
  }
}
