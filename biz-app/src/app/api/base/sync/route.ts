import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getSetting } from "@/lib/settings";
import { getBaseConfig, syncBaseOrders } from "@/lib/base";

// BASE注文の同期。ifStale=true ならダッシュボード表示時の自動同期（1時間以内に同期済みならスキップ）
export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { ifStale } = await req.json().catch(() => ({ ifStale: false }));

  const config = await getBaseConfig();
  if (!config.connected) {
    return NextResponse.json({ ok: false, skipped: true, message: "BASE未接続" });
  }

  if (ifStale) {
    const last = await getSetting("base_last_sync_at");
    if (last && Date.now() - new Date(last).getTime() < 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, message: "同期済み（1時間以内）" });
    }
  }

  const url = new URL(req.url);
  const result = await syncBaseOrders(`${url.origin}/api/base/callback`);
  return NextResponse.json(result);
}
