// ダッシュボード用の集計
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/stats?accountId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

    const [competitors, collectedPosts, libraryItems, drafts, scheduled, published, upcoming] =
      await Promise.all([
        prisma.threadsCompetitor.count({ where: { accountId } }),
        prisma.threadsCompetitorPost.count({ where: { competitor: { accountId } } }),
        prisma.threadsLibraryItem.count({ where: { OR: [{ accountId }, { accountId: null }] } }),
        prisma.threadsPostDraft.count({ where: { accountId } }),
        prisma.threadsPostDraft.count({ where: { accountId, status: "scheduled" } }),
        prisma.threadsPostDraft.count({ where: { accountId, status: "published" } }),
        prisma.threadsPostDraft.findMany({
          where: {
            accountId,
            status: { in: ["approved", "scheduled"] },
            scheduledAt: { gte: now, lte: in48h },
          },
          orderBy: { scheduledAt: "asc" },
          take: 10,
          select: { id: true, content: true, scheduledAt: true, status: true },
        }),
      ]);

    return NextResponse.json({
      competitors,
      collectedPosts,
      libraryItems,
      drafts,
      scheduled,
      published,
      upcoming,
    });
  } catch (e) {
    console.error("GET /api/threads/stats", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
