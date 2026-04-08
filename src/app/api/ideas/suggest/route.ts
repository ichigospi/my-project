import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { genre, style, prompt: userPrompt, competitorVideos, selfTopVideos, hookPatterns, ideaRules, winningPatterns, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const genreLabels: Record<string, string> = { love: "恋愛運", money: "金運", general: "総合運" };
  const genreLabel = genreLabels[genre] || genre;
  const styleLabel = style === "healing" ? "ヒーリング系" : "教育系";

  let rulesBlock = "";
  if (ideaRules) {
    const parts: string[] = [];
    if (ideaRules.direction) parts.push(`チャンネルの方向性: ${ideaRules.direction}`);
    if (ideaRules.constraints) parts.push(`制約条件: ${ideaRules.constraints}`);
    if (ideaRules.priority) parts.push(`重視する指標: ${ideaRules.priority}`);
    if (ideaRules.thumbnailPolicy) parts.push(`サムネ・タイトル方針: ${ideaRules.thumbnailPolicy}`);
    if (ideaRules.ngThemes) parts.push(`NGテーマ: ${ideaRules.ngThemes}`);
    if (parts.length > 0) rulesBlock = `\n【企画ルール】\n${parts.join("\n")}`;
  }

  const prompt = `あなたは占い・スピリチュアル系YouTubeの企画プロデューサーです。
${genreLabel}×${styleLabel}の動画企画を5つ提案してください。

鉄則:
- 伸びている競合動画をベースにした上位互換企画を提案
- 各企画にサムネワードとフック案も提案
- 競合から離れすぎた独自企画はNG
${rulesBlock}

競合の人気動画:
${competitorVideos?.slice(0, 15).map((v: { title: string; channel: string; views: number }, i: number) => `${i + 1}. ${v.title}（${v.channel} / ${v.views?.toLocaleString()}回）`).join("\n") || "データなし"}
${selfTopVideos?.length > 0 ? `\n自チャンネルの実績:\n${selfTopVideos.join("\n")}` : ""}
${hookPatterns ? `\n効果的なフック: ${hookPatterns}` : ""}
${winningPatterns ? `\n勝ちパターン: ${winningPatterns}` : ""}
${userPrompt ? `\nユーザーの指示: ${userPrompt}` : ""}

以下のJSON配列のみ出力。説明文は不要。{から始めないでください。[から始めてください。
[{"title":"企画タイトル案","description":"企画の概要と狙い（2-3文）","hooks":["フック案1","フック案2"],"thumbnailWords":["サムネワード1","サムネワード2"],"targetEmotion":"狙う感情","estimatedPotential":"high","sourceVideo":"参考にした競合動画タイトル","reason":"この企画が伸びる理由"}]`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 4096,
            system: "あなたはYouTube企画プロデューサーです。JSON配列のみを出力してください。",
            messages: [{ role: "user", content: prompt }],
          }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 4096 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "AIの応答をパースできませんでした", retryable: true }, { status: 500 });

    const ideas = JSON.parse(match[0]);
    return NextResponse.json({ ideas });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "企画提案に失敗", retryable: true }, { status: 500 });
  }
}
