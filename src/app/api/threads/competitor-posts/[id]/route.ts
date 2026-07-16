// 競合投稿の取得・更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/competitor-posts/:id
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const post = await prisma.threadsCompetitorPost.findUnique({
      where: { id },
      include: { competitor: { select: { handle: true, name: true } } },
    });
    if (!post) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (e) {
    console.error("GET /api/threads/competitor-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/threads/competitor-posts/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const key of ["content", "postUrl", "planType", "hookType", "structureJson", "mediaUrls"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    for (const key of ["likes", "replies", "reposts", "quotes", "views", "followerCountAt"] as const) {
      if (body[key] !== undefined) data[key] = Number(body[key]);
    }
    if (typeof body.isHot === "boolean") data.isHot = body.isHot;
    if (body.postedAt !== undefined) data.postedAt = body.postedAt ? new Date(body.postedAt) : null;

    const post = await prisma.threadsCompetitorPost.update({ where: { id }, data });
    return NextResponse.json(post);
  } catch (e) {
    console.error("PATCH /api/threads/competitor-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/competitor-posts/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.threadsCompetitorPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/threads/competitor-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
