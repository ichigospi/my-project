import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// Cookieの最短有効期限を解析
function parseCookieExpiry(cookieText: string): { earliest: Date | null; expiredCount: number; totalCount: number } {
  const lines = cookieText.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  let earliest: Date | null = null;
  let expiredCount = 0;
  const now = Date.now() / 1000;

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 5) {
      const expiry = parseInt(parts[4], 10);
      if (expiry > 0) {
        if (expiry < now) expiredCount++;
        const date = new Date(expiry * 1000);
        if (!earliest || date < earliest) earliest = date;
      }
    }
  }
  return { earliest, expiredCount, totalCount: lines.length };
}

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

  // 有効期限チェック
  const expiry = parseCookieExpiry(cookies);
  const now = new Date();
  let warning = "";
  if (expiry.earliest && expiry.earliest < now) {
    warning = "アップロードされたCookieは既に期限切れの可能性があります。YouTubeに再ログインしてからCookieを取得し直してください。";
  } else if (expiry.expiredCount > 0 && expiry.totalCount > 0 && expiry.expiredCount / expiry.totalCount > 0.5) {
    warning = "Cookieの半数以上が期限切れです。再取得をおすすめします。";
  }

  // アップロード日時も保存
  await prisma.appSetting.upsert({
    where: { key: "yt_cookies" },
    update: { value: cookies },
    create: { key: "yt_cookies", value: cookies },
  });
  await prisma.appSetting.upsert({
    where: { key: "yt_cookies_uploaded_at" },
    update: { value: now.toISOString() },
    create: { key: "yt_cookies_uploaded_at", value: now.toISOString() },
  });

  return NextResponse.json({
    ok: true,
    size: cookies.length,
    warning,
    expiresAt: expiry.earliest?.toISOString() || null,
    uploadedAt: now.toISOString(),
  });
}

// Cookie設定状況を確認
export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: "yt_cookies" } });
  const uploadedAt = await prisma.appSetting.findUnique({ where: { key: "yt_cookies_uploaded_at" } });

  let expiresAt: string | null = null;
  let isExpired = false;
  if (setting?.value) {
    const expiry = parseCookieExpiry(setting.value);
    expiresAt = expiry.earliest?.toISOString() || null;
    isExpired = !!expiry.earliest && expiry.earliest < new Date();
  }

  return NextResponse.json({
    hasCookies: !!setting?.value,
    size: setting?.value?.length || 0,
    uploadedAt: uploadedAt?.value || null,
    expiresAt,
    isExpired,
  });
}

// Cookie削除
export async function DELETE() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await prisma.appSetting.deleteMany({ where: { key: "yt_cookies" } });
  await prisma.appSetting.deleteMany({ where: { key: "yt_cookies_uploaded_at" } });
  return NextResponse.json({ ok: true });
}
