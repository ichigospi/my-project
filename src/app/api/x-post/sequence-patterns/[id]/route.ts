// 個別シーケンスパターンの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["genre", "name", "description", "pattern", "example"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.isBuiltIn !== undefined) data.isBuiltIn = Boolean(body.isBuiltIn);
    const pattern = await prisma.xSequencePattern.update({ where: { id }, data });
    return NextResponse.json(pattern);
  } catch (e) {
    console.error("PUT /api/x-post/sequence-patterns/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xSequencePattern.delete({ where: { id } });
    await prisma.xFolderItem.deleteMany({
      where: { itemType: "sequence_pattern", itemId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/sequence-patterns/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
