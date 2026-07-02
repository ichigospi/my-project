import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import type { UsageDay } from "@/lib/usage-tracker";

// AI API使用量の取得。ai_usage_YYYY-MM-DD キーを全件返す（1日1行の小さなJSONなので軽い）
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rows: { key: string; value: string }[] = await prisma.appSetting.findMany({ where: { key: { startsWith: "ai_usage_" } } });
    const days = rows
      .map((r: { key: string; value: string }) => {
        let models: UsageDay = {};
        try { models = JSON.parse(r.value); } catch { models = {}; }
        return { date: r.key.replace("ai_usage_", ""), models };
      })
      .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date));
    return NextResponse.json({ days });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "使用量の取得に失敗しました" }, { status: 500 });
  }
}
