import { NextRequest, NextResponse } from "next/server";

// KPIベースのパフォーマンス分析 + 再生数最大化のアクション提案
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videos, channelStats, aiApiKey } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const prompt = `占い・スピリチュアル系YouTubeチャンネルのパフォーマンスを分析し、再生数最大化のための具体的アクションを提案してください。

【重要なロジック】
- CTRは再生数が伸びるほど下がるのが正常（非登録者への露出が増えるため）。
  CTRの評価は「同じ再生数レンジの動画同士」で比較すること。
- 平均視聴時間（= 尺 × 維持率）が最重要KPI。YouTubeは総視聴時間でおすすめ露出を決定。
- 維持率は動画の尺によって異なる。20分の動画で40%=8分視聴は優秀。短くして維持率を上げるのは逆効果。
- ヒーリング系は尺が長く「聞き流し」で総視聴時間が稼げるのが強み。

${channelStats?.avgViewDuration ? `【チャンネル全体KPI（直近90日）】
総再生数: ${channelStats.totalViews?.toLocaleString() || "不明"}回
平均視聴時間: ${Math.floor((channelStats.avgViewDuration || 0) / 60)}分${Math.round((channelStats.avgViewDuration || 0) % 60)}秒
平均維持率: ${channelStats.avgViewPercentage || "不明"}%
` : "【チャンネル全体KPI】データ不足のため動画個別データから推定してください。"}

【動画別データ（再生数順）】
${videos.map((v: {
  title: string; views: number; genre: string;
  avgDurationSec?: number; avgViewDuration?: number; avgPercentage?: number; avgViewPercentage?: number;
  subscribersGained?: number; likes: number; comments: number;
  publishedAt: string; duration?: string;
}, i: number) => {
  const durSec = v.avgDurationSec || v.avgViewDuration;
  const dur = durSec ? `${Math.floor(durSec / 60)}分${Math.round(durSec % 60)}秒` : "不明";
  const pct = v.avgPercentage || v.avgViewPercentage;
  const eng = v.views > 0 ? ((v.likes + v.comments) / v.views * 100).toFixed(1) : "0";
  const subRate = v.views > 0 && v.subscribersGained ? (v.subscribersGained / v.views * 100).toFixed(2) : "不明";
  return `${i + 1}. ${v.title}
   再生数: ${v.views.toLocaleString()}回 / ${v.genre} / ${v.publishedAt}${v.duration ? ` / 動画尺${v.duration}` : ""}
   平均視聴時間: ${dur} / 維持率: ${pct ?? "不明"}%
   エンゲージメント: ${eng}% / 登録者転換率: ${subRate}%
   登録者獲得: ${v.subscribersGained ?? "不明"}`;
}).join("\n\n")}

以下のマークダウン形式で分析してください。

# 📊 KPI診断

## 平均視聴時間（最重要）
現状の評価と、同ジャンル同尺での位置づけ。改善の余地がある動画と具体的な改善案。

## CTR（再生数レンジ別で評価）
再生数が多い動画のCTRが低いのは正常。同規模の動画同士で比較した上での評価。

## 平均維持率（同尺比較で）
離脱が激しい動画があれば台本のどこに問題がありそうか推定。

## 登録者転換率
CTAが効いている動画と効いていない動画の差分分析。

# 🏆 勝ちパターン・負けパターン
伸びた動画の共通点と伸びなかった動画の共通点。具体的な動画タイトルを引用。

# 💡 再生数最大化の優先アクションTOP3
1. 最優先: 何をすべきか（具体的に）
2. 次点: 何をすべきか
3. 中期: 何をすべきか

各アクションに「根拠（どのデータから判断したか）」と「期待効果」を添える。

# 📈 次に作るべき企画
勝ちパターンを踏まえた具体的な企画タイトル3つ。根拠と推定再生数レンジ付き。`;

  try {
    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
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
    return NextResponse.json({ analysis: text });
  } catch {
    return NextResponse.json({ error: "分析に失敗" }, { status: 500 });
  }
}
