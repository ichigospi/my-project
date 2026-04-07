import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 一覧取得
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = (auth.session.user as { id: string }).id;

  const proposals = await prisma.scriptProposal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    proposals.map((p) => ({
      ...p,
      sourceAnalysisIds: JSON.parse(p.sourceAnalysisIds),
      proposal: p.proposal ? JSON.parse(p.proposal) : null,
    }))
  );
}

// 保存（新規 or 更新）
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = (auth.session.user as { id: string }).id;

  const body = await request.json();
  const { id, sourceAnalysisIds, style, topic, proposal, generatedScript } = body;

  const data = {
    userId,
    sourceAnalysisIds: JSON.stringify(sourceAnalysisIds || []),
    style: style || "healing",
    topic: topic || "",
    proposal: proposal ? JSON.stringify(proposal) : null,
    generatedScript: generatedScript || "",
  };

  const result = await prisma.scriptProposal.upsert({
    where: { id: id || "" },
    update: data,
    create: { id: id || undefined, ...data },
  });

  return NextResponse.json({
    ...result,
    sourceAnalysisIds: JSON.parse(result.sourceAnalysisIds),
    proposal: result.proposal ? JSON.parse(result.proposal) : null,
  });
}

// 削除
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = (auth.session.user as { id: string }).id;

  const { id } = await request.json();
  await prisma.scriptProposal.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
