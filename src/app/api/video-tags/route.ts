import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 動画検索のジャンルタグ（種別: タロット/その他、テーマ: 金運/総合/恋愛）の共有保存。
// AI判定・手動修正の結果を全端末で共有するため、AppSettingの独立キーに保存する
// （shared-settings本体に載せるとペイロードが肥大化するため分離）。

const KEY = "shared_video_tags";

export interface VideoTag {
  type?: "tarot" | "other";            // 種別（AI/手動判定の結果。ルール判定はクライアントで都度計算）
  theme?: "money" | "general" | "love"; // テーマ（AI/手動判定の結果）
  source: "ai" | "manual";              // 判定方法（manualはAI再判定で上書きしない）
  judgedAt: string;                     // 判定日時（ISO）
}

async function readTags(): Promise<Record<string, VideoTag>> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json({ tags: await readTags() });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const incoming = (body?.tags || {}) as Record<string, VideoTag>;
    if (typeof incoming !== "object") return NextResponse.json({ error: "tags が不正です" }, { status: 400 });

    const current = await readTags();
    // マージ規則: manual > ai。同じsource同士はjudgedAtが新しい方を採用
    for (const [videoId, tag] of Object.entries(incoming)) {
      if (!tag || typeof tag !== "object") continue;
      const prev = current[videoId];
      if (!prev) { current[videoId] = tag; continue; }
      if (prev.source === "manual" && tag.source !== "manual") continue;
      if (tag.source === "manual" && prev.source !== "manual") { current[videoId] = tag; continue; }
      if ((tag.judgedAt || "") >= (prev.judgedAt || "")) current[videoId] = tag;
    }

    const value = JSON.stringify(current);
    await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
    return NextResponse.json({ ok: true, count: Object.keys(current).length });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
