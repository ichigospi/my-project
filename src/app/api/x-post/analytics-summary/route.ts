// 自アカウントのポストパフォーマンス集計（平均/最高/教育タイプ別）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/analytics-summary?competitorId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const competitorId = searchParams.get("competitorId");
    if (!competitorId) {
      return NextResponse.json({ error: "competitorId は必須" }, { status: 400 });
    }

    const competitor = await prisma.xCompetitor.findUnique({ where: { id: competitorId } });
    if (!competitor) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }

    const posts = await prisma.xPost.findMany({
      where: { competitorId },
      orderBy: { likes: "desc" },
    });

    if (posts.length === 0) {
      return NextResponse.json({
        count: 0,
        avgLikes: 0,
        avgRetweets: 0,
        avgImpressions: 0,
        maxLikes: 0,
        maxRetweets: 0,
        maxImpressions: 0,
        topPostId: null,
        latestPostAt: null,
      });
    }

    const sum = (key: "likes" | "retweets" | "impressions") =>
      posts.reduce((acc, p) => acc + p[key], 0);
    const max = (key: "likes" | "retweets" | "impressions") =>
      posts.reduce((acc, p) => Math.max(acc, p[key]), 0);

    const latestPostAt = posts
      .map((p) => p.postedAt?.toISOString())
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() ?? null;

    return NextResponse.json({
      count: posts.length,
      avgLikes: Math.round(sum("likes") / posts.length),
      avgRetweets: Math.round(sum("retweets") / posts.length),
      avgImpressions: Math.round(sum("impressions") / posts.length),
      maxLikes: max("likes"),
      maxRetweets: max("retweets"),
      maxImpressions: max("impressions"),
      topPostId: posts[0].id,
      latestPostAt,
    });
  } catch (e) {
    console.error("GET /api/x-post/analytics-summary", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
