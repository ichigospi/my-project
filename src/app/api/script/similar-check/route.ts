import { NextRequest, NextResponse } from "next/server";

// 類似企画チェック
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, pastTitles, aiApiKey } = body;

  if (!aiApiKey || !title) return NextResponse.json({ error: "タイトルとAPIキーが必要です" }, { status: 400 });

  if (!pastTitles || pastTitles.length === 0) {
    return NextResponse.json({ similar: false, message: "過去の動画データがありません" });
  }

  const prompt = `以下の新しい動画タイトルが、過去に投稿した動画と内容的に被っていないかチェックしてください。

【新しいタイトル】
${title}

【過去の動画タイトル一覧】
${pastTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

以下のJSONで出力してください。JSONのみ出力。
{
  "similar": true/false,
  "similarTitle": "被っている過去動画タイトル（あれば）",
  "message": "判定理由（30字以内）",
  "suggestion": "被っている場合の差別化案（30字以内、被っていなければ空文字）"
}`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 512 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ similar: false, message: "チェック不可" });
    try { return NextResponse.json(JSON.parse(match[0])); }
    catch { return NextResponse.json({ similar: false, message: "パース失敗" }); }
  } catch {
    return NextResponse.json({ similar: false, message: "チェックに失敗" });
  }
}
