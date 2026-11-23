import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { dispatch } from "@/lib/chatwork-server";
import { NOTIFY_EVENTS, type NotifyContext, type NotifyEvent } from "@/lib/chatwork-rules";

// イベントの配信: { event, context, onlyRuleId?, dryRun? } → 該当ルールを全部実行
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const event = String(body.event || "") as NotifyEvent;
    if (!NOTIFY_EVENTS.some((e) => e.id === event)) return NextResponse.json({ error: "event が不正です" }, { status: 400 });
    const ctx = (body.context || {}) as NotifyContext;
    const r = await dispatch(event, ctx, { onlyRuleId: body.onlyRuleId ? String(body.onlyRuleId) : undefined, dryRun: body.dryRun === true });
    return NextResponse.json({ ok: r.sent > 0 || !!r.skipped, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
