// アカウント配下の競合投稿で使われているタグ一覧（サジェスト用・出現数降順）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) return NextResponse.json({ tags: [] });

    const posts = await prisma.threadsCompetitorPost.findMany({
      where: { competitor: { accountId } },
      select: { tags: true },
      take: 2000,
    });
    const counts = new Map<string, number>();
    for (const p of posts) {
      let arr: unknown;
      try {
        arr = JSON.parse(p.tags || "[]");
      } catch {
        arr = [];
      }
      if (Array.isArray(arr)) {
        for (const t of arr) {
          const s = String(t).trim();
          if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
        }
      }
    }
    const tags = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([tag, count]) => ({ tag, count }));
    return NextResponse.json({ tags });
  } catch (e) {
    console.error("GET /api/threads/tags", e);
    return NextResponse.json({ tags: [] });
  }
}
