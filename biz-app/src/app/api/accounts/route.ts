import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const accounts = await prisma.account.findMany({
    where: { archived: false },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "アカウント名を入力してください" }, { status: 400 });
  }

  const max = await prisma.account.aggregate({ _max: { sortOrder: true } });
  const account = await prisma.account.create({
    data: {
      name: name.trim(),
      color: color || "#8b5cf6",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ account });
}
