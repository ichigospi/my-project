import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { TEMPLATE_TYPES } from "@/lib/domain";

// テンプレ一覧（バージョン別成績つき）
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [templates, sendGroups, saleGroups] = await Promise.all([
    prisma.template.findMany({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
      include: {
        account: { select: { name: true, color: true } },
        versions: { orderBy: { activeFrom: "asc" } },
      },
    }),
    prisma.funnelEvent.groupBy({
      by: ["templateVersionId"],
      where: { templateVersionId: { not: null } },
      _sum: { count: true },
    }),
    prisma.sale.groupBy({
      by: ["templateVersionId", "category"],
      where: { templateVersionId: { not: null } },
      _sum: { amount: true, quantity: true },
    }),
  ]);

  const sendsByVersion: Record<string, number> = {};
  for (const g of sendGroups) {
    if (g.templateVersionId) sendsByVersion[g.templateVersionId] = g._sum.count ?? 0;
  }

  const salesByVersion: Record<string, Record<string, { amount: number; quantity: number }>> = {};
  for (const g of saleGroups) {
    if (!g.templateVersionId) continue;
    salesByVersion[g.templateVersionId] ??= {};
    salesByVersion[g.templateVersionId][g.category] = {
      amount: g._sum.amount ?? 0,
      quantity: g._sum.quantity ?? 0,
    };
  }

  const result = templates.map((t) => ({
    ...t,
    versions: t.versions.map((v) => {
      const byCategory = salesByVersion[v.id] ?? {};
      const salesTotal = Object.values(byCategory).reduce((s, x) => s + x.amount, 0);
      return {
        ...v,
        stats: { sends: sendsByVersion[v.id] ?? 0, salesByCategory: byCategory, salesTotal },
      };
    }),
  }));

  return NextResponse.json({ templates: result });
}

export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { accountId, type, name, content, label } = await req.json();
  if (!accountId || !name?.trim()) {
    return NextResponse.json({ error: "アカウントとテンプレ名は必須です" }, { status: 400 });
  }
  if (!TEMPLATE_TYPES.some((t) => t.key === type)) {
    return NextResponse.json({ error: "種類が不正です" }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      accountId,
      type,
      name: name.trim(),
      versions: {
        create: { label: label?.trim() || "v1", content: content ?? "" },
      },
    },
    include: { versions: true },
  });

  return NextResponse.json({ template });
}
