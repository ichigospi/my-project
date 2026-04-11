import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 一覧取得（月別フィルタ対応）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    let where = {};
    if (year && month) {
      const m = month.padStart(2, "0");
      where = {
        date: {
          gte: `${year}-${m}-01`,
          lte: `${year}-${m}-31`,
        },
      };
    }

    const records = await prisma.salesRecord.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(records);
  } catch (e) {
    console.error("GET /api/sales error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 新規作成
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { date, description, amount, balance, category, note } = body;

    if (!date || !description || amount === undefined || balance === undefined) {
      return NextResponse.json({ error: "date, description, amount, balance は必須です" }, { status: 400 });
    }

    const record = await prisma.salesRecord.create({
      data: {
        date,
        description,
        amount: Number(amount),
        balance: Number(balance),
        category: category || "other",
        note: note || "",
      },
    });

    return NextResponse.json(record);
  } catch (e) {
    console.error("POST /api/sales error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 更新
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

    if (data.amount !== undefined) data.amount = Number(data.amount);
    if (data.balance !== undefined) data.balance = Number(data.balance);

    const record = await prisma.salesRecord.update({
      where: { id },
      data,
    });

    return NextResponse.json(record);
  } catch (e) {
    console.error("PUT /api/sales error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

    await prisma.salesRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sales error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
