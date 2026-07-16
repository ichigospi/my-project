// アナリティクス: 投稿済みdraftの実績集計
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface PlanTypeAgg {
  planType: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
}

// GET /api/threads/analytics?accountId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }

    const published = await prisma.threadsPostDraft.findMany({
      where: { accountId, status: "published" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        content: true,
        refASnapshot: true,
        publishedAt: true,
        views: true,
        likes: true,
        replies: true,
        reposts: true,
        quotes: true,
      },
    });

    const n = published.length;
    const sum = (f: (d: (typeof published)[number]) => number) => published.reduce((a, d) => a + f(d), 0);
    const avg = (v: number) => (n > 0 ? Math.round(v / n) : 0);

    // 企画タイプ別（参考投稿Aの分類を使用）
    const byPlan = new Map<string, { count: number; views: number; likes: number; replies: number }>();
    for (const d of published) {
      let planType = "不明";
      try {
        planType = (JSON.parse(d.refASnapshot || "{}").planType as string) || "不明";
      } catch {
        // ignore
      }
      const cur = byPlan.get(planType) ?? { count: 0, views: 0, likes: 0, replies: 0 };
      cur.count++;
      cur.views += d.views;
      cur.likes += d.likes;
      cur.replies += d.replies;
      byPlan.set(planType, cur);
    }
    const planTypes: PlanTypeAgg[] = Array.from(byPlan.entries())
      .map(([planType, v]) => ({
        planType,
        count: v.count,
        avgViews: Math.round(v.views / v.count),
        avgLikes: Math.round(v.likes / v.count),
        avgReplies: Math.round(v.replies / v.count),
      }))
      .sort((a, b) => b.avgLikes - a.avgLikes);

    // 実績ランキング（いいね順）
    const topPosts = [...published]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        content: d.content.slice(0, 80),
        publishedAt: d.publishedAt,
        views: d.views,
        likes: d.likes,
        replies: d.replies,
        reposts: d.reposts,
      }));

    return NextResponse.json({
      publishedCount: n,
      totals: {
        views: sum((d) => d.views),
        likes: sum((d) => d.likes),
        replies: sum((d) => d.replies),
        reposts: sum((d) => d.reposts),
      },
      averages: {
        views: avg(sum((d) => d.views)),
        likes: avg(sum((d) => d.likes)),
        replies: avg(sum((d) => d.replies)),
        reposts: avg(sum((d) => d.reposts)),
      },
      planTypes,
      topPosts,
      recent: published.slice(0, 30).map((d) => ({
        id: d.id,
        content: d.content.slice(0, 80),
        publishedAt: d.publishedAt,
        views: d.views,
        likes: d.likes,
        replies: d.replies,
        reposts: d.reposts,
      })),
    });
  } catch (e) {
    console.error("GET /api/threads/analytics", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
