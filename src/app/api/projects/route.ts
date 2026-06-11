import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// プロジェクト（台本）を1件=1ローで保存する専用エンドポイント。
// 旧 /api/shared-settings の `shared_projects` 巨大ブロブが原因の
// "Failed to fetch" を回避するため、プロジェクトはここで個別管理する。

const PROJECT_KEY_PREFIX = "shared_project_";
const LEGACY_BLOB_KEY = "shared_projects";

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rows = await prisma.appSetting.findMany({
      where: { key: { startsWith: PROJECT_KEY_PREFIX } },
    });
    const projects: unknown[] = [];
    for (const row of rows) {
      try { projects.push(JSON.parse(row.value)); } catch { /* skip corrupt row */ }
    }

    // 旧形式（巨大ブロブ）の互換: まだ移行されていない環境のため読み込んで合流
    try {
      const legacy = await prisma.appSetting.findUnique({ where: { key: LEGACY_BLOB_KEY } });
      if (legacy?.value) {
        const legacyArr = JSON.parse(legacy.value);
        if (Array.isArray(legacyArr)) {
          const seen = new Set(projects.map((p) => (p as { id?: string })?.id).filter(Boolean));
          for (const p of legacyArr) {
            const id = (p as { id?: string })?.id;
            if (id && !seen.has(id)) projects.push(p);
          }
        }
      }
    } catch (e) {
      // 旧ブロブが読めなくても新エンドポイントの動作には影響しない
      console.error("GET /api/projects: legacy blob read failed", e);
    }

    return NextResponse.json({ projects });
  } catch (e) {
    console.error("GET /api/projects error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const projects = (body as { projects?: unknown[] }).projects;
    if (!Array.isArray(projects)) {
      return NextResponse.json({ error: "projects must be an array" }, { status: 400 });
    }

    const failed: { id: string; size: number; error: string }[] = [];
    let updated = 0;
    for (const p of projects) {
      const id = (p as { id?: string })?.id;
      if (!id) continue;
      const key = PROJECT_KEY_PREFIX + id;
      const value = JSON.stringify(p);
      try {
        await prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        updated++;
      } catch (e) {
        console.error(`POST /api/projects: id "${id}" failed (size=${value.length})`, e);
        failed.push({ id, size: value.length, error: String(e).slice(0, 200) });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      updated,
      failed,
    });
  } catch (e) {
    console.error("POST /api/projects error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
