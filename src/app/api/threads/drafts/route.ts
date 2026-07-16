// 投稿管理（draft）の一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildRefSnapshot } from "@/lib/threads-server";

const PAGE_SIZE = 50;

// GET /api/threads/drafts?accountId=xxx&status=&page=1&q=
// 一覧は必要カラムのみ（本文はプレビュー用に先頭のみクライアント側で切る）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    if (!accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }
    const where: Record<string, unknown> = { accountId };
    if (status) where.status = status;
    if (q) where.content = { contains: q };

    const [total, drafts] = await Promise.all([
      prisma.threadsPostDraft.count({ where }),
      prisma.threadsPostDraft.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          content: true,
          refASnapshot: true,
          refBSnapshot: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          postUrl: true,
          views: true,
          likes: true,
          replies: true,
          reposts: true,
          quotes: true,
          metricsUpdatedAt: true,
          insight: true,
          ownerComment: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return NextResponse.json({ total, page, pageSize: PAGE_SIZE, drafts });
  } catch (e) {
    console.error("GET /api/threads/drafts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/drafts
// Body: { accountId, content?, refAPostId?, refBPostId?, generationMeta?, scheduledAt? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId は必須" }, { status: 400 });
    }

    const [refA, refB] = await Promise.all([
      body.refAPostId ? buildRefSnapshot(body.refAPostId) : Promise.resolve(null),
      body.refBPostId ? buildRefSnapshot(body.refBPostId) : Promise.resolve(null),
    ]);

    const draft = await prisma.threadsPostDraft.create({
      data: {
        accountId: body.accountId,
        content: body.content ?? "",
        refAPostId: body.refAPostId || null,
        refASnapshot: refA ? JSON.stringify(refA) : "{}",
        refBPostId: body.refBPostId || null,
        refBSnapshot: refB ? JSON.stringify(refB) : "{}",
        generationMeta: typeof body.generationMeta === "string" ? body.generationMeta : JSON.stringify(body.generationMeta ?? {}),
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });
    return NextResponse.json(draft);
  } catch (e) {
    console.error("POST /api/threads/drafts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
