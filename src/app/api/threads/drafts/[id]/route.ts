// 投稿管理（draft）の詳細取得・フィールド単位更新・削除
// PATCHはフィールド単位: 別々の編集者が別フィールドを同時編集しても衝突しない
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";

// GET /api/threads/drafts/:id （詳細 + 計測履歴）
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const draft = await prisma.threadsPostDraft.findUnique({
      where: { id },
      include: {
        snapshots: { orderBy: { capturedAt: "asc" } },
      },
    });
    if (!draft) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(draft);
  } catch (e) {
    console.error("GET /api/threads/drafts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

const STATUSES = ["draft", "approved", "scheduled", "published", "rejected"];

// PATCH /api/threads/drafts/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};

    for (const key of ["content", "generationMeta", "mediaUrls", "postUrl", "insight", "ownerComment"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (body.scheduledAt !== undefined) {
      data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }
    if (typeof body.status === "string" && STATUSES.includes(body.status)) {
      data.status = body.status;
      // 投稿可否チェック: 誰が承認したかを記録
      if (body.status === "approved") {
        const session = await getSession();
        const user = session?.user as { id?: string } | undefined;
        data.approvedById = user?.id ?? null;
      }
      if (body.status === "draft" || body.status === "rejected") {
        data.approvedById = null;
      }
      // スマホから手動投稿した時刻を記録
      if (body.status === "published") {
        data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
      }
    }

    // 実績の手動入力: 値が来たら本体更新 + 時系列スナップショット追加
    const metricKeys = ["views", "likes", "replies", "reposts", "quotes"] as const;
    const hasMetrics = metricKeys.some((k) => body[k] !== undefined);
    if (hasMetrics) {
      const current = await prisma.threadsPostDraft.findUnique({
        where: { id },
        select: { views: true, likes: true, replies: true, reposts: true, quotes: true },
      });
      if (!current) {
        return NextResponse.json({ error: "見つかりません" }, { status: 404 });
      }
      const merged = { ...current } as Record<string, number>;
      for (const k of metricKeys) {
        if (body[k] !== undefined) {
          merged[k] = Number(body[k]) || 0;
          data[k] = merged[k];
        }
      }
      data.metricsUpdatedAt = new Date();
      await prisma.threadsMetricSnapshot.create({
        data: {
          draftId: id,
          views: merged.views,
          likes: merged.likes,
          replies: merged.replies,
          reposts: merged.reposts,
          quotes: merged.quotes,
        },
      });
    }

    const draft = await prisma.threadsPostDraft.update({ where: { id }, data });
    return NextResponse.json(draft);
  } catch (e) {
    console.error("PATCH /api/threads/drafts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/drafts/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.threadsPostDraft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/threads/drafts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
