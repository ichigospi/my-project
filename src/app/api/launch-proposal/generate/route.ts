import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { serviceInfo, targetAudience, currentMetrics, apiKey, knowledgeContext } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    }

    const systemPrompt = `あなたは占い・スピリチュアル業界のローンチ戦略コンサルタントです。
${knowledgeContext ? `\n参考教材の知識:\n${knowledgeContext}\n` : ""}

以下のJSON形式で提案を返してください:
{
  "plans": [
    {
      "rank": 1,
      "name": "手法名",
      "description": "概要説明",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "timeline": "期間の目安",
      "difficulty": "初級/中級/上級"
    }
  ],
  "timelineOverview": "全体のタイムライン説明",
  "simulation": {
    "lineFollowers": 数値,
    "estimatedCvr": 数値(%),
    "price": 数値,
    "estimatedRevenue": 数値
  },
  "requiredContents": ["必要コンテンツ1", "必要コンテンツ2"],
  "risks": [
    {"risk": "リスク内容", "countermeasure": "対策"}
  ]
}`;

    const prompt = `以下の条件で最適なローンチ戦略をTOP3で提案してください。

【サービス情報】
名前: ${serviceInfo.name}
概要: ${serviceInfo.description}
価格帯: ${serviceInfo.price ? `${Number(serviceInfo.price).toLocaleString()}円` : "未定"}

【ターゲット層】
${targetAudience}

【現在の数値】
LINE友達数: ${currentMetrics.lineFollowers || "不明"}人
過去CVR: ${currentMetrics.cvr || "不明"}%
月間リスト獲得数: ${currentMetrics.monthlyLeads || "不明"}人

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
          max_tokens: 4096,
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
          max_tokens: 4096,
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

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AIからの応答をパースできませんでした", raw: result }, { status: 500 });
    }

    const proposal = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ proposal });
  } catch (e) {
    const message = e instanceof Error ? e.message : "提案生成中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
