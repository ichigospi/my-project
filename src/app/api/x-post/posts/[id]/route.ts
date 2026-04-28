// 個別収集ポストの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const stringFields = ["postId", "postUrl", "content", "quotedPostUrl"];
    for (const f of stringFields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.likes !== undefined) data.likes = Number(body.likes);
    if (body.retweets !== undefined) data.retweets = Number(body.retweets);
    if (body.replies !== undefined) data.replies = Number(body.replies);
    if (body.impressions !== undefined) data.impressions = Number(body.impressions);
    if (body.isQuoteRt !== undefined) data.isQuoteRt = Boolean(body.isQuoteRt);
    if (body.postedAt !== undefined) {
      data.postedAt = body.postedAt ? new Date(body.postedAt) : null;
    }
    const post = await prisma.xPost.update({ where: { id }, data });
    return NextResponse.json(post);
  } catch (e) {
    console.error("PUT /api/x-post/posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xPost.delete({ where: { id } });
    // フォルダ紐付けも削除
    await prisma.xFolderItem.deleteMany({
      where: { itemType: "competitor_post", itemId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
