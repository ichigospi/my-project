import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// サーバー上の台本を「本文が残っているか」まで含めて調べる（消えた台本の復元用）。
//   GET /api/projects/inspect?q=タイトルの一部   → 一致する企画の一覧（本文の文字数・サーバー履歴の件数つき）
//   GET /api/projects/inspect?id=<企画ID>       → その企画の全文（現在の版）とサーバー履歴の全文
const PROJECT_KEY_PREFIX = "shared_project_";
const PROJECT_HISTORY_PREFIX = "shared_project_history_";

type Snap = { at: string; savedAt: string; status?: string; scriptReviewStatus?: string; title?: string; generatedScript?: string; submittedScript?: string; reviewedScript?: string };
const len = (v: unknown) => (typeof v === "string" ? v.length : 0);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const sp = request.nextUrl.searchParams;
    const id = (sp.get("id") || "").trim();
    const q = (sp.get("q") || "").trim().toLowerCase();

    if (id) {
      const row = await prisma.appSetting.findUnique({ where: { key: PROJECT_KEY_PREFIX + id } });
      const hist = await prisma.appSetting.findUnique({ where: { key: PROJECT_HISTORY_PREFIX + id } });
      let project: unknown = null;
      let history: Snap[] = [];
      try { project = row?.value ? JSON.parse(row.value) : null; } catch { project = null; }
      try { const h = hist?.value ? JSON.parse(hist.value) : []; if (Array.isArray(h)) history = h; } catch { history = []; }
      return NextResponse.json({ project, history: history.slice().reverse() });
    }

    const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: PROJECT_KEY_PREFIX } } });
    const histRows = rows.filter((r) => r.key.startsWith(PROJECT_HISTORY_PREFIX));
    const histCount = new Map<string, number>();
    for (const r of histRows) {
      try { const h = JSON.parse(r.value); histCount.set(r.key.slice(PROJECT_HISTORY_PREFIX.length), Array.isArray(h) ? h.length : 0); } catch { /* skip */ }
    }
    const items: Record<string, unknown>[] = [];
    for (const r of rows) {
      if (r.key.startsWith(PROJECT_HISTORY_PREFIX)) continue;
      let p: Record<string, unknown> | null = null;
      try { p = JSON.parse(r.value); } catch { continue; }
      if (!p || typeof p !== "object") continue;
      const title = String(p.title || "");
      const refTitle = Array.isArray(p.referenceVideos) && p.referenceVideos[0] ? String((p.referenceVideos[0] as { title?: string }).title || "") : "";
      if (q && !title.toLowerCase().includes(q) && !refTitle.toLowerCase().includes(q) && String(p.id || "") !== q) continue;
      // 台本の手前の成果物（分析・構成提案・骨組み・抽選結果）が残っているか。
      // 台本本文が無くても、これらが残っていれば同じ抽選・同じ骨組みで再生成できる
      const analysisIds = Array.isArray(p.analyses) ? (p.analyses as unknown[]).filter((x) => typeof x === "string") as string[] : [];
      let analysesOnServer = 0;
      if (analysisIds.length > 0) {
        try {
          analysesOnServer = await prisma.scriptAnalysis.count({ where: { id: { in: analysisIds } } });
        } catch { analysesOnServer = -1; }
      }
      const sp = p.structureProposal as Record<string, unknown> | null | undefined;
      items.push({
        id: p.id,
        title,
        refTitle,
        analysisIds: analysisIds.length,
        analysesOnServer,
        hasProposal: !!(sp && typeof sp === "object" && Object.keys(sp).length > 0),
        abstractLen: len(p.abstractLogic),
        cardPlanSlots: p.cardPlan && Array.isArray((p.cardPlan as { slots?: unknown[] }).slots) ? ((p.cardPlan as { slots: unknown[] }).slots.length) : 0,
        hasDrawSpec: len(p.drawSpec) > 0,
        channelId: p.channelId || "",
        status: p.status,
        scriptReviewStatus: p.scriptReviewStatus || "",
        updatedAt: p.updatedAt || "",
        generatedLen: len(p.generatedScript),
        submittedLen: len(p.submittedScript),
        reviewedLen: len(p.reviewedScript),
        segments: Array.isArray(p.scriptSegments) ? p.scriptSegments.length : 0,
        historyCount: histCount.get(String(p.id || "")) || 0,
        size: r.value.length,
      });
    }
    items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return NextResponse.json({ items: items.slice(0, 100), total: items.length, serverTime: new Date().toISOString() });
  } catch (e) {
    console.error("GET /api/projects/inspect error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
