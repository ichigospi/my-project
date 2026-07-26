// 判断ルール（ReplyPolicy）の一覧取得・作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const policies = await prisma.replyPolicy.findMany({
      orderBy: [{ category: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(policies);
  } catch (e) {
    console.error("GET /api/reply/policies", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { category = "general", title, situation = "", guideline, priority = 0, source = "manual" } = body;
    if (!title || !guideline) {
      return NextResponse.json({ error: "title と guideline は必須です" }, { status: 400 });
    }
    const policy = await prisma.replyPolicy.create({
      data: { category, title, situation, guideline, priority, source },
    });
    return NextResponse.json(policy);
  } catch (e) {
    console.error("POST /api/reply/policies", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
