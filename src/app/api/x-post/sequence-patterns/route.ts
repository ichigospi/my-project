// シーケンスパターン（複数ポストの流れ）の一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/sequence-patterns?genre=business
//   genre パラメータが指定された場合、 "any" または該当ジャンルのものを返す
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const where = genre
      ? { OR: [{ genre }, { genre: "any" }] }
      : {};
    const patterns = await prisma.xSequencePattern.findMany({
      where,
      orderBy: [{ isBuiltIn: "desc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json(patterns);
  } catch (e) {
    console.error("GET /api/x-post/sequence-patterns", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/sequence-patterns
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.pattern) {
      return NextResponse.json({ error: "name と pattern は必須" }, { status: 400 });
    }
    const pattern = await prisma.xSequencePattern.create({
      data: {
        genre: body.genre ?? "any",
        name: body.name,
        description: body.description ?? "",
        pattern: body.pattern,
        example: body.example ?? "",
        isBuiltIn: Boolean(body.isBuiltIn ?? false),
      },
    });
    return NextResponse.json(pattern);
  } catch (e) {
    console.error("POST /api/x-post/sequence-patterns", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
