import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { loadConfig, saveConfig, loadLog, getToken, fetchMembers } from "@/lib/chatwork-server";
import type { ChatworkConfig } from "@/lib/chatwork-rules";

// Chatwork通知ルールの読み書き
// GET: { config, migrated, log, hasToken }  POST: { config } で保存（オーナー・管理者のみ）
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const roomId = request.nextUrl.searchParams.get("members");
    if (roomId) {
      const token = await getToken();
      if (!token) return NextResponse.json({ error: "Chatworkのトークンが未設定です" }, { status: 400 });
      return NextResponse.json({ members: await fetchMembers(token, roomId) });
    }
    const [{ config, migrated }, log, token] = await Promise.all([loadConfig(), loadLog(), getToken()]);
    return NextResponse.json({ config, migrated, log, hasToken: !!token });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const c = body?.config as ChatworkConfig | undefined;
    if (!c || !Array.isArray(c.rules)) return NextResponse.json({ error: "config.rules が必要です" }, { status: 400 });
    const config: ChatworkConfig = {
      rules: c.rules.filter((r) => r && r.id && r.event && r.roomId).slice(0, 100),
      ownerAccountId: String(c.ownerAccountId || "").trim(),
      writers: (Array.isArray(c.writers) ? c.writers : []).filter((w) => w && /^\d+$/.test(String(w.accountId))).map((w) => ({ name: String(w.name || "").slice(0, 40), accountId: String(w.accountId) })),
      fallbackToAllWriters: c.fallbackToAllWriters !== false,
    };
    await saveConfig(config);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
