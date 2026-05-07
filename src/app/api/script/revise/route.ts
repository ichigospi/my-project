import { NextRequest, NextResponse } from "next/server";

// 台本の修正指示を受けて差分修正
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, revisionNote, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
  if (!script || !revisionNote) return NextResponse.json({ error: "台本と修正指示が必要です" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `以下の台本を「修正指示」に従って **必要最小限** に修正してください。

【絶対ルール】
- 修正指示で明示的に挙げられた問題箇所だけを直す
- 指示されていない部分は **1文字も変えない**（並び替え・言い換え・改行調整も禁止）
- 既に合格していた要素・フレーズ・構成は完全にそのまま残す
- 修正は「該当文/該当ブロックの差分編集」のように最小限のスコープに留める
- 結果として、修正前と修正後の差分が小さくなるようにする
- 全体を書き直さない。指示に関係ない部分の言い回しは絶対に変えない
- 「文法を修正」のような全体指示が来た場合のみ、明らかな誤り（助詞の誤り・誤字）に限って直し、それ以外は触らない

【修正指示】
${revisionNote}

【現在の台本】
${script}

修正後の台本全文を出力したあと、最後に「---修正箇所---」という行を入れ、変更した箇所を箇条書きで列挙してください（変更してない部分は記載しない）。`;

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
