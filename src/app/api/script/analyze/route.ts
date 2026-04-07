import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeの台本分析の専門家です。
与えられた台本を分析し、必ず有効なJSONのみを出力してください。
JSON以外のテキスト（説明文、マークダウン、コードブロック記法）は一切出力しないでください。`;

function buildUserPrompt(transcript: string, videoTitle: string, channelName: string, views: number) {
  return `以下の動画の台本を分析してください。

動画タイトル: ${videoTitle}
チャンネル名: ${channelName}
再生回数: ${views ? views.toLocaleString() + '回' : '不明'}

--- 台本テキスト ---
${transcript.substring(0, 8000)}
--- ここまで ---

以下のJSON形式で出力:
{
  "summary": "概要（2-3文）",
  "structure": [{"name": "セクション名", "timeRange": "0:00-0:30", "duration": "30秒", "description": "内容", "purpose": "役割"}],
  "hooks": ["フック要素"],
  "ctas": ["CTA内容"],
  "growthFactors": ["伸びている要因"],
  "appealPoints": ["訴求ポイント"],
  "targetEmotion": "ターゲット感情",
  "overallPattern": "台本パターン",
  "score": {"hookStrength": 8, "ctaEffectiveness": 7, "structureBalance": 9, "emotionalAppeal": 8, "overall": 8}
}`;
}

function parseJSON(text: string): Record<string, unknown> | null {
  // 試行1: そのままパース
  try { return JSON.parse(text.trim()); } catch {}

  // コードブロック除去
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}

  // 試行2: JSONオブジェクト部分を抽出
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try { return JSON.parse(jsonMatch[0]); } catch {}

  // 試行3: 制御文字・トレーリングカンマ除去
  try {
    const sanitized = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\t' ? c : '')
      .replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(sanitized);
  } catch {}

  return null;
}

async function callAnthropic(
  aiApiKey: string, userPrompt: string
): Promise<{ text: string; retryable: boolean; error?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
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
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt },
          { role: "assistant", content: "{" }, // prefill: JSON開始を強制
        ],
      }),
    });

    if (res.status === 429 || res.status === 529) {
      if (attempt === 2) return { text: "", retryable: true, error: "Overloaded" };
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      const err = await res.json();
      return { text: "", retryable: false, error: err.error?.message || "API error" };
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || "";
    return { text: "{" + raw, retryable: false }; // prefillの「{」を先頭に付与
  }
  return { text: "", retryable: true, error: "リトライ上限" };
}

async function callOpenAI(
  aiApiKey: string, userPrompt: string
): Promise<{ text: string; retryable: boolean; error?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { text: "", retryable: false, error: err.error?.message || "API error" };
  }

  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || "", retryable: false };
}

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
  const userPrompt = buildUserPrompt(transcript, videoTitle, channelName, views);

  // 最大3回パース試行（APIを再呼び出し）
  for (let parseAttempt = 0; parseAttempt < 3; parseAttempt++) {
    try {
      const result = isAnthropic
        ? await callAnthropic(aiApiKey, userPrompt)
        : await callOpenAI(aiApiKey, userPrompt);

      if (result.retryable) {
        return NextResponse.json({ error: result.error || "Overloaded", retryable: true }, { status: 529 });
      }
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      const analysis = parseJSON(result.text);
      if (analysis) {
        return NextResponse.json(analysis);
      }

      // パース失敗 → リトライ
      console.warn(`[analyze] JSON parse failed (attempt ${parseAttempt + 1}/3). Raw:`, result.text.substring(0, 300));
      if (parseAttempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      // 最終手段: テキストからでも部分的に返す
      console.error("[analyze] All parse attempts failed. Raw:", result.text.substring(0, 500));
      return NextResponse.json({ error: "JSON形式が不正です。再度お試しください。", retryable: true }, { status: 500 });
    } catch (error) {
      console.error("[analyze] error:", error);
      if (parseAttempt === 2) {
        return NextResponse.json({ error: "台本分析に失敗しました", retryable: true }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: "分析に失敗しました", retryable: true }, { status: 500 });
}
