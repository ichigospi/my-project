// 顧客対応ツール設定（ペルソナ補正・文体・承認モード・事業情報）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { REPLY_SETTINGS_KEY, parseReplySettings, DEFAULT_REPLY_SETTINGS } from "@/lib/reply-prompts";

export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const row = await prisma.appSetting.findUnique({ where: { key: REPLY_SETTINGS_KEY } });
    return NextResponse.json(parseReplySettings(row?.value));
  } catch (e) {
    console.error("GET /api/reply/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const settings = { ...DEFAULT_REPLY_SETTINGS };
    for (const key of ["personaNote", "toneNote", "businessNote"] as const) {
      if (typeof body[key] === "string") settings[key] = body[key];
    }
    if (body.approvalMode === "direct" || body.approvalMode === "approval") {
      settings.approvalMode = body.approvalMode;
    }
    const value = JSON.stringify(settings);
    await prisma.appSetting.upsert({
      where: { key: REPLY_SETTINGS_KEY },
      update: { value },
      create: { key: REPLY_SETTINGS_KEY, value },
    });
    return NextResponse.json(settings);
  } catch (e) {
    console.error("PUT /api/reply/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
