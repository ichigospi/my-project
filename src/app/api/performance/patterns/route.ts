import { NextRequest, NextResponse } from "next/server";

// パフォーマンスデータ×台本分析から勝ちパターンを抽出
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videos, analyses, channelName, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要" }, { status: 400 });
  if (!videos?.length) return NextResponse.json({ error: "動画データが必要" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // 動画データとマッチする分析を紐付け
  const videoData = videos.map((v: {
    videoId: string; title: string; views: number; likes: number; comments: number;
    publishedAt: string; duration: string;
    avgViewDuration?: number; avgViewPercentage?: number; subscribersGained?: number;
  }, i: number) => {
    const analysis = analyses?.find((a: { videoId: string }) => a.videoId === v.videoId);
    const engagement = v.views > 0 ? ((v.likes + v.comments) / v.views * 100).toFixed(2) : "0";

    return `
【動画${i + 1}】${v.title}
再生数: ${v.views?.toLocaleString()} | いいね: ${v.likes} | コメント: ${v.comments}
エンゲージメント率: ${engagement}%
公開日: ${v.publishedAt} | 尺: ${v.duration}
${v.avgViewPercentage ? `平均視聴維持率: ${v.avgViewPercentage}%` : ""}
${v.subscribersGained ? `チャンネル登録転換: ${v.subscribersGained}` : ""}
${analysis ? `
--- 台本分析 ---
構成パターン: ${analysis.analysisResult?.overallPattern || "不明"}
フック: ${analysis.analysisResult?.hooks?.join(" / ") || "不明"}
CTA: ${analysis.analysisResult?.ctas?.join(" / ") || "不明"}
訴求: ${analysis.analysisResult?.appealPoints?.join(" / ") || "不明"}
スコア: ${analysis.analysisResult?.score?.overall || "不明"}/10
` : "(台本分析なし)"}`;
  }).join("\n");

  const prompt = `あなたはYouTubeチャンネル運営のデータアナリストです。

以下の「${channelName}」チャンネルの動画パフォーマンスデータと台本分析を基に、
このチャンネルの「勝ちパターン」を抽出してください。

${videoData}

以下のJSON形式で出力してください。JSONのみ出力し、それ以外のテキストは出力しないでください。{から始めてください。

{
  "bestHookPattern": "最も効果的なフックパターンの説明（具体例付き）",
  "bestStructure": "最も再生された構成パターン（例: フック→共感→浄化→引き寄せ→CTA）",
  "bestDuration": "最適な動画長（例: 8-12分）",
  "bestPostTime": "投稿タイミングの傾向（データから判断）",
  "avoidPatterns": ["避けるべきパターン1", "避けるべきパターン2"],
  "topPerformers": [{"title": "動画タイトル", "views": 12345, "pattern": "この動画の成功要因"}],
  "hookEffectiveness": "フック効果の傾向分析",
  "ctaEffectiveness": "CTA効果の傾向分析",
  "audienceInsights": "視聴者の行動傾向・好みの分析"
}`;

  try {
    let text = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 4096,
            system: "あなたはYouTubeデータアナリストです。必ず有効なJSONのみを出力してください。",
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
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "YouTubeデータアナリストとして、JSON形式のみで出力してください。" },
            { role: "user", content: prompt },
          ],
          max_tokens: 4096, response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    // JSONパース
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let patterns;
    try { patterns = JSON.parse(cleaned); } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { patterns = JSON.parse(match[0]); } catch {
          return NextResponse.json({ error: "JSONパース失敗", retryable: true }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "AIの応答をパースできませんでした", retryable: true }, { status: 500 });
      }
    }

    return NextResponse.json(patterns);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分析失敗" }, { status: 500 });
  }
}
