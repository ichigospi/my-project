import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { aggregate } from "@/lib/aggregate";

// ローンチ一覧（期間中の実績集計つき）
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const launches = await prisma.launch.findMany({
    orderBy: { startOn: "desc" },
    include: { account: { select: { name: true, color: true } } },
  });

  // 期間中の全実績 + ローンチに直接紐付けた売上
  const withStats = await Promise.all(
    launches.map(async (l) => {
      const [period, attributed] = await Promise.all([
        aggregate(l.startOn, l.endOn, l.accountId),
        prisma.sale.aggregate({
          where: { launchId: l.id },
          _sum: { amount: true, quantity: true },
        }),
      ]);
      return {
        ...l,
        stats: {
          period,
          attributedAmount: attributed._sum.amount ?? 0,
          attributedQuantity: attributed._sum.quantity ?? 0,
        },
      };
    })
  );

  return NextResponse.json({ launches: withStats });
}

export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { accountId, name, productName, startOn, endOn, goalAmount, memo } = await req.json();
  if (!accountId || !name?.trim() || !startOn || !endOn) {
    return NextResponse.json({ error: "アカウント・名前・期間は必須です" }, { status: 400 });
  }
  if (endOn < startOn) {
    return NextResponse.json({ error: "終了日は開始日以降にしてください" }, { status: 400 });
  }

  const launch = await prisma.launch.create({
    data: {
      accountId,
      name: name.trim(),
      productName: productName?.trim() || "",
      startOn,
      endOn,
      goalAmount: Math.max(0, Number(goalAmount) || 0),
      memo: memo?.trim() || "",
    },
  });
  return NextResponse.json({ launch });
}
