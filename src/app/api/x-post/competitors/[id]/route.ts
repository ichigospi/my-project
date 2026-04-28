// 個別競合アカウントの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.handle !== undefined) data.handle = String(body.handle).replace(/^@/, "");
    if (body.name !== undefined) data.name = body.name;
    if (body.note !== undefined) data.note = body.note;
    if (body.isSelf !== undefined) data.isSelf = Boolean(body.isSelf);
    const competitor = await prisma.xCompetitor.update({ where: { id }, data });
    return NextResponse.json(competitor);
  } catch (e) {
    console.error("PUT /api/x-post/competitors/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    // posts は onDelete: Cascade で消える
    await prisma.xCompetitor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/competitors/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
