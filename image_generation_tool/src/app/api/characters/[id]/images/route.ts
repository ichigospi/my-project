// キャラクター参照画像のアップロード + 一覧取得。
// - multipart/form-data で受け取り、storage/characters/<id>/ に保存
// - ReferenceImage テーブルに行を追加
// - purpose: general / training / face / boost_source
// - 許可形式: jpg / jpeg / png / webp
// - 上限: 1 ファイル 20MB

import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function storageDir(charId: string): string {
  return path.join(process.cwd(), "storage", "characters", charId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const character = await prisma.character.findUnique({
    where: { id },
    include: { referenceImages: { orderBy: { createdAt: "desc" } } },
  });
  if (!character) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ images: character.referenceImages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "character not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const purpose = (form.get("purpose") || "general").toString();
  const memo = (form.get("memo") || "").toString();

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (>20MB)" }, { status: 413 });
  }

  const originalName = file instanceof File ? file.name : "upload";
  const ext = path.extname(originalName).replace(/^\./, "").toLowerCase() || "png";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `unsupported format: ${ext}` }, { status: 400 });
  }

  const filename = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
  const dir = storageDir(id);
  await mkdir(dir, { recursive: true });
  const absPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  const record = await prisma.referenceImage.create({
    data: {
      characterId: id,
      path: `storage/characters/${id}/${filename}`,
      purpose,
      memo: memo || null,
    },
  });

  return NextResponse.json({ image: record }, { status: 201 });
}
