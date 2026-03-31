import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { analyses, style, topic, channelProfile, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // 分析結果をまとめる
  const analysisTexts = analyses.map((a: {
    videoTitle: string;
    channelName: string;
    views: number;
    analysisResult: {
      summary: string;
      structure: { name: string; timeRange: string; duration: string; purpose: string }[];
      hooks: string[];
      ctas: string[];
      growthFactors: string[];
      appealPoints: string[];
      overallPattern: string;
      score?: { overall: number };
    };
  }, i: number) => `
【分析${i + 1}】${a.videoTitle}（${a.channelName}）再生数: ${a.views?.toLocaleString()}回
概要: ${a.analysisResult?.summary}
構成: ${a.analysisResult?.structure?.map((s: { name: string; timeRange: string; duration: string; purpose: string }) => `${s.name}(${s.timeRange}) - ${s.purpose}`).join(" → ")}
フック: ${a.analysisResult?.hooks?.join(", ")}
CTA: ${a.analysisResult?.ctas?.join(", ")}
伸び要因: ${a.analysisResult?.growthFactors?.join(", ")}
訴求ポイント: ${a.analysisResult?.appealPoints?.join(", ")}
パターン: ${a.analysisResult?.overallPattern}
スコア: ${a.analysisResult?.score?.overall || "不明"}/10
`).join("\n");

  const profileText = channelProfile ? `
【自チャンネル設計】
チャンネル名: ${channelProfile.channelName || "未設定"}
コンセプト: ${channelProfile.concept || "未設定"}
口調: ${channelProfile.tone || "未設定"}
ターゲット: ${channelProfile.target || "未設定"}
得意ジャンル: ${channelProfile.genres?.join(", ") || "未設定"}
メインスタイル: ${channelProfile.mainStyle === "healing" ? "ヒーリング系" : channelProfile.mainStyle === "education" ? "教育系" : "両方"}
特徴: ${channelProfile.characteristics || "未設定"}
` : "";

  const prompt = `あなたは占い・スピリチュアル系YouTubeの台本構成プロデューサーです。

【最重要ルール】
- 2〜3本の参考動画の強い訴求・構成を「いいとこ取り」して上位互換の台本を作る
- 参考動画で実際に伸びている要素（フック・訴求・構成）を軸にすること
- オリジナリティを出しすぎて参考動画から乖離しないこと

以下の競合動画の台本分析を基に、「良いとこどり」の台本構成を提案してください。

${analysisTexts}
${profileText}

動画スタイル: ${style === "healing" ? "ヒーリング系（癒し・瞑想・エネルギーワーク）" : "解説・教育系（知識・解説・啓蒙）"}
テーマ: ${topic}

以下のJSON形式で提案してください。JSONのみ出力してください。

{
  "concept": "この動画のコンセプト（1-2文）",
  "structure": [
    {
      "name": "セクション名",
      "timeRange": "推定時間",
      "duration": "推定秒数",
      "description": "このセクションの内容",
      "purpose": "役割・狙い（どの分析のどの要素を取り入れたか明記）"
    }
  ],
  "keyElements": ["各分析から取り入れた重要要素のリスト"],
  "suggestedHooks": ["提案するフック（各分析の良いフックを組み合わせ）"],
  "suggestedCtas": ["提案するCTA"],
  "estimatedDuration": "推定動画尺（例: 12-15分）"
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "提案結果のパースに失敗", raw: text }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof SyntaxError ? "JSONパースに失敗" : "構成提案の生成に失敗",
    }, { status: 500 });
  }
}
