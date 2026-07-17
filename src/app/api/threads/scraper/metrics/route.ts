// 自投稿の計測を今すぐ実行（手動トリガー）
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { collectOwnMetrics } from "@/lib/threads-collector";

export const maxDuration = 300;

export async function POST() {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const summary = await collectOwnMetrics();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("POST /api/threads/scraper/metrics", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
