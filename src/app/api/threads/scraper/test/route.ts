// Apify接続テスト（保存済みトークンで /users/me を叩く）
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { testApifyConnection, DEFAULT_ACTOR_ID } from "@/lib/threads-scraper";

export async function POST() {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const settings = await prisma.threadsToolSettings.findFirst();
    if (!settings?.apifyToken) {
      return NextResponse.json({ error: "Apifyトークンが未登録です。上の欄で保存してください" }, { status: 400 });
    }
    const result = await testApifyConnection(settings.apifyToken);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      username: result.username,
      plan: result.plan,
      actorId: settings.apifyActorId || DEFAULT_ACTOR_ID,
    });
  } catch (e) {
    console.error("POST /api/threads/scraper/test", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
