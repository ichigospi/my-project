import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

export const maxDuration = 300;

// 台本テキスト → 動画のシーン構成(尺・テロップ・AI素材生成用プロンプト)に変換
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, aiApiKey, aspect = "9:16", targetSeconds = 60 } = body;
  const aiModel = resolveAiModel(body.aiModel);

  if (!aiApiKey || !script) {
    return NextResponse.json({ error: "台本とAIのAPIキーが必要です" }, { status: 400 });
  }

  const prompt = `あなたは動画編集者です。以下の台本を、${aspect === "9:16" ? "縦型ショート" : "横型"}動画(合計${targetSeconds}秒程度)のシーン構成に変換してください。

【台本】
${String(script).substring(0, 12000)}

ルール:
- シーン数は4〜10個。1シーン4〜12秒
- narration はそのシーンで読み上げる/伝える内容の要約(台本の言葉を活かす)
- telops は画面に出す字幕。1テロップ15〜25文字、1シーンに1〜3個。start/end はシーン内の秒数で、シーンの尺に収める
- visualPrompt はそのシーンの映像をAI生成するための英語プロンプト。被写体・雰囲気・カメラワークを具体的に。テキスト描画の指示は入れない
- 実在の人物名・ロゴ・著作物は visualPrompt に入れない

以下のJSON配列のみを出力:
[
  {
    "section": "フック",
    "narration": "シーンで伝える内容",
    "duration": 6,
    "telops": [{"text": "テロップ文", "start": 0.5, "end": 5.5}],
    "visualPrompt": "cinematic ..."
  }
]`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({
            model: aiModel,
            max_tokens: 8192,
            messages: [{ role: "user", content: prompt }],
            ...anthropicExtraBody(aiModel),
          }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) {
        const e = await res!.json();
        return NextResponse.json({ error: e.error?.message || "AI APIエラー" }, { status: res!.status });
      }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      text = (data.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text || "")
        .join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8192 }),
      });
      if (!res.ok) {
        const e = await res.json();
        return NextResponse.json({ error: e.error?.message || "AI APIエラー" }, { status: res.status });
      }
      const data = await res.json();
      recordUsage({ model: "gpt-4o", usage: data.usage });
      text = data.choices?.[0]?.message?.content || "";
    }

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "シーン構成のパースに失敗しました" }, { status: 500 });
    let scenes;
    try {
      scenes = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "シーン構成のJSONが不正です" }, { status: 500 });
    }
    return NextResponse.json({ scenes });
  } catch (e) {
    console.error("POST /api/video/plan", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
