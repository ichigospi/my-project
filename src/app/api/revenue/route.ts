import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAmount } from "@/lib/revenue";

const TYPES = ["income", "expense"];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 一覧取得（from/to、または year/month で期間指定。指定なしは全期間）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    let from = searchParams.get("from");
    let to = searchParams.get("to");

    if (!from && !to && year && month) {
      const y = Number(year);
      const m = Number(month);
      from = `${y}-${String(m).padStart(2, "0")}-01`;
      to = lastDayOfMonth(y, m);
    }

    const where =
      from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {};

    const entries = await prisma.revenueEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(entries);
  } catch (e) {
    console.error("GET /api/revenue error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, type, amount, label, category, memo } = body;

    if (!date || amount === undefined || amount === null || amount === "") {
      return NextResponse.json({ error: "date と amount は必須です" }, { status: 400 });
    }
    const amt = parseAmount(amount);
    if (!Number.isFinite(amt)) {
      return NextResponse.json({ error: "amount が数値ではありません" }, { status: 400 });
    }

    const entry = await prisma.revenueEntry.create({
      data: {
        date,
        type: TYPES.includes(type) ? type : "income",
        amount: amt,
        label: label || "",
        category: category || "",
        memo: memo || "",
      },
    });

    return NextResponse.json(entry);
  } catch (e) {
    console.error("POST /api/revenue error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (rest.date !== undefined) data.date = rest.date;
    if (rest.type !== undefined) data.type = TYPES.includes(rest.type) ? rest.type : "income";
    if (rest.amount !== undefined) {
      const amt = parseAmount(rest.amount);
      if (!Number.isFinite(amt)) {
        return NextResponse.json({ error: "amount が数値ではありません" }, { status: 400 });
      }
      data.amount = amt;
    }
    if (rest.label !== undefined) data.label = rest.label;
    if (rest.category !== undefined) data.category = rest.category;
    if (rest.memo !== undefined) data.memo = rest.memo;

    const entry = await prisma.revenueEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch (e) {
    console.error("PUT /api/revenue error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

    await prisma.revenueEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/revenue error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
