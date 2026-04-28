// 教材・参考ポスト・メモの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/knowledge?genre=business&type=teaching
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre"); // "business" | "spiritual" | "common" | null
    const type = searchParams.get("type"); // "teaching" | "reference_post" | "memo" | null

    const where: Record<string, string> = {};
    if (genre) where.genre = genre;
    if (type) where.type = type;

    const records = await prisma.xKnowledge.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (e) {
    console.error("GET /api/x-post/knowledge", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/knowledge （新規作成）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.genre || !body.type) {
      return NextResponse.json({ error: "genre と type は必須" }, { status: 400 });
    }
    if (!body.content) {
      return NextResponse.json({ error: "content は必須" }, { status: 400 });
    }
    const record = await prisma.xKnowledge.create({
      data: {
        genre: body.genre,
        type: body.type,
        title: body.title ?? "",
        content: body.content,
        authorHandle: body.authorHandle ?? "",
        postUrl: body.postUrl ?? "",
        likes: Number(body.likes ?? 0),
        retweets: Number(body.retweets ?? 0),
        impressions: Number(body.impressions ?? 0),
        postedAt: body.postedAt ? new Date(body.postedAt) : null,
        structureType: body.structureType ?? "",
        hookAnalysis: body.hookAnalysis ?? "",
        bodyAnalysis: body.bodyAnalysis ?? "",
        closingAnalysis: body.closingAnalysis ?? "",
        usedWords: body.usedWords ?? "[]",
        applicationHint: body.applicationHint ?? "",
        tags: body.tags ?? "[]",
        source: body.source ?? "",
        note: body.note ?? "",
      },
    });
    return NextResponse.json(record);
  } catch (e) {
    console.error("POST /api/x-post/knowledge", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
