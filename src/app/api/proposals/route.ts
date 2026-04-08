import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 一覧取得
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const userId = (auth.session.user as { id: string }).id;

    if (!prisma.scriptProposal) return NextResponse.json([]);

    const proposals = await prisma.scriptProposal.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      proposals.map((p) => ({
        ...p,
        sourceAnalysisIds: JSON.parse(p.sourceAnalysisIds),
        proposal: p.proposal ? JSON.parse(p.proposal) : null,
      }))
    );
  } catch (e) {
    console.error("GET /api/proposals error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 保存（新規 or 更新）
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const userId = (auth.session.user as { id: string }).id;

    const body = await request.json();
    const { id, sourceAnalysisIds, style, topic, proposal, generatedScript } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data = {
      userId,
      sourceAnalysisIds: JSON.stringify(sourceAnalysisIds || []),
      style: style || "healing",
      topic: topic || "",
      proposal: proposal ? JSON.stringify(proposal) : null,
      generatedScript: generatedScript || "",
    };

    const existing = await prisma.scriptProposal.findUnique({ where: { id } });
    let result;
    if (existing) {
      result = await prisma.scriptProposal.update({ where: { id }, data });
    } else {
      result = await prisma.scriptProposal.create({ data: { id, ...data } });
    }

    return NextResponse.json({
      ...result,
      sourceAnalysisIds: JSON.parse(result.sourceAnalysisIds),
      proposal: result.proposal ? JSON.parse(result.proposal) : null,
    });
  } catch (e) {
    console.error("POST /api/proposals error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const userId = (auth.session.user as { id: string }).id;

    const { id } = await request.json();
    await prisma.scriptProposal.deleteMany({ where: { id, userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/proposals error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
