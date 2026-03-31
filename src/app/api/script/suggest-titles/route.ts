import { NextRequest, NextResponse } from "next/server";

// 競合+自チャンネルデータからタイトル候補を提案（参考動画付き）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { genre, style, competitorVideos, selfTopVideos, performanceData, hookPatterns, aiApiKey, excludeTitles, directionNote } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

  const genreLabel = { love: "恋愛運", money: "金運", general: "総合運" }[genre] || genre;
  const styleLabel = style === "healing" ? "ヒーリング系" : "教育系";

  const prompt = `あなたは占い・スピリチュアル系YouTubeの企画プロデューサーです。

【最重要ルール：企画立案の鉄則】
- 伸びている競合動画から離れれば離れるほど、伸びないリスクが高まる
- 丸パクリはNGだが、2〜3本の類似動画の強い訴求や構成を「いいとこ取り」して
  上位互換の動画を作るのが最良の手段
- したがって、提案するタイトルは必ず「実際に伸びている競合動画」を
  ベースにした上位互換企画であること
- オリジナリティを出しすぎて競合から乖離した企画は提案しない

【ジャンル】${genreLabel}
【スタイル】${styleLabel}

【直近1ヶ月で伸びている競合動画（タイトル / チャンネル / 再生数）】
${competitorVideos?.map((v: { title: string; channel: string; views: number }, i: number) => `${i + 1}. ${v.title} / ${v.channel} / ${v.views}回`).join("\n") || "データなし"}

【自チャンネルで伸びた動画】
${selfTopVideos?.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n") || "データなし"}

【過去実績パターン】
${performanceData || "データなし"}

【高スコアのフックパターン】
${hookPatterns || "データなし"}

${excludeTitles?.length > 0 ? `\n【前回提案済み（これらと被らない新しい企画を出してください）】\n${excludeTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}\n` : ""}
${directionNote ? `【方向性の指定】\n${directionNote}\n` : ""}
上記を踏まえて、今作るべき動画のタイトル候補を5つ提案してください。

【参考動画の選定ルール】
- 各タイトル候補に対して、参考にすべき競合動画を3-5本選んでください
- 原則: ${genreLabel}の企画には${genreLabel}の参考動画を優先
- 例外: タイトルの訴求パターン（理想の未来提示、損失回避、好奇心フック等）が
  ジャンル問わず転用できる場合は他ジャンルの動画も参考に含めてOK
  例: 「溢れる」「見逃すと危険」「○つのサイン」等はジャンル共通で使える
- 長尺動画のみ（5分以上）。Shortsは除外
- チャンネル平均より伸びている動画を優先

以下のJSON配列で出力してください。JSONのみ出力。
[
  {
    "title": "タイトル案",
    "reason": "伸びると判断した詳細理由（100字程度。競合のどの動画/トレンドを参考にしたか、どの訴求が有効か、自チャンネルの実績との関連を含める）",
    "appealPattern": "使用する訴求パターン名（例: 理想の未来提示、損失回避、好奇心フック、限定性、予祝）",
    "estimatedPotential": "high または medium",
    "referenceVideos": [
      {
        "title": "参考動画タイトル",
        "channel": "チャンネル名",
        "views": 再生数（数値）,
        "referencePoint": "この動画の何を参考にすべきか（タイトル訴求/サムネの見せ方/具体的なポイント）",
        "crossGenre": false
      }
    ]
  }
]`;

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

    // JSON抽出（コードブロック内も対応）
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "AIの応答をパースできませんでした。再度お試しください。" }, { status: 500 });
    try {
      return NextResponse.json({ candidates: JSON.parse(match[0]) });
    } catch {
      return NextResponse.json({ error: "JSON形式が不正です。再度お試しください。" }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "タイトル提案に失敗" }, { status: 500 });
  }
}
