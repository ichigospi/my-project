// 画像を Claude Vision API に渡して Danbooru 風タグを生成。
// オプションで triggerWord を先頭に強制挿入できる。

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { captionImageWithClaude } from "@/lib/claude-caption";

export const runtime = "nodejs";
export const maxDuration = 120;

const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

interface Body {
  save?: boolean;         // true なら DB に caption を保存（デフォ false: プレビュー返すだけ）
  forcedPrefix?: string;  // "yumi_v1, 1girl, brown hair" 等、先頭固定タグ
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await params;

  let body: Body = {};
  try {
    body = (await req.json().catch(() => ({}))) as Body;
  } catch {
    /* ignore */
  }

  const image = await prisma.referenceImage.findFirst({
    where: { id: imageId, characterId: id },
  });
  if (!image) return NextResponse.json({ error: "not found" }, { status: 404 });

  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "character not found" }, { status: 404 });

  const absPath = path.join(process.cwd(), image.path);
  let buffer: Buffer;
  try {
    buffer = await readFile(absPath);
  } catch {
    return NextResponse.json({ error: "file missing on disk" }, { status: 410 });
  }

  const ext = path.extname(absPath).replace(/^\./, "").toLowerCase();
  const mimeType = MIME_MAP[ext] ?? "image/png";

  try {
    const result = await captionImageWithClaude(buffer, mimeType, {
      triggerWord: character.triggerWord ?? undefined,
      forcedPrefix: body.forcedPrefix,
    });

    if (result.refused) {
      return NextResponse.json({
        refused: true,
        reason:
          "AI が画像の内容を理由に応答を拒否しました（NSFW 等）。手動で記述してください。",
        raw: result.rawResponse ?? "",
      });
    }

    if (body.save) {
      const updated = await prisma.referenceImage.update({
        where: { id: imageId },
        data: {
          caption: result.tags,
          captionSource: "auto_claude",
        },
      });
      return NextResponse.json({ caption: result.tags, saved: true, image: updated });
    }

    return NextResponse.json({ caption: result.tags, saved: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
