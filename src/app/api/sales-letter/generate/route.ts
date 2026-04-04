import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const {
      productName, productPrice, fortuneType, targetPersona,
      launchType, totalDays, apiKey, knowledgeContext,
    } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    }

    const launchLabels: Record<string, string> = {
      product_launch: "プロダクトローンチ",
      evergreen: "エバーグリーン",
      webinar: "ウェビナー",
      challenge: "チャレンジ",
    };

    const systemPrompt = `あなたは占い・スピリチュアル業界のLINEマーケティング専門家です。
セールスレター（LINE配信シナリオ）を作成します。
${knowledgeContext ? `\n参考教材の知識:\n${knowledgeContext}\n` : ""}

以下のルールに従ってください:
- 占い・スピリチュアル系のトーン（宇宙、エネルギー、直感、運命等のワードを適切に使用）
- 各メッセージは200-400文字程度（LINEで読みやすい長さ）
- CTA（行動喚起）は明確に
- 心理トリガーを効果的に配置
- 結果はJSON配列で返してください

JSONフォーマット:
[
  {
    "sequenceOrder": 1,
    "dayOffset": 0,
    "phase": "pre_pre",
    "subject": "件名/1行目",
    "body": "本文",
    "cta": "CTA文面",
    "psychologyTriggers": ["希少性", "権威性"]
  }
]

phaseは: pre_pre（認知・興味喚起）, pre（教育・信頼構築）, launch（販売・オファー）, post（フォローアップ）`;

    const prompt = `以下の条件でLINE配信シナリオ（セールスレター）を${totalDays}日分作成してください。

商品名: ${productName}
価格: ${productPrice ? `${Number(productPrice).toLocaleString()}円` : "未定"}
占術ジャンル: ${fortuneType || "指定なし"}
ターゲット: ${targetPersona || "占い・スピリチュアルに興味がある女性"}
ローンチ方式: ${launchLabels[launchType] || launchType}
配信日数: ${totalDays}日

JSONのみを返してください。`;

    const isClaude = apiKey.startsWith("sk-ant-");
    let result: string;

    if (isClaude) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      result = data.content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 8192,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      result = data.choices?.[0]?.message?.content || "";
    }

    // Extract JSON from response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIからの応答をパースできませんでした", raw: result }, { status: 500 });
    }

    const messages = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
