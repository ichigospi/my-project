// キャプションテンプレートの一覧取得 + 新規作成。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface CreateBody {
  label?: string;
  body?: string;
  category?: string;
  order?: number;
}

export async function GET() {
  const items = await prisma.captionTemplate.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let data: CreateBody;
  try {
    data = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const label = data.label?.trim();
  const body = data.body?.trim();
  if (!label || !body)
    return NextResponse.json({ error: "label and body required" }, { status: 400 });

  const created = await prisma.captionTemplate.create({
    data: {
      label,
      body,
      category: data.category?.trim() || null,
      order: typeof data.order === "number" ? data.order : 0,
    },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
