import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { SOURCES } from "@/lib/domain";

// 日次実績（リストイン・無料鑑定）の手入力。UTAGE連携までのつなぎ + 手動運用分の補完
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const events = await prisma.funnelEvent.findMany({
    where: { stage: { in: ["list_in", "free_apply", "free_sent"] } },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { account: { select: { name: true, color: true } } },
  });
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { date, accountId, listIn, freeApply, freeSent } = await req.json();
  if (!date || !accountId) {
    return NextResponse.json({ error: "日付とアカウントは必須です" }, { status: 400 });
  }

  const rows: {
    accountId: string;
    stage: string;
    source?: string;
    count: number;
    occurredOn: string;
  }[] = [];

  for (const s of SOURCES) {
    const n = Number(listIn?.[s.key] ?? 0);
    if (n > 0) rows.push({ accountId, stage: "list_in", source: s.key, count: n, occurredOn: date });
  }
  const apply = Number(freeApply ?? 0);
  if (apply > 0) rows.push({ accountId, stage: "free_apply", count: apply, occurredOn: date });
  const sent = Number(freeSent ?? 0);
  if (sent > 0) rows.push({ accountId, stage: "free_sent", count: sent, occurredOn: date });

  if (rows.length === 0) {
    return NextResponse.json({ error: "1件以上の実績を入力してください" }, { status: 400 });
  }

  await prisma.funnelEvent.createMany({ data: rows });
  return NextResponse.json({ ok: true, created: rows.length });
}
