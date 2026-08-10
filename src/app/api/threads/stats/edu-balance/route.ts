// 実施した「教育」のバランス集計（投稿履歴のeduTagsを集計してチャート表示に使う）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/stats/edu-balance?accountId=xxx&scope=published|all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }
    // 既定は「投稿済み」の実績のみ。scope=all で下書き等も含める。
    const scope = searchParams.get("scope") || "published";
    const where: Record<string, unknown> = { accountId };
    if (scope !== "all") where.status = "published";

    const drafts = await prisma.threadsPostDraft.findMany({
      where,
      select: { eduTags: true, views: true, likes: true, status: true },
    });

    // 教育タグごとに: 投稿数・表示合計・いいね合計 を集計
    const map = new Map<string, { count: number; views: number; likes: number }>();
    let taggedPosts = 0;
    let untaggedPosts = 0;
    for (const d of drafts) {
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(d.eduTags || "[]");
        if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string");
      } catch {
        tags = [];
      }
      if (tags.length === 0) {
        untaggedPosts++;
        continue;
      }
      taggedPosts++;
      for (const t of tags) {
        const cur = map.get(t) || { count: 0, views: 0, likes: 0 };
        cur.count++;
        cur.views += d.views || 0;
        cur.likes += d.likes || 0;
        map.set(t, cur);
      }
    }

    const balance = Array.from(map.entries())
      .map(([tag, v]) => ({
        tag,
        count: v.count,
        avgViews: v.count > 0 ? Math.round(v.views / v.count) : 0,
        avgLikes: v.count > 0 ? Math.round(v.likes / v.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalPosts: drafts.length,
      taggedPosts,
      untaggedPosts,
      balance,
    });
  } catch (e) {
    console.error("GET /api/threads/stats/edu-balance", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
