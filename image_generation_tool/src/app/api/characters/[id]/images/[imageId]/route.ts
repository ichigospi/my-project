// 参照画像の配信と削除。
// GET: ファイル実体を Content-Type 付きで返す
// DELETE: 行削除 + ディスク上のファイル削除

import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await params;
  const image = await prisma.referenceImage.findFirst({
    where: { id: imageId, characterId: id },
  });
  if (!image) return NextResponse.json({ error: "not found" }, { status: 404 });

  const abs = path.join(process.cwd(), image.path);
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).replace(/^\./, "").toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "file missing on disk" }, { status: 410 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await params;
  const image = await prisma.referenceImage.findFirst({
    where: { id: imageId, characterId: id },
  });
  if (!image) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.referenceImage.delete({ where: { id: imageId } });
  try {
    await unlink(path.join(process.cwd(), image.path));
  } catch {
    /* 既に消えてても気にしない */
  }

  return NextResponse.json({ ok: true });
}
