import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, aiApiKey, context } = body;

  if (!aiApiKey) {
    return NextResponse.json(
      { error: "AI APIキーが設定されていません。設定ページから登録してください。" },
      { status: 400 }
    );
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // タイプ別のプロンプト生成
  const systemPrompt = `あなたは占い・スピリチュアル系コンテンツのSNSマーケティング専門家です。
X（旧Twitter）の投稿文を作成します。

ルール:
- 280文字以内（日本語の場合140文字程度が理想）
- 占い・スピリチュアルの温かく親しみやすい雰囲気
- 視聴者の共感を得られるフレーズ
- ハッシュタグは2〜3個まで
- 押し売り感のない自然な文体
- 複数の投稿案を提案する場合は「---」で区切る`;

  let userPrompt = "";

  switch (type) {
    case "promotion": {
      const { videoTitle, videoDescription, videoUrl } = context || {};
      userPrompt = `以下のYouTube動画の宣伝ツイートを3パターン作成してください。

動画タイトル: ${videoTitle || "（未指定）"}
動画概要: ${videoDescription || "（未指定）"}
${videoUrl ? `動画URL: ${videoUrl}` : ""}

パターン:
1. 興味を引くフック型
2. 共感を呼ぶストーリー型
3. 価値提供型（学びを示唆）`;
      break;
    }

    case "trend": {
      const { trendKeyword, channelTheme } = context || {};
      userPrompt = `以下のトレンドキーワードを活用した投稿を3パターン作成してください。

トレンドキーワード: ${trendKeyword || "（未指定）"}
チャンネルテーマ: ${channelTheme || "占い・スピリチュアル"}

自然にトレンドと占い・スピリチュアルを結びつけてください。`;
      break;
    }

    case "daily": {
      const { theme, zodiacSign } = context || {};
      userPrompt = `今日の占い投稿を作成してください。

${theme ? `テーマ: ${theme}` : ""}
${zodiacSign ? `星座: ${zodiacSign}` : "全体運"}

温かく前向きなメッセージで、行動指針を含めてください。
3パターン作成してください。`;
      break;
    }

    case "engagement": {
      const { topic } = context || {};
      userPrompt = `フォロワーとのエンゲージメントを高める投稿を3パターン作成してください。

${topic ? `トピック: ${topic}` : "占い・スピリチュアル全般"}

タイプ:
1. 質問投げかけ型（アンケート的）
2. 共感型（あるある系）
3. 気づき提供型`;
      break;
    }

    default:
      return NextResponse.json({ error: "不正な生成タイプです" }, { status: 400 });
  }

  try {
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
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "Claude APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      return NextResponse.json({ text, suggestions: parseSuggestions(text) });
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "OpenAI APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      return NextResponse.json({ text, suggestions: parseSuggestions(text) });
    }
  } catch {
    return NextResponse.json({ error: "投稿生成に失敗しました" }, { status: 500 });
  }
}

// AI出力を投稿案に分割
function parseSuggestions(text: string): string[] {
  // 「---」区切り or 番号付きリストで分割
  const byDashes = text.split(/---+/).map((s) => s.trim()).filter(Boolean);
  if (byDashes.length >= 2) return byDashes;

  // 番号付き分割
  const byNumbers = text.split(/\n(?=\d+[\.\)）])/g).map((s) => s.replace(/^\d+[\.\)）]\s*/, "").trim()).filter(Boolean);
  if (byNumbers.length >= 2) return byNumbers;

  return [text.trim()];
}
