// あるある集（ReplyScenario）の更新・削除
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
    for (const key of ["stage", "category", "title", "detail", "explanation", "exampleMessage", "isActive"] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const scenario = await prisma.replyScenario.update({ where: { id }, data });
    return NextResponse.json(scenario);
  } catch (e) {
    console.error("PUT /api/reply/scenarios/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    await prisma.replyScenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/reply/scenarios/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
