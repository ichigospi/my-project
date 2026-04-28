// 単一ポストテンプレの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/templates?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const where: Record<string, string> = {};
    if (genre) where.genre = genre;
    const templates = await prisma.xPostTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (e) {
    console.error("GET /api/x-post/templates", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.genre || !body.name || !body.skeleton) {
      return NextResponse.json({ error: "genre / name / skeleton は必須" }, { status: 400 });
    }
    const template = await prisma.xPostTemplate.create({
      data: {
        genre: body.genre,
        name: body.name,
        sourceType: body.sourceType ?? "scratch",
        sourceId: body.sourceId ?? null,
        structure: body.structure ?? "{}",
        skeleton: body.skeleton,
        placeholders: body.placeholders ?? "[]",
        notes: body.notes ?? "",
      },
    });
    return NextResponse.json(template);
  } catch (e) {
    console.error("POST /api/x-post/templates", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
