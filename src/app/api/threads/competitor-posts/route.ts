// 収集した競合投稿の一覧取得・手動追加
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

// GET /api/threads/competitor-posts?accountId=xxx&competitorId=&planType=&hot=1&sort=likes|recent&page=1&q=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const competitorId = searchParams.get("competitorId");
    const planType = searchParams.get("planType");
    const hot = searchParams.get("hot");
    const sort = searchParams.get("sort") || "recent";
    const q = searchParams.get("q");
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const where: Record<string, unknown> = {};
    if (competitorId) {
      where.competitorId = competitorId;
    } else if (accountId) {
      where.competitor = { accountId };
    } else {
      return NextResponse.json({ error: "accountId か competitorId は必須" }, { status: 400 });
    }
    if (planType) where.planType = planType;
    if (hot === "1") where.isHot = true;
    if (q) where.content = { contains: q };

    const orderBy =
      sort === "likes"
        ? [{ likes: "desc" as const }]
        : sort === "views"
          ? [{ views: "desc" as const }]
          : [{ postedAt: "desc" as const }, { collectedAt: "desc" as const }];

    const [total, posts] = await Promise.all([
      prisma.threadsCompetitorPost.count({ where }),
      prisma.threadsCompetitorPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { competitor: { select: { handle: true, name: true } } },
      }),
    ]);

    return NextResponse.json({ total, page, pageSize: PAGE_SIZE, posts });
  } catch (e) {
    console.error("GET /api/threads/competitor-posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/competitor-posts （1件手動追加）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.competitorId || !body.content) {
      return NextResponse.json({ error: "competitorId と content は必須" }, { status: 400 });
    }
    const post = await prisma.threadsCompetitorPost.create({
      data: {
        competitorId: body.competitorId,
        postUrl: body.postUrl ?? "",
        content: body.content,
        likes: Number(body.likes ?? 0),
        replies: Number(body.replies ?? 0),
        reposts: Number(body.reposts ?? 0),
        quotes: Number(body.quotes ?? 0),
        views: Number(body.views ?? 0),
        followerCountAt: Number(body.followerCountAt ?? 0),
        postedAt: body.postedAt ? new Date(body.postedAt) : null,
        source: "manual",
        isHot: Boolean(body.isHot ?? false),
      },
    });
    return NextResponse.json(post);
  } catch (e) {
    console.error("POST /api/threads/competitor-posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
