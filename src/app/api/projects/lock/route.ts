import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 企画の「編集中ロック」（ゆるいロック）。
// - 開いた人の印をサーバーに付け、他の人が同じ企画を開いたら警告を出すための情報源。
// - 閲覧や保存を止めるものではない（閉じ忘れで詰まらないように、一定時間ハートビートが無ければ自動で消える）。
const PREFIX = "project_lock_";
const TTL_MS = 5 * 60 * 1000; // 5分操作が無ければ解除扱い

interface Lock { userId: string; userName: string; role: string; since: string; at: string }

async function readLock(id: string): Promise<Lock | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: PREFIX + id } });
  if (!row?.value) return null;
  try { return JSON.parse(row.value) as Lock; } catch { return null; }
}
const alive = (l: Lock | null): l is Lock => !!l && Date.now() - new Date(l.at).getTime() < TTL_MS;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const me = auth.session.user as { id?: string };
    const ids = (request.nextUrl.searchParams.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 300);
    const locks: Record<string, Lock> = {};
    if (ids.length > 0) {
      const rows = await prisma.appSetting.findMany({ where: { key: { in: ids.map((id) => PREFIX + id) } } });
      for (const r of rows) {
        try { const l = JSON.parse(r.value) as Lock; if (alive(l)) locks[r.key.slice(PREFIX.length)] = l; } catch { /* skip */ }
      }
    }
    return NextResponse.json({ locks, me: me.id || "" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const me = auth.session.user as { id?: string; name?: string; role?: string };
    const body = await request.json().catch(() => ({}));
    const id = String((body as { projectId?: string }).projectId || "").trim();
    const action = String((body as { action?: string }).action || "acquire");
    if (!id) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    const key = PREFIX + id;
    const existing = await readLock(id);
    const now = new Date().toISOString();
    const myId = me.id || "";

    if (action === "release") {
      if (existing && existing.userId === myId) await prisma.appSetting.deleteMany({ where: { key } });
      return NextResponse.json({ ok: true });
    }
    const canTakeover = me.role === "owner" || me.role === "admin";
    if (action === "takeover" && !canTakeover) return NextResponse.json({ error: "引き継ぎはオーナー・管理者のみできます" }, { status: 403 });

    // 他の人が編集中（期限内）なら、acquire/heartbeat は失敗として返す（画面側で警告を出す）
    if (alive(existing) && existing.userId !== myId && action !== "takeover") {
      return NextResponse.json({ ok: false, lockedBy: existing, me: myId });
    }
    const lock: Lock = {
      userId: myId, userName: me.name || "（不明）", role: me.role || "",
      since: alive(existing) && existing.userId === myId ? existing.since : now,
      at: now,
    };
    const value = JSON.stringify(lock);
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    return NextResponse.json({ ok: true, lock, me: myId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
