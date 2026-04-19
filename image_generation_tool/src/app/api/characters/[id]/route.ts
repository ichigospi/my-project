// キャラクター個別取得・更新・削除。

import { NextResponse } from "next/server";
import { rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface UpdateBody {
  name?: string;
  gender?: string;
  heightCm?: number;
  memo?: string | null;
  extraPrompt?: string | null;
  triggerWord?: string | null;
  loraScale?: number;
  defaultOutfitId?: string | null;
  pubicHair?: string | null;
}

function validateGender(g: unknown): g is "female" | "male" | "other" {
  return g === "female" || g === "male" || g === "other";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ character });
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
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.gender !== undefined) {
    if (!validateGender(body.gender))
      return NextResponse.json({ error: "gender must be female/male/other" }, { status: 400 });
    data.gender = body.gender;
  }
  if (body.heightCm !== undefined) {
    const h = Number(body.heightCm);
    if (!Number.isFinite(h) || h < 100 || h > 220) {
      return NextResponse.json({ error: "heightCm must be 100–220" }, { status: 400 });
    }
    data.heightCm = h;
  }
  if (body.memo !== undefined) data.memo = body.memo?.trim() || null;
  if (body.extraPrompt !== undefined) data.extraPrompt = body.extraPrompt?.trim() || null;
  if (body.triggerWord !== undefined) data.triggerWord = body.triggerWord?.trim() || null;
  if (body.loraScale !== undefined) {
    const s = Number(body.loraScale);
    if (!Number.isFinite(s) || s < 0 || s > 2) {
      return NextResponse.json({ error: "loraScale must be 0..2" }, { status: 400 });
    }
    data.loraScale = s;
  }
  if (body.defaultOutfitId !== undefined) data.defaultOutfitId = body.defaultOutfitId || null;
  if (body.pubicHair !== undefined) data.pubicHair = body.pubicHair || null;

  try {
    const character = await prisma.character.update({ where: { id }, data });
    return NextResponse.json({ character });
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
    await prisma.character.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // DB 側のカスケードで ReferenceImage レコードは消えるが、
  // ディスクのディレクトリを明示的に削除する。
  const dir = path.join(process.cwd(), "storage", "characters", id);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* 存在しなくても OK */
  }
  return NextResponse.json({ ok: true });
}
