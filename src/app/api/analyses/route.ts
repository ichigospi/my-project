import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 一覧取得
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const userId = (auth.session.user as { id: string }).id;

    const analyses = await prisma.scriptAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      analyses.map((a) => ({
        ...a,
        analysisResult: a.analysisResult ? JSON.parse(a.analysisResult) : null,
        tags: JSON.parse(a.tags),
        score: a.score ? JSON.parse(a.score) : undefined,
      }))
    );
  } catch (e) {
    console.error("GET /api/analyses error:", e);
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
    const {
      id, videoId, videoUrl, videoTitle, channelName,
      thumbnailUrl, views, transcript, analysisResult,
      category, tags, score,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data = {
      userId,
      videoId: videoId || "",
      videoUrl: videoUrl || "",
      videoTitle: videoTitle || "",
      channelName: channelName || "",
      thumbnailUrl: thumbnailUrl || "",
      views: views || 0,
      transcript: transcript || "",
      analysisResult: analysisResult ? JSON.stringify(analysisResult) : null,
      category: category || "other",
      tags: JSON.stringify(tags || []),
      score: score ? JSON.stringify(score) : null,
    };

    // 既存チェックしてupsert
    const existing = await prisma.scriptAnalysis.findUnique({ where: { id } });
    let analysis;
    if (existing) {
      analysis = await prisma.scriptAnalysis.update({ where: { id }, data });
    } else {
      analysis = await prisma.scriptAnalysis.create({ data: { id, ...data } });
    }

    return NextResponse.json({
      ...analysis,
      analysisResult: analysis.analysisResult ? JSON.parse(analysis.analysisResult) : null,
      tags: JSON.parse(analysis.tags),
      score: analysis.score ? JSON.parse(analysis.score) : undefined,
    });
  } catch (e) {
    console.error("POST /api/analyses error:", e);
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
    await prisma.scriptAnalysis.deleteMany({ where: { id, userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/analyses error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
