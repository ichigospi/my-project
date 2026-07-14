import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { SALE_CATEGORIES } from "@/lib/domain";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId");

  const sales = await prisma.sale.findMany({
    where: {
      ...(from || to
        ? { occurredOn: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(accountId ? { accountId } : {}),
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 1000,
    include: { account: { select: { name: true, color: true } } },
  });
  return NextResponse.json({ sales });
}

export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { date, accountId, category, productName, amount, quantity, note, templateVersionId, launchId } =
    await req.json();
  if (!date || !accountId) {
    return NextResponse.json({ error: "日付とアカウントは必須です" }, { status: 400 });
  }
  if (!SALE_CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: "カテゴリが不正です" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "金額を入力してください" }, { status: 400 });
  }

  const sale = await prisma.sale.create({
    data: {
      accountId,
      category,
      productName: productName?.trim() || "",
      amount: Math.round(amountNum),
      quantity: Math.max(1, Number(quantity) || 1),
      occurredOn: date,
      note: note?.trim() || "",
      templateVersionId: templateVersionId || null,
      launchId: launchId || null,
    },
  });
  return NextResponse.json({ sale });
}
