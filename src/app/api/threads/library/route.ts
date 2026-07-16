// フック・企画・CTAライブラリの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TYPES = ["hook", "plan", "cta"];

// GET /api/threads/library?accountId=xxx&type=hook
// accountId指定時は「そのアカウント専用 + 全アカ共通(null)」を返す
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (accountId) where.OR = [{ accountId }, { accountId: null }];
    if (type) where.type = type;

    const items = await prisma.threadsLibraryItem.findMany({
      where,
      orderBy: [{ strength: "desc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("GET /api/threads/library", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/library
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title || !body.content || !TYPES.includes(body.type)) {
      return NextResponse.json({ error: `title / content / type（${TYPES.join("/")}）は必須` }, { status: 400 });
    }
    const item = await prisma.threadsLibraryItem.create({
      data: {
        accountId: body.accountId || null,
        type: body.type,
        title: body.title,
        content: body.content,
        sourcePostId: body.sourcePostId || null,
        tags: body.tags ?? "[]",
        strength: Math.min(5, Math.max(1, Number(body.strength ?? 3))),
        note: body.note ?? "",
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("POST /api/threads/library", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
