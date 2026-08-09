// 自投稿スクショから「伸びる/伸びない傾向 + ロジック提案」を分析
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, parseDataUrlImage, resolveThreadsAiModel, type ThreadsAiImage } from "@/lib/threads-ai";
import {
  ANALYZE_POSTS_SYSTEM,
  buildAnalyzePostsInstruction,
  EMPTY_INSIGHTS,
  type AccountInsights,
  type AnalyzePostsResult,
} from "@/lib/threads-prompts";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const aiApiKey = body.aiApiKey as string | undefined;
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが未設定です" }, { status: 400 });

    const images: ThreadsAiImage[] = Array.isArray(body.images)
      ? (body.images as string[]).map(parseDataUrlImage).filter((x): x is ThreadsAiImage => x !== null)
      : [];
    const pastedText = typeof body.pastedText === "string" ? body.pastedText.trim() : "";
    if (images.length === 0 && !pastedText) {
      return NextResponse.json({ error: "投稿スクショ、またはテキストを入れてください" }, { status: 400 });
    }

    // アカウント情報 + 保存済み投稿実績を文脈として付与
    let accountName: string | undefined;
    let concept: string | undefined;
    let currentLogic: string | undefined;
    let existingInsights: AccountInsights | null = null;
    let storedPosts:
      | { content: string; views: number; likes: number; replies: number; reposts: number }[]
      | undefined;
    if (body.accountId) {
      const account = await prisma.threadsAccount.findUnique({ where: { id: String(body.accountId) } });
      if (account) {
        accountName = account.name;
        concept = account.concept;
        currentLogic = account.logic;
        try {
          existingInsights = JSON.parse(account.learnedInsights || "{}") as AccountInsights;
        } catch {
          existingInsights = null;
        }
      }
      const drafts = await prisma.threadsPostDraft.findMany({
        where: { accountId: String(body.accountId), status: "published" },
        orderBy: [{ likes: "desc" }],
        take: 30,
        select: { content: true, views: true, likes: true, replies: true, reposts: true },
      });
      if (drafts.length > 0) storedPosts = drafts;
    }

    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: ANALYZE_POSTS_SYSTEM,
      userInstruction: buildAnalyzePostsInstruction({ accountName, concept, currentLogic, existingInsights, storedPosts, pastedText }),
      images,
      model: resolveThreadsAiModel(body.model),
      maxTokens: 3500,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: res.retryable ? 503 : 500 });
    }
    const parsed = extractJson<AnalyzePostsResult>(res.text);
    if (!parsed) {
      return NextResponse.json({ error: "分析結果を解析できませんでした。もう一度お試しください" }, { status: 502 });
    }
    const insights: AccountInsights = {
      hooks: parsed.insights?.hooks ?? existingInsights?.hooks ?? [],
      strongWords: parsed.insights?.strongWords ?? existingInsights?.strongWords ?? [],
      growthPatterns: parsed.insights?.growthPatterns ?? existingInsights?.growthPatterns ?? [],
      toneNotes: parsed.insights?.toneNotes ?? existingInsights?.toneNotes ?? [],
      logicNotes: parsed.insights?.logicNotes ?? existingInsights?.logicNotes ?? [],
      analyzedCount: (existingInsights?.analyzedCount ?? 0) + 1,
    };
    return NextResponse.json({
      summary: parsed.summary ?? "",
      growingTraits: parsed.growingTraits ?? [],
      notGrowingTraits: parsed.notGrowingTraits ?? [],
      logicSuggestions: parsed.logicSuggestions ?? [],
      insights,
      previousInsights: existingInsights ?? EMPTY_INSIGHTS,
    });
  } catch (e) {
    console.error("POST /api/threads/analytics/analyze", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
