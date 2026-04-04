import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { messages, launchType, competitorName, apiKey, knowledgeContext } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "分析するメッセージがありません" }, { status: 400 });
    }

    const messagesText = messages
      .sort((a: { sequenceOrder: number }, b: { sequenceOrder: number }) => a.sequenceOrder - b.sequenceOrder)
      .map((m: { sequenceOrder: number; phase?: string; rawContent?: string; sourceType: string }, i: number) => {
        const phase = m.phase || "不明";
        return `【配信${i + 1} / フェーズ: ${phase}】\n${m.rawContent || "(内容なし)"}`;
      })
      .join("\n\n---\n\n");

    const launchTypeLabels: Record<string, string> = {
      product_launch: "プロダクトローンチ",
      evergreen: "エバーグリーン",
      webinar: "ウェビナー",
      challenge: "チャレンジ",
    };

    const systemPrompt = `あなたは占い・スピリチュアル業界のマーケティング専門家です。
LINE配信を中心としたローンチ戦略の分析に精通しています。
${knowledgeContext ? `\n以下は参考となる教材の知識です:\n${knowledgeContext}\n` : ""}
分析結果は日本語で、以下の構成で出力してください:

1. 【ローンチ構成分析】 - プリプリ→プリ→ローンチ→ポストの各フェーズの特徴
2. 【配信パターン】 - 配信頻度、タイミング、テンション変化
3. 【心理トリガー分析】 - 使用されている心理テクニック（希少性、権威性、社会的証明、スピ系特有の表現）
4. 【オファー構成】 - フロントエンド/バックエンド商品の推定、価格戦略
5. 【ファネル構造】 - 推定される顧客導線
6. 【強み・弱み】 - このローンチの優れている点と改善余地
7. 【自分のローンチへの示唆】 - 参考にすべきポイントと差別化のヒント`;

    const prompt = `以下は「${competitorName}」の${launchTypeLabels[launchType] || launchType}型ローンチにおけるLINE配信メッセージです。
これらを分析してください。

${messagesText}`;

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

    return NextResponse.json({ analysis: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "分析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
