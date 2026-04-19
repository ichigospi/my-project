// 学習データセット zip を生成してレスポンスする。
// キャプション未設定の画像はスキップ。

import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  buildTrainingDatasetZip,
  defaultTrainingParams,
  type TrainingImage,
} from "@/lib/training-dataset";

export const runtime = "nodejs";
export const maxDuration = 600;

function normalizeTrigger(name: string, heightCm: number): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = safe.length > 0 ? safe : "char";
  return `${base}_${heightCm}_v1`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const character = await prisma.character.findUnique({
    where: { id },
    include: { referenceImages: true },
  });
  if (!character) return NextResponse.json({ error: "not found" }, { status: 404 });

  const triggerWord =
    character.triggerWord?.trim() ||
    normalizeTrigger(character.name, character.heightCm);

  const captioned = character.referenceImages.filter((i) => !!i.caption?.trim());
  if (captioned.length < 3) {
    return NextResponse.json(
      {
        error: `キャプション済みの画像が ${captioned.length} 枚しかありません（最低 3 枚必要）`,
      },
      { status: 400 },
    );
  }

  const images: TrainingImage[] = captioned.map((img, i) => {
    const ext = path.extname(img.path).replace(/^\./, "").toLowerCase() || "png";
    return {
      filename: `img_${String(i + 1).padStart(3, "0")}.${ext}`,
      absPath: path.join(process.cwd(), img.path),
      caption: img.caption ?? "",
    };
  });

  const trainingParams = defaultTrainingParams({
    characterName: character.name,
    triggerWord,
    outputName: triggerWord,
    images,
  });

  try {
    const zipBuffer = await buildTrainingDatasetZip(trainingParams);

    // 学習準備中ステータスに更新
    await prisma.character.update({
      where: { id },
      data: { trainingStatus: "preparing", triggerWord },
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${triggerWord}-dataset.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
