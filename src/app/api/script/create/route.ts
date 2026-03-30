import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { proposal, channelProfile, style, topic, additionalNotes, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const structureText = proposal?.structure
    ?.map((s: { name: string; timeRange: string; description: string; purpose: string }, i: number) =>
      `${i + 1}. ${s.name}（${s.timeRange}）\n   内容: ${s.description}\n   狙い: ${s.purpose}`
    )
    .join("\n") || "";

  const profileText = channelProfile ? `
【自チャンネル設計】
チャンネル名: ${channelProfile.channelName || "未設定"}
コンセプト: ${channelProfile.concept || "未設定"}
口調・話し方: ${channelProfile.tone || "未設定"}
ターゲット層: ${channelProfile.target || "未設定"}
得意ジャンル: ${channelProfile.genres?.join(", ") || "未設定"}
スタイル: ${channelProfile.mainStyle === "healing" ? "ヒーリング系メイン" : channelProfile.mainStyle === "education" ? "教育系メイン" : "両方"}
特徴・こだわり: ${channelProfile.characteristics || "未設定"}
` : "";

  const prompt = `あなたは占い・スピリチュアル系YouTubeの台本ライターです。

以下の構成提案と自チャンネル設計を基に、完全な台本を作成してください。

【テーマ】${topic}
【スタイル】${style === "healing" ? "ヒーリング系（癒し・瞑想・エネルギーワーク中心）" : "解説・教育系（知識・解説中心）"}
${profileText}

【構成提案】
コンセプト: ${proposal?.concept || ""}
推定尺: ${proposal?.estimatedDuration || "10-15分"}

${structureText}

【取り入れるべきフック】
${proposal?.suggestedHooks?.join("\n") || "特になし"}

【取り入れるべきCTA】
${proposal?.suggestedCtas?.join("\n") || "特になし"}

【重要要素】
${proposal?.keyElements?.join("\n") || "特になし"}

${additionalNotes ? `【追加指示】\n${additionalNotes}` : ""}

以下のルールに従って台本を書いてください：
- 視聴者に直接語りかける温かく親しみやすい口調
- ${style === "healing" ? "癒しと安心感を与える穏やかなトーン" : "わかりやすく知識を伝える信頼感のあるトーン"}
- 各セクションを「## セクション名」で区切る
- セリフ形式で書く（「」は使わず、そのまま話す言葉として書く）
- 具体的なエピソードや例え話を入れる
- 感情に訴えるフレーズを要所に入れる
- 台本テキストのみを出力（メタ的な説明は不要）`;

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
          max_tokens: 8192,
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
          max_tokens: 8192,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ script: text });
  } catch {
    return NextResponse.json({ error: "台本生成に失敗しました" }, { status: 500 });
  }
}
