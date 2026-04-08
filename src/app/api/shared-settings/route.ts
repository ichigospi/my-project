import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 共有設定の取得
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const settings = await prisma.appSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    return NextResponse.json({
      yt_api_key: map["shared_yt_api_key"] || "",
      ai_api_key: map["shared_ai_api_key"] || "",
      channels: map["shared_channels"] ? JSON.parse(map["shared_channels"]) : [],
      hooks: map["shared_hooks"] ? JSON.parse(map["shared_hooks"]) : [],
      ctas: map["shared_ctas"] ? JSON.parse(map["shared_ctas"]) : [],
      thumbnailWords: map["shared_thumbnail_words"] ? JSON.parse(map["shared_thumbnail_words"]) : [],
      titles: map["shared_titles"] ? JSON.parse(map["shared_titles"]) : [],
      profile: map["shared_profile"] ? JSON.parse(map["shared_profile"]) : null,
      winningPatterns: map["shared_winning_patterns"] ? JSON.parse(map["shared_winning_patterns"]) : null,
      presets: map["shared_presets"] ? JSON.parse(map["shared_presets"]) : [],
    });
  } catch (e) {
    console.error("GET /api/shared-settings error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 共有設定の保存
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const updates: { key: string; value: string }[] = [];

    if (body.yt_api_key !== undefined) updates.push({ key: "shared_yt_api_key", value: body.yt_api_key });
    if (body.ai_api_key !== undefined) updates.push({ key: "shared_ai_api_key", value: body.ai_api_key });
    if (body.channels !== undefined) updates.push({ key: "shared_channels", value: JSON.stringify(body.channels) });
    if (body.hooks !== undefined) updates.push({ key: "shared_hooks", value: JSON.stringify(body.hooks) });
    if (body.ctas !== undefined) updates.push({ key: "shared_ctas", value: JSON.stringify(body.ctas) });
    if (body.thumbnailWords !== undefined) updates.push({ key: "shared_thumbnail_words", value: JSON.stringify(body.thumbnailWords) });
    if (body.titles !== undefined) updates.push({ key: "shared_titles", value: JSON.stringify(body.titles) });
    if (body.profile !== undefined) updates.push({ key: "shared_profile", value: JSON.stringify(body.profile) });
    if (body.winningPatterns !== undefined) updates.push({ key: "shared_winning_patterns", value: JSON.stringify(body.winningPatterns) });
    if (body.presets !== undefined) updates.push({ key: "shared_presets", value: JSON.stringify(body.presets) });

    for (const { key, value } of updates) {
      const existing = await prisma.appSetting.findUnique({ where: { key } });
      if (existing) {
        await prisma.appSetting.update({ where: { key }, data: { value } });
      } else {
        await prisma.appSetting.create({ data: { key, value } });
      }
    }

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (e) {
    console.error("POST /api/shared-settings error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
