// Threadsツール設定（APIキー等はadmin以上のみ変更可。GETはキーをマスクして返す）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

async function getOrCreate() {
  const existing = await prisma.threadsToolSettings.findFirst();
  if (existing) return existing;
  return prisma.threadsToolSettings.create({ data: {} });
}

function mask(v: string): string {
  if (!v) return "";
  return v.length <= 6 ? "***" : `${"*".repeat(6)}${v.slice(-4)}`;
}

// GET /api/threads/settings
export async function GET() {
  try {
    const s = await getOrCreate();
    return NextResponse.json({
      apifyTokenMasked: mask(s.apifyToken),
      apifyActorId: s.apifyActorId,
      openaiApiKeyMasked: mask(s.openaiApiKey),
      scraperEnabled: s.scraperEnabled,
      metricsTiming: s.metricsTiming,
      updatedAt: s.updatedAt,
    });
  } catch (e) {
    console.error("GET /api/threads/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/threads/settings （admin以上）
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json();
    const s = await getOrCreate();
    const data: Record<string, unknown> = {};
    // キーは空文字なら「変更なし」、"CLEAR"で削除
    for (const key of ["apifyToken", "openaiApiKey"] as const) {
      if (typeof body[key] === "string" && body[key] !== "") {
        data[key] = body[key] === "CLEAR" ? "" : body[key];
      }
    }
    if (typeof body.apifyActorId === "string") data.apifyActorId = body.apifyActorId;
    if (typeof body.scraperEnabled === "boolean") data.scraperEnabled = body.scraperEnabled;
    if (typeof body.metricsTiming === "string") {
      try {
        const arr = JSON.parse(body.metricsTiming);
        if (Array.isArray(arr) && arr.every((n) => typeof n === "number" && n > 0)) {
          data.metricsTiming = body.metricsTiming;
        }
      } catch {
        // 不正な形式は無視
      }
    }
    await prisma.threadsToolSettings.update({ where: { id: s.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/threads/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
