// タグ分類の更新（名称/並び）・削除（子孫も一緒に削除）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/threads/tag-categories/:id { name?, sortOrder?, parentId? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.parentId !== undefined) data.parentId = body.parentId || null;
    const cat = await prisma.threadsTagCategory.update({ where: { id }, data });
    return NextResponse.json(cat);
  } catch (e) {
    console.error("PATCH /api/threads/tag-categories/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/tag-categories/:id （子孫も再帰的に削除）
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = await prisma.threadsTagCategory.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ ok: true });
    // 同一アカウント内の全ノードを取得して子孫idを算出
    const all = await prisma.threadsTagCategory.findMany({ where: { accountId: target.accountId }, select: { id: true, parentId: true } });
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of all) {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          changed = true;
        }
      }
    }
    await prisma.threadsTagCategory.deleteMany({ where: { id: { in: Array.from(toDelete) } } });
    return NextResponse.json({ ok: true, deleted: toDelete.size });
  } catch (e) {
    console.error("DELETE /api/threads/tag-categories/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
