import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル分野のプロライターです。
SEOを意識したMarkdown形式の記事を作成します。
H2/H3の見出し構造、導入文、具体的なアドバイス、温かいトーン。2000〜4000文字程度。`;

export async function POST(request: NextRequest) {
  const { type, aiApiKey, context } = await request.json();
  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが未設定です" }, { status: 400 });

  let userPrompt = "";
  switch (type) {
    case "from_script":
      userPrompt = `以下のYouTube台本をブログ記事にリライトしてください。SEOタイトル案3つも提案。\nタイトル: ${context?.scriptTitle || "未指定"}\n\n${context?.scriptContent || "台本が入力されていません"}`;
      break;
    case "trend":
      userPrompt = `「${context?.trendKeyword || "未指定"}」を占い・スピリチュアルの視点で解説する記事を作成。SEOタイトル案3つも提案。`;
      break;
    case "curated":
      userPrompt = `「${context?.topic || "未指定"}」に関するまとめ記事を作成。占いの視点を交えつつバランスよく。SEOタイトル案3つも提案。`;
      break;
    default:
      return NextResponse.json({ error: "不正な記事タイプです" }, { status: 400 });
  }

  const ai = await callAI(aiApiKey, SYSTEM_PROMPT, userPrompt, 4096);
  if (ai.error) return NextResponse.json({ error: ai.error }, { status: 500 });
  return NextResponse.json({ content: ai.text });
}
