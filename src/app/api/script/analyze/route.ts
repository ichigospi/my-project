import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transcript, videoTitle, channelName, views, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  if (!transcript || transcript.trim().length < 50) {
    return NextResponse.json({ error: "台本テキストが短すぎます（50文字以上必要）" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `あなたは占い・スピリチュアル系YouTubeの台本分析の専門家です。

以下の動画の台本（文字起こし）を分析してください。

動画タイトル: ${videoTitle}
チャンネル名: ${channelName}
再生回数: ${views ? views.toLocaleString() + '回' : '不明'}

--- 台本テキスト ---
${transcript.substring(0, 8000)}
--- ここまで ---

以下のJSON形式で分析結果を返してください。JSONのみ出力し、それ以外のテキストは出力しないでください。

{
  "summary": "この台本の概要（2-3文）",
  "structure": [
    {
      "name": "セクション名（例: オープニング・フック）",
      "timeRange": "推定時間（例: 0:00-0:30）",
      "duration": "推定秒数（例: 30秒）",
      "description": "このセクションで話している内容",
      "purpose": "このセクションの役割・狙い"
    }
  ],
  "hooks": ["冒頭や途中で使われているフック・引きの要素（配列）"],
  "ctas": ["CTA（行動喚起）の内容と手法（配列）"],
  "growthFactors": ["この動画が伸びている要因の分析（配列）"],
  "appealPoints": ["視聴者に刺さっている訴求ポイント（配列）"],
  "targetEmotion": "ターゲットにしている感情（例: 不安からの安心、好奇心、希望）",
  "overallPattern": "台本全体のパターン分類（例: 問題提起→共感→解決→行動促進）",
  "score": {
    "hookStrength": 8,
    "ctaEffectiveness": 7,
    "structureBalance": 9,
    "emotionalAppeal": 8,
    "overall": 8
  }
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
          max_tokens: 4096,
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "分析結果のパースに失敗しました", raw: text }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof SyntaxError ? "分析結果のJSONパースに失敗" : "台本分析に失敗しました",
    }, { status: 500 });
  }
}
