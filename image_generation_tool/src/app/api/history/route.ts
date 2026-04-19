// 生成履歴の一覧取得。
// - デフォルト: 完了 (completed) + 失敗 (failed) を新しい順
// - クエリ: status=completed|failed|all, limit=N（1..200）

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 60;

  const where: Record<string, unknown> = {};
  if (status === "completed") where.status = "completed";
  else if (status === "failed") where.status = "failed";
  else if (status === "all") where.status = { in: ["completed", "failed"] };

  const items = await prisma.generation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // BigInt は JSON でそのまま返せないので seed を string に変換
  const serialized = items.map((it) => ({
    ...it,
    seed: it.seed.toString(),
  }));

  return NextResponse.json({ items: serialized });
}
