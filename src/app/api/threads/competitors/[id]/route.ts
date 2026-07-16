// 競合アカウントの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/threads/competitors/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const key of ["name", "note"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (typeof body.handle === "string") data.handle = body.handle.replace(/^@/, "");
    if (body.priority !== undefined) data.priority = Number(body.priority);

    const competitor = await prisma.threadsCompetitor.update({ where: { id }, data });
    return NextResponse.json(competitor);
  } catch (e) {
    console.error("PATCH /api/threads/competitors/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/competitors/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.threadsCompetitor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/threads/competitors/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
