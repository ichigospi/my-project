// キャラクター一覧取得 + 新規作成
// - 一覧: ソート = createdAt desc（最新順）
// - 作成: 必須フィールドをバリデーションしてから upsert

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface CreateBody {
  name?: string;
  gender?: string;
  heightCm?: number;
  memo?: string;
  extraPrompt?: string;
  triggerWord?: string;
  defaultOutfitId?: string | null;
  pubicHair?: string | null;
}

function validateGender(g: unknown): g is "female" | "male" | "other" {
  return g === "female" || g === "male" || g === "other";
}

export async function GET() {
  const characters = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
    include: { referenceImages: { orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json({ characters });
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!validateGender(body.gender))
    return NextResponse.json({ error: "gender must be female/male/other" }, { status: 400 });

  const heightCm = Number(body.heightCm);
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 220) {
    return NextResponse.json({ error: "heightCm must be 100–220" }, { status: 400 });
  }

  const character = await prisma.character.create({
    data: {
      name,
      gender: body.gender,
      heightCm,
      memo: body.memo?.trim() || null,
      extraPrompt: body.extraPrompt?.trim() || null,
      triggerWord: body.triggerWord?.trim() || null,
      defaultOutfitId: body.defaultOutfitId || null,
      pubicHair: body.pubicHair || null,
    },
  });

  return NextResponse.json({ character }, { status: 201 });
}
