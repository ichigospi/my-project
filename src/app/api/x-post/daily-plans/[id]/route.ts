// 個別デイリープランの取得・更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const plan = await prisma.xDailyPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json(plan);
  } catch (e) {
    console.error("GET /api/x-post/daily-plans/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["slots", "notes", "status"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const plan = await prisma.xDailyPlan.update({ where: { id }, data });
    return NextResponse.json(plan);
  } catch (e) {
    console.error("PUT /api/x-post/daily-plans/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.xDailyPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/daily-plans/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
