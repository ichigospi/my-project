// 収集した競合ポストの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/posts?genre=business&competitorId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const competitorId = searchParams.get("competitorId");

    const where: Record<string, unknown> = {};
    if (competitorId) where.competitorId = competitorId;
    if (genre) where.competitor = { genre };

    const posts = await prisma.xPost.findMany({
      where,
      orderBy: { collectedAt: "desc" },
      include: {
        competitor: {
          select: { id: true, handle: true, name: true, genre: true },
        },
      },
    });
    return NextResponse.json(posts);
  } catch (e) {
    console.error("GET /api/x-post/posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/posts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.competitorId || !body.content) {
      return NextResponse.json({ error: "competitorId と content は必須" }, { status: 400 });
    }
    const post = await prisma.xPost.create({
      data: {
        competitorId: body.competitorId,
        postId: body.postId ?? "",
        postUrl: body.postUrl ?? "",
        content: body.content,
        likes: Number(body.likes ?? 0),
        retweets: Number(body.retweets ?? 0),
        replies: Number(body.replies ?? 0),
        impressions: Number(body.impressions ?? 0),
        postedAt: body.postedAt ? new Date(body.postedAt) : null,
        isQuoteRt: Boolean(body.isQuoteRt ?? false),
        quotedPostUrl: body.quotedPostUrl ?? "",
      },
    });
    return NextResponse.json(post);
  } catch (e) {
    console.error("POST /api/x-post/posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
