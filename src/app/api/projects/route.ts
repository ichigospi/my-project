import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// プロジェクト（台本）を1件=1ローで保存する専用エンドポイント。
// 旧 /api/shared-settings の `shared_projects` 巨大ブロブが原因の
// "Failed to fetch" を回避するため、プロジェクトはここで個別管理する。

const PROJECT_KEY_PREFIX = "shared_project_";
const LEGACY_BLOB_KEY = "shared_projects";
const PROJECT_HISTORY_PREFIX = "shared_project_history_";
const HISTORY_MAX = 8;

type ScriptTextField = "generatedScript" | "submittedScript" | "reviewedScript";
const TEXT_FIELDS: ScriptTextField[] = ["generatedScript", "submittedScript", "reviewedScript"];
interface ServerScriptSnapshot {
  at: string;                 // 退避した版の updatedAt
  savedAt: string;            // 退避した時刻（サーバー時刻）
  status?: string;
  scriptReviewStatus?: string;
  title?: string;
  generatedScript?: string;
  submittedScript?: string;
  reviewedScript?: string;
}

// 上書きで台本本文が消える・変わる前に、サーバー側にも旧版の本文を退避する（端末の履歴は容量不足で残らないことがある）
async function archivePreviousVersion(id: string, prev: Record<string, unknown>, next: Record<string, unknown>) {
  const snap: ServerScriptSnapshot = {
    at: String(prev.updatedAt || ""),
    savedAt: new Date().toISOString(),
    status: typeof prev.status === "string" ? prev.status : undefined,
    scriptReviewStatus: typeof prev.scriptReviewStatus === "string" ? prev.scriptReviewStatus : undefined,
    title: typeof prev.title === "string" ? prev.title : undefined,
  };
  let changed = false;
  for (const f of TEXT_FIELDS) {
    const pv = typeof prev[f] === "string" ? (prev[f] as string) : "";
    const nv = typeof next[f] === "string" ? (next[f] as string) : "";
    if (pv.trim() && pv !== nv) { snap[f] = pv; changed = true; }
  }
  if (!changed) return;
  const key = PROJECT_HISTORY_PREFIX + id;
  let list: ServerScriptSnapshot[] = [];
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (row?.value) { const parsed = JSON.parse(row.value); if (Array.isArray(parsed)) list = parsed; }
  } catch { list = []; }
  // 同じ本文の重複は保存しない
  const same = list.some((s) => TEXT_FIELDS.every((f) => (s[f] || "") === (snap[f] || "")));
  if (same) return;
  list.push(snap);
  list = list.slice(-HISTORY_MAX);
  const value = JSON.stringify(list);
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

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

    // serverTime: 端末の時計ズレ補正用（shared-sync が学習する）
    return NextResponse.json({ projects, serverTime: new Date().toISOString() });
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
    // 古い端末からの上書き防止: サーバーに保存されている版の updatedAt が、送られてきた版より新しい場合は
    // 上書きせずに stale として返す（例: 管理者が提出した直後に、オーナーの古い画面が push した場合）。
    // クライアントは stale を受け取ったら force pull して最新に追従する。
    const stale: { id: string; serverUpdatedAt: string }[] = [];
    let updated = 0;
    const getTime = (v: unknown) => {
      const ts = (v as { updatedAt?: string })?.updatedAt;
      const n = ts ? new Date(ts).getTime() : 0;
      return Number.isFinite(n) ? n : 0;
    };
    for (const p of projects) {
      const id = (p as { id?: string })?.id;
      if (!id) continue;
      const key = PROJECT_KEY_PREFIX + id;
      const value = JSON.stringify(p);
      try {
        const existing = await prisma.appSetting.findUnique({ where: { key } });
        if (existing?.value) {
          let serverObj: unknown = null;
          try { serverObj = JSON.parse(existing.value); } catch { serverObj = null; }
          const serverTime = getTime(serverObj);
          const incomingTime = getTime(p);
          if (serverTime > 0 && incomingTime > 0 && serverTime > incomingTime) {
            stale.push({ id, serverUpdatedAt: (serverObj as { updatedAt: string }).updatedAt });
            continue;
          }
          // 旧版の台本本文をサーバー側の履歴に退避（失敗しても保存自体は止めない）
          if (serverObj && typeof serverObj === "object") {
            try {
              await archivePreviousVersion(id, serverObj as Record<string, unknown>, p as Record<string, unknown>);
            } catch (e) {
              console.error(`POST /api/projects: history archive failed for "${id}"`, e);
            }
          }
        }
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
      stale,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error("POST /api/projects error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
