import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getScriptBanks } from "@/lib/tarot-draw";

// 台本ガイド（/presets）の技カタログ用: サーバー抽選バンクの一覧を返す。
// コード内の定数が唯一のソースなので、ツールを更新すればガイドも自動で最新になる。
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json({ banks: getScriptBanks() });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
