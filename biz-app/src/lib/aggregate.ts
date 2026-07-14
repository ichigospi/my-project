import { prisma } from "./prisma";

export type SummaryData = {
  listIn: number;
  bySource: Record<string, number>;
  freeApply: number;
  freeSent: number;
  salesByCategory: Record<string, { amount: number; quantity: number }>;
  salesTotal: number;
};

// 期間・アカウントで絞った実績集計（ダッシュボード・ローンチ・AI分析で共用）
export async function aggregate(
  from: string | null,
  to: string | null,
  accountId: string | null
): Promise<SummaryData> {
  const dateFilter =
    from || to
      ? { occurredOn: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};
  const accountFilter = accountId ? { accountId } : {};

  const [stageGroups, sourceGroups, saleGroups] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ["stage"],
      where: { ...dateFilter, ...accountFilter },
      _sum: { count: true },
    }),
    prisma.funnelEvent.groupBy({
      by: ["source"],
      where: { ...dateFilter, ...accountFilter, stage: "list_in" },
      _sum: { count: true },
    }),
    prisma.sale.groupBy({
      by: ["category"],
      where: { ...dateFilter, ...accountFilter },
      _sum: { amount: true, quantity: true },
    }),
  ]);

  const stages: Record<string, number> = {};
  for (const g of stageGroups) stages[g.stage] = g._sum.count ?? 0;

  const bySource: Record<string, number> = {};
  for (const g of sourceGroups) if (g.source) bySource[g.source] = g._sum.count ?? 0;

  const salesByCategory: Record<string, { amount: number; quantity: number }> = {};
  let salesTotal = 0;
  for (const g of saleGroups) {
    salesByCategory[g.category] = {
      amount: g._sum.amount ?? 0,
      quantity: g._sum.quantity ?? 0,
    };
    salesTotal += g._sum.amount ?? 0;
  }

  return {
    listIn: stages["list_in"] ?? 0,
    bySource,
    freeApply: stages["free_apply"] ?? 0,
    freeSent: stages["free_sent"] ?? 0,
    salesByCategory,
    salesTotal,
  };
}
