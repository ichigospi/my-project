// ジャンル別の集計統計
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/stats?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    if (!genre) {
      return NextResponse.json({ error: "genre は必須" }, { status: 400 });
    }

    const [
      knowledgeCount,
      competitors,
      collectedPosts,
      analyses,
      generatedPosts,
      templates,
      patterns,
      dailyPlans,
    ] = await Promise.all([
      prisma.xKnowledge.count({ where: { genre } }),
      prisma.xCompetitor.count({ where: { genre } }),
      prisma.xPost.count({ where: { competitor: { genre } } }),
      prisma.xPostAnalysis.count({ where: { genre } }),
      prisma.xGeneratedPost.count({ where: { genre } }),
      prisma.xPostTemplate.count({ where: { genre } }),
      prisma.xSequencePattern.count({ where: { genre } }),
      prisma.xDailyPlan.count({ where: { genre } }),
    ]);

    return NextResponse.json({
      genre,
      knowledge: knowledgeCount,
      competitors,
      collectedPosts,
      analyses,
      generatedPosts,
      templates,
      sequencePatterns: patterns,
      dailyPlans,
    });
  } catch (e) {
    console.error("GET /api/x-post/stats", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
