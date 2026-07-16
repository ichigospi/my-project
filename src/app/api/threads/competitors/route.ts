// 競合アカウントの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/competitors?accountId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }
    const competitors = await prisma.threadsCompetitor.findMany({
      where: { accountId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { posts: true } },
        posts: {
          select: { collectedAt: true },
          orderBy: { collectedAt: "desc" },
          take: 1,
        },
      },
    });
    return NextResponse.json(competitors);
  } catch (e) {
    console.error("GET /api/threads/competitors", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/competitors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.accountId || !body.handle) {
      return NextResponse.json({ error: "accountId と handle は必須" }, { status: 400 });
    }
    const competitor = await prisma.threadsCompetitor.create({
      data: {
        accountId: body.accountId,
        handle: String(body.handle).replace(/^@/, ""),
        name: body.name ?? "",
        note: body.note ?? "",
        priority: Number(body.priority ?? 0),
      },
    });
    return NextResponse.json(competitor);
  } catch (e: unknown) {
    console.error("POST /api/threads/competitors", e);
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "同じハンドルの競合が既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
