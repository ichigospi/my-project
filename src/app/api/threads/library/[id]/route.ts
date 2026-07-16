// ライブラリアイテムの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/threads/library/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const key of ["type", "title", "content", "tags", "note"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (body.accountId !== undefined) data.accountId = body.accountId || null;
    if (body.strength !== undefined) data.strength = Math.min(5, Math.max(1, Number(body.strength)));

    const item = await prisma.threadsLibraryItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (e) {
    console.error("PATCH /api/threads/library/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/library/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.threadsLibraryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/threads/library/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
