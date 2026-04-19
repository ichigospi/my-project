// 学習ステータスの手動更新。
//   status: "none" / "preparing" / "training" / "ready" / "failed"
//   loraUrl: Pod 上で生成された .safetensors のファイル名
//     （/workspace/models/loras/<loraUrl>）

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED = new Set(["none", "preparing", "training", "ready", "failed"]);

interface Body {
  status?: string;
  loraUrl?: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!ALLOWED.has(body.status)) {
      return NextResponse.json({ error: `invalid status: ${body.status}` }, { status: 400 });
    }
    data.trainingStatus = body.status;
  }
  if (body.loraUrl !== undefined) data.loraUrl = body.loraUrl?.trim() || null;

  // ready 状態になる＝loraUrl が未設定なら triggerWord.safetensors を想定で入れる
  if (body.status === "ready" && !("loraUrl" in data) && !character.loraUrl) {
    if (character.triggerWord) {
      data.loraUrl = `${character.triggerWord}.safetensors`;
    }
  }

  const updated = await prisma.character.update({ where: { id }, data });
  return NextResponse.json({ character: updated });
}
