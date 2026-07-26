// 生成ドラフトの一覧取得
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerName = searchParams.get("customerName");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (customerName) where.customerName = customerName;

    const drafts = await prisma.replyDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(drafts);
  } catch (e) {
    console.error("GET /api/reply/drafts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
