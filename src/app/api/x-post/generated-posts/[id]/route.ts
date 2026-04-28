// 個別生成ポストの取得・更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const post = await prisma.xGeneratedPost.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(post);
  } catch (e) {
    console.error("GET /api/x-post/generated-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["topic", "instruction", "educationType", "logicType", "output", "metadata"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const post = await prisma.xGeneratedPost.update({ where: { id }, data });
    return NextResponse.json(post);
  } catch (e) {
    console.error("PUT /api/x-post/generated-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xGeneratedPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/generated-posts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
