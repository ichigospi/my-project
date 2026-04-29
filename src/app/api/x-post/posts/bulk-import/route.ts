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
// Body: { competitorId, posts: IncomingPost[], upsert?: boolean }
//   upsert=true（デフォルト）: 同 postId の既存があれば指標を上書き更新
//   upsert=false: 同 postId はスキップ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitorId, posts, upsert = true } = body as {
      competitorId?: string;
      posts?: IncomingPost[];
      upsert?: boolean;
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

    // postId 重複検出（postIdがあるもののみ）
    const incomingPostIds = posts
      .map((p) => p.postId?.trim())
      .filter((s): s is string => Boolean(s));
    const existing = incomingPostIds.length > 0
      ? await prisma.xPost.findMany({
          where: { competitorId, postId: { in: incomingPostIds } },
          select: { id: true, postId: true },
        })
      : [];
    const existingByPostId = new Map(existing.map((p) => [p.postId, p.id]));

    let saved = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    interface CreateData {
      competitorId: string;
      postId: string;
      postUrl: string;
      content: string;
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      postedAt: Date | null;
      isQuoteRt: boolean;
      quotedPostUrl: string;
    }
    type UpdateData = Omit<CreateData, "competitorId" | "postId">;

    const toCreate: CreateData[] = [];
    const toUpdate: { id: string; data: UpdateData }[] = [];

    for (const p of posts) {
      const content = (p.content ?? "").trim();
      if (!content) {
        skipped++;
        continue;
      }
      const postId = (p.postId ?? "").trim();
      const existingId = postId ? existingByPostId.get(postId) : undefined;

      const dataCommon = {
        postUrl: p.postUrl ?? "",
        content,
        likes: Number(p.likes ?? 0) || 0,
        retweets: Number(p.retweets ?? 0) || 0,
        replies: Number(p.replies ?? 0) || 0,
        impressions: Number(p.impressions ?? 0) || 0,
        postedAt: p.postedAt ? new Date(p.postedAt) : null,
        isQuoteRt: Boolean(p.isQuoteRt ?? false),
        quotedPostUrl: "",
      };

      if (existingId) {
        if (upsert) {
          toUpdate.push({ id: existingId, data: dataCommon });
        } else {
          skipped++;
        }
      } else {
        toCreate.push({
          competitorId,
          postId,
          ...dataCommon,
        });
      }
    }

    // create を一括（createMany）
    if (toCreate.length > 0) {
      try {
        const result = await prisma.xPost.createMany({ data: toCreate });
        saved = result.count;
      } catch {
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

    // update は1件ずつ（Prismaにbulk updateがないので）
    for (const u of toUpdate) {
      try {
        await prisma.xPost.update({ where: { id: u.id }, data: u.data });
        updated++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    return NextResponse.json({
      saved: saved + updated,
      created: saved,
      updated,
      skipped,
      total: posts.length,
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    console.error("POST /api/x-post/posts/bulk-import", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
