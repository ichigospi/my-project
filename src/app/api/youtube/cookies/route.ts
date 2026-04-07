import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// Cookieファイルをアップロード（DB保存）
export async function POST(req: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { cookies } = body;
  if (!cookies || typeof cookies !== "string") {
    return NextResponse.json({ error: "Cookieデータが必要です" }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { key: "yt_cookies" },
    update: { value: cookies },
    create: { key: "yt_cookies", value: cookies },
  });

  return NextResponse.json({ ok: true, size: cookies.length });
}

// Cookie設定状況を確認
export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: "yt_cookies" } });
  return NextResponse.json({
    hasCookies: !!setting?.value,
    size: setting?.value?.length || 0,
  });
}

// Cookie削除
export async function DELETE() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await prisma.appSetting.deleteMany({ where: { key: "yt_cookies" } });
  return NextResponse.json({ ok: true });
}
