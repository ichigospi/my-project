// タグ分類（大/中/小）の一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/tag-categories
// タグ分類は全アカウント共有（切替で引き継がれる）。accountId は無視して全件返す。
export async function GET() {
  try {
    const categories = await prisma.threadsTagCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("GET /api/threads/tag-categories", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/tag-categories { accountId, parentId?, name }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.accountId || !body.name?.trim()) {
      return NextResponse.json({ error: "accountId と name は必須" }, { status: 400 });
    }
    const cat = await prisma.threadsTagCategory.create({
      data: {
        accountId: String(body.accountId),
        parentId: body.parentId || null,
        name: String(body.name).trim(),
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });
    return NextResponse.json(cat);
  } catch (e) {
    console.error("POST /api/threads/tag-categories", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
