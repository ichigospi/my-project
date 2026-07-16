// Threads自アカウントの一覧取得・新規作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/threads/accounts
export async function GET() {
  try {
    const accounts = await prisma.threadsAccount.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { competitors: true, drafts: true } } },
    });
    return NextResponse.json(accounts);
  } catch (e) {
    console.error("GET /api/threads/accounts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.handle) {
      return NextResponse.json({ error: "name と handle は必須" }, { status: 400 });
    }
    const account = await prisma.threadsAccount.create({
      data: {
        name: String(body.name),
        handle: String(body.handle).replace(/^@/, ""),
        concept: body.concept ?? "",
        logic: body.logic ?? "",
        target: body.target ?? "",
        tone: body.tone ?? "{}",
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });
    return NextResponse.json(account);
  } catch (e: unknown) {
    console.error("POST /api/threads/accounts", e);
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "同じハンドルのアカウントが既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
