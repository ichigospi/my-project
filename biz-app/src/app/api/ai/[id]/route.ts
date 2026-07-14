import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// レポートへのフィードバック保存（次回分析のコンテキストに含まれる=学習ループ）
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { feedback } = await req.json();

  await prisma.aiReport.update({
    where: { id },
    data: { feedback: String(feedback ?? "").trim() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.aiReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
