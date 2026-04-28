// フォルダの一覧取得・新規作成（アイテム数も含む）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/folders?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const where: Record<string, string> = {};
    if (genre) where.genre = genre;

    const folders = await prisma.xFolder.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(folders);
  } catch (e) {
    console.error("GET /api/x-post/folders", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/folders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.genre || !body.name) {
      return NextResponse.json({ error: "genre と name は必須" }, { status: 400 });
    }
    const folder = await prisma.xFolder.create({
      data: {
        genre: body.genre,
        name: body.name,
        color: body.color ?? "blue",
      },
    });
    return NextResponse.json(folder);
  } catch (e) {
    console.error("POST /api/x-post/folders", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
