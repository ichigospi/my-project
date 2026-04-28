// 個別ナレッジの取得・更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const record = await prisma.xKnowledge.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(record);
  } catch (e) {
    console.error("GET /api/x-post/knowledge/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = [
      "genre", "type", "title", "content", "authorHandle", "postUrl",
      "structureType", "hookAnalysis", "bodyAnalysis", "closingAnalysis",
      "usedWords", "applicationHint", "tags", "source", "note",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.likes !== undefined) data.likes = Number(body.likes);
    if (body.retweets !== undefined) data.retweets = Number(body.retweets);
    if (body.impressions !== undefined) data.impressions = Number(body.impressions);
    if (body.postedAt !== undefined) {
      data.postedAt = body.postedAt ? new Date(body.postedAt) : null;
    }
    const record = await prisma.xKnowledge.update({ where: { id }, data });
    return NextResponse.json(record);
  } catch (e) {
    console.error("PUT /api/x-post/knowledge/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xKnowledge.delete({ where: { id } });
    // フォルダ紐付けも削除
    await prisma.xFolderItem.deleteMany({ where: { itemId: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/knowledge/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
