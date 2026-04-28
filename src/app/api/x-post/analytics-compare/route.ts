// 自アカウントの「伸びたポスト」と「伸びなかったポスト」をAIで比較分析
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildAnalyticsCompareSystemPrompt,
  buildAnalyticsCompareUserMessage,
  parseAnalyticsCompareResult,
} from "@/lib/x-post-prompts";
import { parseSettings } from "@/lib/x-post-types";

// POST /api/x-post/analytics-compare
// Body: { competitorId, aiApiKey, model?, topN?, bottomN?, customInstruction? }
//   competitorId は isSelf=true の自分のアカウント
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      competitorId,
      aiApiKey,
      model,
      topN = 5,
      bottomN = 5,
      customInstruction,
      excludeReplies = true,
    } = body as {
      competitorId?: string;
      aiApiKey?: string;
      model?: XPostModel;
      topN?: number;
      bottomN?: number;
      customInstruction?: string;
      excludeReplies?: boolean;
    };

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定" }, { status: 400 });
    }
    if (!competitorId) {
      return NextResponse.json({ error: "competitorId は必須" }, { status: 400 });
    }

    const competitor = await prisma.xCompetitor.findUnique({ where: { id: competitorId } });
    if (!competitor) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }
    if (!competitor.isSelf) {
      return NextResponse.json({ error: "自アカウント (isSelf=true) のみ対象です" }, { status: 400 });
    }
    const genre = competitor.genre;
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "ジャンル不正" }, { status: 400 });
    }

    const allPosts = await prisma.xPost.findMany({
      where: { competitorId },
      orderBy: { likes: "desc" },
    });
    // 返信ポスト除外（"@username..." で始まるもの）
    const filtered = excludeReplies
      ? allPosts.filter((p) => !/^\s*@\w+/.test(p.content))
      : allPosts;
    if (filtered.length < topN + bottomN) {
      return NextResponse.json(
        { error: `比較するには最低 ${topN + bottomN} 件のポストが必要です（${excludeReplies ? "返信除外後 " : ""}現在 ${filtered.length} 件）` },
        { status: 400 },
      );
    }
    const top = filtered.slice(0, topN).map((p, i) => ({
      index: i + 1,
      content: p.content,
      likes: p.likes,
      retweets: p.retweets,
      impressions: p.impressions,
      postedAt: p.postedAt?.toISOString(),
    }));
    const bottom = filtered.slice(-bottomN).reverse().map((p, i) => ({
      index: i + 1,
      content: p.content,
      likes: p.likes,
      retweets: p.retweets,
      impressions: p.impressions,
      postedAt: p.postedAt?.toISOString(),
    }));

    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre);

    const { systemPrompt, knowledgeContext } = await buildAnalyticsCompareSystemPrompt(genre);
    const userMessage = buildAnalyticsCompareUserMessage({
      genre,
      topPosts: top,
      bottomPosts: bottom,
      customInstruction,
    });

    const aiRes = await callXPostAI(aiApiKey, {
      systemPrompt,
      knowledgeContext,
      userInstruction: userMessage,
      model: model ?? (settings.defaultModel as XPostModel),
      maxTokens: 2500,
    });
    if (aiRes.error) {
      return NextResponse.json({ error: aiRes.error, retryable: aiRes.retryable }, { status: 500 });
    }

    const { result, parseError } = parseAnalyticsCompareResult(aiRes.text);

    return NextResponse.json({
      result,
      raw: aiRes.text,
      parseError,
      topPosts: top,
      bottomPosts: bottom,
      usage: aiRes.usage,
      model: aiRes.model,
    });
  } catch (e) {
    console.error("POST /api/x-post/analytics-compare", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
