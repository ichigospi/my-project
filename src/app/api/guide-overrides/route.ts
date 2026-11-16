import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 台本ルール・ガイドのオーナー編集分（教育カードの文面・技カタログ項目の表示上書き・解説メモ）
const KEY = "guide_overrides";

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    let overrides: unknown = { education: {}, items: {} };
    try { if (row?.value) overrides = JSON.parse(row.value); } catch { /* keep default */ }
    return NextResponse.json({ overrides });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 編集はオーナー・管理者のみ
    const auth = await requireAuth("admin");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const o = (body as { overrides?: unknown }).overrides;
    if (!o || typeof o !== "object" || Array.isArray(o)) return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
    const value = JSON.stringify(o);
    if (value.length > 2_000_000) return NextResponse.json({ error: "サイズが大きすぎます" }, { status: 413 });
    await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
