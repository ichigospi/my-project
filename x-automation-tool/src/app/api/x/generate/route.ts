import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系コンテンツのSNSマーケティング専門家です。
X（旧Twitter）の投稿文を作成します。

ルール:
- 280文字以内（日本語の場合140文字程度が理想）
- 占い・スピリチュアルの温かく親しみやすい雰囲気
- ハッシュタグは2〜3個まで
- 押し売り感のない自然な文体
- 複数の投稿案を提案する場合は「---」で区切る`;

export async function POST(request: NextRequest) {
  const { type, aiApiKey, context } = await request.json();
  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが未設定です" }, { status: 400 });

  let userPrompt = "";
  switch (type) {
    case "promotion": {
      const { videoTitle, videoUrl } = context || {};
      userPrompt = `YouTube動画の宣伝ツイートを3パターン作成してください。\n動画タイトル: ${videoTitle || "未指定"}\n${videoUrl ? `URL: ${videoUrl}` : ""}\n\n1. フック型 2. 共感型 3. 価値提供型`;
      break;
    }
    case "trend": {
      const { trendKeyword } = context || {};
      userPrompt = `トレンド「${trendKeyword || "未指定"}」を活用した占い・スピリチュアル系投稿を3パターン作成してください。`;
      break;
    }
    case "daily": {
      const { theme } = context || {};
      userPrompt = `今日の占い投稿を3パターン作成してください。\n${theme ? `テーマ: ${theme}` : "全体運"}\n温かく前向きなメッセージで。`;
      break;
    }
    case "engagement": {
      const { topic } = context || {};
      userPrompt = `エンゲージメントを高める投稿を3パターン。\n${topic ? `トピック: ${topic}` : "占い全般"}\n1. 質問型 2. 共感型 3. 気づき型`;
      break;
    }
    default:
      return NextResponse.json({ error: "不正な生成タイプです" }, { status: 400 });
  }

  const ai = await callAI(aiApiKey, SYSTEM_PROMPT, userPrompt);
  if (ai.error) return NextResponse.json({ error: ai.error }, { status: 500 });

  const suggestions = parseSuggestions(ai.text);
  return NextResponse.json({ text: ai.text, suggestions });
}

function parseSuggestions(text: string): string[] {
  const byDashes = text.split(/---+/).map((s) => s.trim()).filter(Boolean);
  if (byDashes.length >= 2) return byDashes;
  const byNumbers = text.split(/\n(?=\d+[\.\)）])/).map((s) => s.replace(/^\d+[\.\)）]\s*/, "").trim()).filter(Boolean);
  if (byNumbers.length >= 2) return byNumbers;
  return [text.trim()];
}
