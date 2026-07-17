// 競合の収集を今すぐ実行（手動トリガー）
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { collectCompetitorPosts } from "@/lib/threads-collector";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json().catch(() => ({}));
    const summary = await collectCompetitorPosts({
      accountId: body.accountId || undefined,
      competitorId: body.competitorId || undefined,
    });
    return NextResponse.json(summary);
  } catch (e) {
    console.error("POST /api/threads/scraper/collect", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
