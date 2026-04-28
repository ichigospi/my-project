// 個別フォルダの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.color !== undefined) data.color = body.color;
    const folder = await prisma.xFolder.update({ where: { id }, data });
    return NextResponse.json(folder);
  } catch (e) {
    console.error("PUT /api/x-post/folders/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    // 紐付くアイテムは XFolderItem の onDelete: Cascade で消える
    await prisma.xFolder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/folders/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
