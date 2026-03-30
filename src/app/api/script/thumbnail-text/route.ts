import { NextRequest, NextResponse } from "next/server";

// サムネイルテキスト提案
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, hooks, script, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const prompt = `占い・スピリチュアル系YouTube動画のサムネイルに載せるキャッチコピーを提案してください。

【動画タイトル】${title}
【フック】${hooks?.join(" / ") || "なし"}
【台本冒頭】${script?.substring(0, 500) || "なし"}

以下の条件で5つ提案してください:
- 10〜15文字以内
- 一目で感情を動かすインパクト
- タイトルと補完関係（重複しない）
- 視聴者の不安・期待・好奇心を刺激

JSON配列で出力。JSONのみ。
["キャッチ1", "キャッチ2", "キャッチ3", "キャッチ4", "キャッチ5"]`;

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
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ texts: [] });
    return NextResponse.json({ texts: JSON.parse(match[0]) });
  } catch {
    return NextResponse.json({ texts: [] });
  }
}
