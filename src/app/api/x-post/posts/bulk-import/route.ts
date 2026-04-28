// CSVから一括インポート（XアナリティクスCSVの取り込みに使う）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface IncomingPost {
  postId?: string;
  postUrl?: string;
  content?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  postedAt?: string | null;
  isQuoteRt?: boolean;
}

// POST /api/x-post/posts/bulk-import
// Body: { competitorId, posts: IncomingPost[] }
//   既存と同じ postId はスキップ。空 postId のものは内容ハッシュ重複チェックなしでそのまま追加。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitorId, posts } = body as {
      competitorId?: string;
      posts?: IncomingPost[];
    };

    if (!competitorId) {
      return NextResponse.json({ error: "competitorId は必須" }, { status: 400 });
    }
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "posts 配列が空です" }, { status: 400 });
    }
    if (posts.length > 5000) {
      return NextResponse.json({ error: "1回のインポート上限は 5000 件です" }, { status: 400 });
    }

    const competitor = await prisma.xCompetitor.findUnique({ where: { id: competitorId } });
    if (!competitor) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }

    // postId 重複検出
    const incomingPostIds = posts
      .map((p) => p.postId?.trim())
      .filter((s): s is string => Boolean(s));
    const existing = incomingPostIds.length > 0
      ? await prisma.xPost.findMany({
          where: { competitorId, postId: { in: incomingPostIds } },
          select: { postId: true },
        })
      : [];
    const existingSet = new Set(existing.map((p) => p.postId));

    let saved = 0;
    let skipped = 0;
    const errors: string[] = [];

    // バッチでcreate（Prismaのトランザクション）
    const toCreate = [];
    for (const p of posts) {
      const content = (p.content ?? "").trim();
      if (!content) {
        skipped++;
        continue;
      }
      const postId = (p.postId ?? "").trim();
      if (postId && existingSet.has(postId)) {
        skipped++;
        continue;
      }
      toCreate.push({
        competitorId,
        postId,
        postUrl: p.postUrl ?? "",
        content,
        likes: Number(p.likes ?? 0) || 0,
        retweets: Number(p.retweets ?? 0) || 0,
        replies: Number(p.replies ?? 0) || 0,
        impressions: Number(p.impressions ?? 0) || 0,
        postedAt: p.postedAt ? new Date(p.postedAt) : null,
        isQuoteRt: Boolean(p.isQuoteRt ?? false),
        quotedPostUrl: "",
      });
    }

    if (toCreate.length > 0) {
      try {
        const result = await prisma.xPost.createMany({ data: toCreate });
        saved = result.count;
      } catch {
        // フォールバック: 1件ずつ try
        for (const data of toCreate) {
          try {
            await prisma.xPost.create({ data });
            saved++;
          } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
      }
    }

    return NextResponse.json({
      saved,
      skipped,
      total: posts.length,
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    console.error("POST /api/x-post/posts/bulk-import", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
