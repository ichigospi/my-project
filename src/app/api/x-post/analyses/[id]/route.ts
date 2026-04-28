// 個別分析の取得・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const analysis = await prisma.xPostAnalysis.findUnique({ where: { id } });
    if (!analysis) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(analysis);
  } catch (e) {
    console.error("GET /api/x-post/analyses/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xPostAnalysis.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/analyses/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
