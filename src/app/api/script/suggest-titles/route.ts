import { NextRequest, NextResponse } from "next/server";

// 競合+自チャンネルデータからタイトル候補を提案
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { genre, style, competitorTitles, selfTopVideos, performanceData, hookPatterns, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const genreLabel = { love: "恋愛運", money: "金運", general: "総合運" }[genre] || genre;
  const styleLabel = style === "healing" ? "ヒーリング系" : "教育系";

  const prompt = `あなたは占い・スピリチュアル系YouTubeの企画プロデューサーです。

【ジャンル】${genreLabel}
【スタイル】${styleLabel}

【直近1ヶ月で伸びている競合動画タイトル】
${competitorTitles?.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") || "データなし"}

【自チャンネルで伸びた動画】
${selfTopVideos?.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") || "データなし"}

【過去の自チャンネル実績パターン】
${performanceData || "データなし"}

【高スコアのフックパターン】
${hookPatterns || "データなし"}

上記を踏まえて、今作るべき動画のタイトル候補を5つ提案してください。

以下のJSON配列で出力してください。JSONのみ出力。
[
  {
    "title": "タイトル案",
    "reason": "なぜこのタイトルが伸びると思うか（50字以内）",
    "sourceVideo": "参考にした競合動画タイトル（あれば）",
    "sourceChannel": "参考チャンネル名（あれば）",
    "estimatedPotential": "high または medium"
  }
]`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";

    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2048 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "パース失敗", raw: text }, { status: 500 });
    return NextResponse.json({ candidates: JSON.parse(match[0]) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof SyntaxError ? "JSONパース失敗" : "タイトル提案に失敗" }, { status: 500 });
  }
}
