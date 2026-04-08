import { NextRequest, NextResponse } from "next/server";

// 台本テキスト → テロップ形式に変換
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, aiApiKey } = body;

  if (!aiApiKey || !script) return NextResponse.json({ error: "台本とAPIキーが必要です" }, { status: 400 });

  const prompt = `以下の台本テキストを、YouTube動画のテロップ（字幕）形式に変換してください。

【台本】
${script.substring(0, 10000)}

変換ルール:
- 1テロップ＝1-2行（15-30文字程度）
- 読みやすい区切りで分割
- 句読点で区切る
- セクションの区切りは空行

以下のJSON配列で出力。JSONのみ。
[
  {"text": "テロップテキスト", "displaySeconds": 4, "section": "セクション名"},
  ...
]

displaySecondsは文字数に応じて3-6秒で設定。`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
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
      if (!res!.ok) { const e = await res!.json(); return NextResponse.json({ error: e.error?.message }, { status: res!.status }); }
      text = (await res!.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8192 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "パース失敗" }, { status: 500 });
    let telops;
    try {
      telops = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "AIの応答をパースできませんでした。再度お試しください。" }, { status: 500 });
    }
    const totalSeconds = telops.reduce((sum: number, t: { displaySeconds: number }) => sum + t.displaySeconds, 0);
    return NextResponse.json({ telops, totalSeconds, telopCount: telops.length });
  } catch {
    return NextResponse.json({ error: "テロップ変換に失敗" }, { status: 500 });
  }
}
