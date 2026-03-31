import { NextRequest, NextResponse } from "next/server";

// サムネイルテキスト提案（競合サムネの訴求ワードベース）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, hooks, script, competitorTitles, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const prompt = `占い・スピリチュアル系YouTube動画のサムネイルに載せるキャッチコピーを提案してください。

【動画タイトル】${title}
【フック】${hooks?.join(" / ") || "なし"}
【台本冒頭】${script?.substring(0, 300) || "なし"}

【伸びている競合動画のタイトル（サムネの訴求ワードの参考元）】
${competitorTitles?.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") || "データなし"}

【鉄則】
- サムネの訴求ワードは原則として伸びている競合動画のサムネ/タイトルから持ってくること
- 競合で実際に使われて伸びているワードを軸にすること
- オリジナリティを出しすぎない

以下の条件で5つ提案:
- 10〜15文字以内
- 一目で感情を動かすインパクト
- タイトルと補完関係（重複しない）

以下のJSON配列のみ出力してください。説明文は不要。
[{"text":"キャッチコピー","reason":"このワードを選んだ理由（30字以内）","source":"参考にした競合動画タイトル（あれば）"}]`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 1024 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ suggestions: [] });
    try { return NextResponse.json({ suggestions: JSON.parse(match[0]) }); }
    catch { return NextResponse.json({ suggestions: [] }); }
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
