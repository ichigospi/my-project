// 個別テンプレの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["genre", "name", "sourceType", "sourceId", "structure", "skeleton", "placeholders", "notes"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const template = await prisma.xPostTemplate.update({ where: { id }, data });
    return NextResponse.json(template);
  } catch (e) {
    console.error("PUT /api/x-post/templates/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xPostTemplate.delete({ where: { id } });
    await prisma.xFolderItem.deleteMany({
      where: { itemType: "template", itemId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/templates/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
