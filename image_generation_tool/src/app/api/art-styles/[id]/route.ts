// 絵柄個別取得・更新・削除。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_BASE_MODELS = new Set(["illustrious", "pony", "sdxl"]);

interface UpdateBody {
  name?: string;
  baseModel?: string;
  loraUrl?: string | null;
  loraScale?: number;
  triggerWords?: string | null;
  styleTags?: string | null;
  thumbnailsJson?: string | null;
  memo?: string | null;
  tagsJson?: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.artStyle.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = n;
  }
  if (body.baseModel !== undefined) {
    const bm = body.baseModel.toLowerCase();
    if (!ALLOWED_BASE_MODELS.has(bm))
      return NextResponse.json({ error: `invalid baseModel` }, { status: 400 });
    data.baseModel = bm;
  }
  if (body.loraUrl !== undefined) data.loraUrl = body.loraUrl?.trim() || null;
  if (body.loraScale !== undefined) data.loraScale = body.loraScale;
  if (body.triggerWords !== undefined)
    data.triggerWords = body.triggerWords?.trim() || null;
  if (body.styleTags !== undefined) data.styleTags = body.styleTags?.trim() || null;
  if (body.thumbnailsJson !== undefined) data.thumbnailsJson = body.thumbnailsJson;
  if (body.memo !== undefined) data.memo = body.memo?.trim() || null;
  if (body.tagsJson !== undefined) data.tagsJson = body.tagsJson;

  try {
    const item = await prisma.artStyle.update({ where: { id }, data });
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
    await prisma.artStyle.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
