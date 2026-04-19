// 履歴の個別削除。ディスク上の画像も消す。

import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rec = await prisma.generation.findUnique({ where: { id } });
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.generation.delete({ where: { id } });

  if (rec.imagePath) {
    try {
      await unlink(path.join(process.cwd(), rec.imagePath));
    } catch {
      /* 既に消えてても OK */
    }
  }

  return NextResponse.json({ ok: true });
}
