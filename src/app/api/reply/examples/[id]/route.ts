// 実例（ReplyExample）の更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const key of ["category", "customerMessage", "replyMessage", "note"] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const example = await prisma.replyExample.update({ where: { id }, data });
    return NextResponse.json(example);
  } catch (e) {
    console.error("PUT /api/reply/examples/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    await prisma.replyExample.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/reply/examples/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
