// 全プリセットを一括で取得する。
// 生成画面の初回ロードで呼ぶ想定（件数は少ないので分割しない）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const [
    timePresets,
    viewAnglePresets,
    clothingPresets,
    hairstylePresets,
    actionCategories,
    characters,
    locations,
    artStyles,
  ] = await Promise.all([
    prisma.timePreset.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    prisma.viewAnglePreset.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    prisma.clothingPreset.findMany({ orderBy: [{ order: "asc" }] }),
    prisma.hairstylePreset.findMany({ orderBy: [{ order: "asc" }] }),
    prisma.actionCategory.findMany({
      orderBy: { order: "asc" },
      include: { actions: { orderBy: { order: "asc" } } },
    }),
    prisma.character.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.location.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.artStyle.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    timePresets,
    viewAnglePresets,
    clothingPresets,
    hairstylePresets,
    actionCategories,
    characters,
    locations,
    artStyles,
  });
}
