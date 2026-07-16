// ノウハウ・投稿ルールの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TYPES = ["rule", "knowhow", "teaching", "memo"];

// GET /api/threads/knowledge?accountId=xxx&type=rule
// accountId指定時は「そのアカウント専用 + 全アカ共通(null)」を返す
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (accountId) where.OR = [{ accountId }, { accountId: null }];
    if (type) where.type = type;

    const items = await prisma.threadsKnowledge.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("GET /api/threads/knowledge", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/knowledge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.content || !TYPES.includes(body.type)) {
      return NextResponse.json({ error: `content と type（${TYPES.join("/")}）は必須` }, { status: 400 });
    }
    const item = await prisma.threadsKnowledge.create({
      data: {
        accountId: body.accountId || null,
        type: body.type,
        title: body.title ?? "",
        content: body.content,
        tags: body.tags ?? "[]",
        isInjected: Boolean(body.isInjected ?? true),
      },
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("POST /api/threads/knowledge", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
