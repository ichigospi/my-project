// キャプションテンプレートの個別更新・削除。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface PatchBody {
  label?: string;
  body?: string;
  category?: string | null;
  order?: number;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let b: PatchBody;
  try {
    b = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (b.label !== undefined) data.label = b.label.trim();
  if (b.body !== undefined) data.body = b.body.trim();
  if (b.category !== undefined) data.category = b.category?.trim() || null;
  if (b.order !== undefined) data.order = b.order;

  try {
    const item = await prisma.captionTemplate.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.captionTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
