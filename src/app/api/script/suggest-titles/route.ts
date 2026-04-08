import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { genre, style, competitorVideos, selfTopVideos, performanceData, hookPatterns, aiApiKey, excludeTitles, directionNote } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const genreLabels: Record<string, string> = { love: "恋愛運", money: "金運", general: "総合運" };
  const genreLabel = genreLabels[genre] || genre;
  const styleLabel = style === "healing" ? "ヒーリング系" : "教育系";

  // シンプルなプロンプト（JSON出力の信頼性を最優先）
  const prompt = `占い・スピリチュアル系YouTubeの企画プロデューサーとして、${genreLabel}×${styleLabel}の動画タイトルを5つ提案してください。

鉄則: 伸びている競合動画をベースにした上位互換企画を提案すること。競合から離れすぎた独自企画はNG。

競合の人気動画:
${competitorVideos?.slice(0, 15).map((v: { title: string; channel: string; views: number }, i: number) => `${i + 1}. ${v.title}（${v.channel} / ${v.views}回）`).join("\n") || "データなし"}
${selfTopVideos?.length > 0 ? `\n自チャンネルの実績:\n${selfTopVideos.join("\n")}` : ""}
${excludeTitles?.length > 0 ? `\n以下は提案済みなので除外:\n${excludeTitles.join(", ")}` : ""}
${directionNote ? `\n方向性: ${directionNote}` : ""}

以下のJSON配列のみ出力してください。説明文は不要です。
[{"title":"タイトル案","reason":"理由50字","appealPattern":"訴求パターン名","estimatedPotential":"high","sourceVideo":"参考にした競合動画タイトル","sourceChannel":"チャンネル名"}]`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2048 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    // JSON抽出（コードブロック対応）
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "AIの応答をパースできませんでした。再度お試しください。" }, { status: 500 });
    }

    let candidates;
    try {
      candidates = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "AIの応答をパースできませんでした。再度お試しください。" }, { status: 500 });
    }
    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "タイトル提案に失敗" }, { status: 500 });
  }
}
