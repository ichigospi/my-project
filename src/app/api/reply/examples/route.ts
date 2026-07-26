// 実例（ReplyExample）の一覧取得・作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const examples = await prisma.replyExample.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(examples);
  } catch (e) {
    console.error("GET /api/reply/examples", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { category = "general", customerMessage, replyMessage, note = "", source = "manual" } = body;
    if (!customerMessage || !replyMessage) {
      return NextResponse.json({ error: "customerMessage と replyMessage は必須です" }, { status: 400 });
    }
    const example = await prisma.replyExample.create({
      data: { category, customerMessage, replyMessage, note, source },
    });
    return NextResponse.json(example);
  } catch (e) {
    console.error("POST /api/reply/examples", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
