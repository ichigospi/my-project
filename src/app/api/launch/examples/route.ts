import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 実例集を取得
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const examples = await prisma.launchExample.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ examples });
}

// 実例を削除
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }

  await prisma.launchExample.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
