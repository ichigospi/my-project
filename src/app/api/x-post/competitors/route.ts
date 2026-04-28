// 競合アカウントの一覧取得・新規作成（収集ポスト数も含む）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/competitors?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const where: Record<string, string> = {};
    if (genre) where.genre = genre;

    const competitors = await prisma.xCompetitor.findMany({
      where,
      orderBy: { createdAt: "asc" },
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
    console.error("GET /api/x-post/competitors", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/competitors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.genre || !body.handle) {
      return NextResponse.json({ error: "genre と handle は必須" }, { status: 400 });
    }
    // @ プレフィックスを正規化
    const handle = String(body.handle).replace(/^@/, "");
    const competitor = await prisma.xCompetitor.create({
      data: {
        genre: body.genre,
        handle,
        name: body.name ?? "",
        note: body.note ?? "",
      },
    });
    return NextResponse.json(competitor);
  } catch (e: unknown) {
    console.error("POST /api/x-post/competitors", e);
    // ユニーク制約違反
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "同じハンドルの競合が既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
