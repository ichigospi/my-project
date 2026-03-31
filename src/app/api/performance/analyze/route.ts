import { NextRequest, NextResponse } from "next/server";

// パフォーマンス分析: 勝ち/負けパターン抽出 + 次の企画提案 + 改善提案
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videos, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const avgViews = videos.reduce((s: number, v: { views: number }) => s + v.views, 0) / videos.length;

  const winners = videos.filter((v: { views: number }) => v.views >= avgViews * 1.5);
  const losers = videos.filter((v: { views: number }) => v.views <= avgViews * 0.5);

  const prompt = `占い・スピリチュアル系YouTubeチャンネルのパフォーマンス分析をしてください。

【チャンネル平均再生数】${Math.round(avgViews).toLocaleString()}回

【伸びた動画（平均の1.5倍以上）】
${winners.map((v: { title: string; views: number; genre: string; publishedAt: string }, i: number) => `${i + 1}. ${v.title}（${v.views.toLocaleString()}回 / ${v.genre} / ${v.publishedAt}）`).join("\n") || "なし"}

【伸びなかった動画（平均の0.5倍以下）】
${losers.map((v: { title: string; views: number; genre: string; publishedAt: string }, i: number) => `${i + 1}. ${v.title}（${v.views.toLocaleString()}回 / ${v.genre} / ${v.publishedAt}）`).join("\n") || "なし"}

【全動画一覧（再生数順）】
${videos.slice(0, 20).map((v: { title: string; views: number; genre: string; likes: number; comments: number }, i: number) => `${i + 1}. ${v.title}（${v.views.toLocaleString()}回 / ${v.genre} / いいね${v.likes} / コメント${v.comments}）`).join("\n")}

以下の3つを分析してください。マークダウン形式で出力。

# 🏆 勝ちパターン・負けパターン
伸びた動画の共通点（ジャンル、訴求、タイトルパターン、投稿タイミング等）と
伸びなかった動画の共通点を分析。具体的な動画タイトルを引用して解説。

# 💡 次に作るべき企画TOP3
勝ちパターンを踏まえて具体的な企画タイトルを3つ提案。
各提案に「根拠（どの勝ち動画のどの要素を活用するか）」と「推定再生数レンジ」を添える。

# 📈 改善提案
- エンゲージメント（いいね率・コメント率）が低い動画の改善案
- 再生数は高いがエンゲージメントが低い動画 = 途中離脱の可能性 → 台本構成の改善案
- 全体的なチャンネル運営の改善提案`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 4096 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ analysis: text });
  } catch {
    return NextResponse.json({ error: "分析に失敗" }, { status: 500 });
  }
}
