import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `あなたはプロのスピーチマーケター兼YouTube台本分析の専門家です。
この分析結果は「元ネタを超える上位互換の台本」を作るための設計図になります。
そのため、抽象的な要約ではなく、元ネタが実際に使っている訴求の「具体性」（数字・固有のシチュエーション・感情の動き）をそのまま捉えてください。
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
  "idealFuture": "この台本が描く『理想の未来（欲求喚起）』。視聴者がこうなりたいと思う状態を、台本内の具体的な表現（数字・金額・固有のシチュエーション）込みで記述。抽象化しない",
  "worstFuture": "この台本が描く『最悪の未来』。視聴者が回避したい恐怖・損失を、台本内の具体的な表現込みで記述。描かれていない場合は『なし』",
  "retentionTactics": ["視聴維持率を確保し離脱を防いでいる仕掛け（次の展開の予告、問いかけ、間の取り方、感情の起伏、テンポ等）を具体的に"],
  "worldview": "世界観の演出方法（独自の用語、比喩、スピリチュアルな世界観の作り込み方、視聴者の没入を生む語り口）",
  "thumbnailWords": ["サムネイルに使うと効果的なパワーワード（タイトルや台本から抽出、3-5個）"],
  "titleElements": ["このタイトルの効果的な要素（数字訴求、限定感、感情喚起など、2-4個）"],
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
          { role: "user", content: userPrompt + "\n\nJSONのみ出力してください。```は不要です。{から始めてください。" },
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
    return { text: raw, retryable: false };
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
