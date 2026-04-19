// 学習準備チェック。データセット生成の事前バリデーション。
//   - 画像枚数（3 枚未満は不可、10 枚以上推奨）
//   - キャプション付与率（50% 未満は警告）
//   - トリガーワード（未設定なら自動生成して保存）

import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeTrigger(name: string, heightCm: number): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = safe.length > 0 ? safe : "char";
  return `${base}_${heightCm}_v1`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const character = await prisma.character.findUnique({
    where: { id },
    include: { referenceImages: true },
  });
  if (!character) return NextResponse.json({ error: "not found" }, { status: 404 });

  const images = character.referenceImages;
  const captioned = images.filter((i) => !!i.caption?.trim());

  const issues: string[] = [];
  const warnings: string[] = [];

  if (images.length < 3) {
    issues.push(`画像が ${images.length} 枚しかありません（最低 3 枚・推奨 10 枚以上）`);
  } else if (images.length < 10) {
    warnings.push(`画像が ${images.length} 枚です。10 枚以上あると安定します`);
  }

  if (captioned.length === 0) {
    issues.push("キャプションが全画像で未設定です");
  } else if (captioned.length / images.length < 0.5) {
    warnings.push(
      `キャプション付与: ${captioned.length}/${images.length}（半分以上推奨）`,
    );
  }

  // トリガーワードを確定（無ければ自動生成して DB に保存）
  let triggerWord = character.triggerWord;
  if (!triggerWord || triggerWord.trim().length === 0) {
    triggerWord = normalizeTrigger(character.name, character.heightCm);
    await prisma.character.update({
      where: { id },
      data: { triggerWord },
    });
  }

  const outputName = triggerWord;

  // 画像パスを解決（キャプションあるものだけ）
  const trainingImages = captioned.map((img, i) => {
    const ext = path.extname(img.path).replace(/^\./, "").toLowerCase() || "png";
    return {
      filename: `img_${String(i + 1).padStart(3, "0")}.${ext}`,
      absPath: path.join(process.cwd(), img.path),
      caption: img.caption ?? "",
    };
  });

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    warnings,
    stats: {
      totalImages: images.length,
      captioned: captioned.length,
      triggerWord,
      outputName,
      recommendedRepeats: 10,
      recommendedEpochs: 10,
      estimatedSteps: trainingImages.length * 10 * 10,
      estimatedMinutes: Math.ceil((trainingImages.length * 10 * 10) / 100),
    },
  });
}
