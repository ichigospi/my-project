// 分析の一覧取得・新規作成（AI実行）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserMessage,
  parseAnalysisResult,
  type AnalysisPostInput,
} from "@/lib/x-post-prompts";

// GET /api/x-post/analyses?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const where: Record<string, string> = {};
    if (genre) where.genre = genre;

    const analyses = await prisma.xPostAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(analyses);
  } catch (e) {
    console.error("GET /api/x-post/analyses", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/analyses
// Body: { genre, postIds[], customInstruction?, model?, aiApiKey }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genre, postIds, customInstruction, model, aiApiKey } = body as {
      genre: "business" | "spiritual";
      postIds: string[];
      customInstruction?: string;
      model?: XPostModel;
      aiApiKey: string;
    };

    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: "postIds は1件以上必須" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "aiApiKey は必須（APIキーが未設定です）" }, { status: 400 });
    }

    // 対象ポストをDBから取得
    const posts = await prisma.xPost.findMany({
      where: { id: { in: postIds } },
      include: { competitor: { select: { handle: true, name: true } } },
    });
    if (posts.length === 0) {
      return NextResponse.json({ error: "対象ポストが見つかりません" }, { status: 404 });
    }

    // プロンプト構築
    const { systemPrompt, knowledgeContext } = await buildAnalysisSystemPrompt(genre);
    const inputs: AnalysisPostInput[] = posts.map((p) => ({
      authorHandle: p.competitor.handle,
      authorName: p.competitor.name || undefined,
      content: p.content,
      likes: p.likes,
      retweets: p.retweets,
      impressions: p.impressions,
    }));
    const userMessage = buildAnalysisUserMessage({
      posts: inputs,
      customInstruction,
      genre,
    });

    // AI呼び出し
    const aiRes = await callXPostAI(aiApiKey, {
      systemPrompt,
      knowledgeContext,
      userInstruction: userMessage,
      model: model ?? "claude-sonnet-4-6",
      maxTokens: 4096,
    });

    if (aiRes.error) {
      return NextResponse.json(
        {
          error: aiRes.error,
          retryable: aiRes.retryable,
        },
        { status: aiRes.retryable ? 503 : 500 },
      );
    }

    // レスポンスをパース
    const { result, parseError } = parseAnalysisResult(aiRes.text);

    // DB保存
    const analysis = await prisma.xPostAnalysis.create({
      data: {
        genre,
        postIds: JSON.stringify(postIds),
        result: JSON.stringify(result),
        summary: result.summary,
        customInstruction: customInstruction ?? "",
      },
    });

    return NextResponse.json({
      analysis,
      result,
      parseError,
      rawText: parseError ? aiRes.text : undefined,
      usage: aiRes.usage,
      model: aiRes.model,
    });
  } catch (e) {
    console.error("POST /api/x-post/analyses", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
