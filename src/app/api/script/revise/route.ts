import { NextRequest, NextResponse } from "next/server";

// 台本の修正指示を受けて差分修正
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, revisionNote, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
  if (!script || !revisionNote) return NextResponse.json({ error: "台本と修正指示が必要です" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `以下の台本を修正指示に従って修正してください。

【重要】
- 修正指示に該当する箇所は積極的に修正すること
- 指示が「文法を修正」なら、不自然な日本語・助詞の誤り・冗長な表現をすべて直す
- 修正後、最後に「---修正箇所---」という行を入れ、変更した箇所を箇条書きで列挙する

【修正指示】
${revisionNote}

【現在の台本】
${script}

まず修正後の台本全文を出力し、最後に修正箇所のまとめを出力してください。`;

  try {
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json(); return NextResponse.json({ error: e.error?.message || "API error" }, { status: res!.status }); }
      text = (await res!.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8192 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message || "API error" }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ script: text });
  } catch {
    return NextResponse.json({ error: "修正に失敗しました" }, { status: 500 });
  }
}
