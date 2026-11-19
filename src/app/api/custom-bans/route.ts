import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { loadCustomBans, saveCustomBans, loadBanCandidates, saveBanCandidates } from "@/lib/custom-bans";

// 添削で育てる禁止表現の一覧と候補
// GET: { bans, candidates }
// POST: { action: "add", phrase, reason } / { action: "remove", phrase } / { action: "dismissCandidate", phrase }
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const [bans, candidates] = await Promise.all([loadCustomBans(), loadBanCandidates()]);
    return NextResponse.json({ bans, candidates });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json();
    const action = String(body.action || "");
    const phrase = String(body.phrase || "").replace(/\s+/g, "").trim();
    if (!phrase) return NextResponse.json({ error: "phrase が必要です" }, { status: 400 });
    if (action === "add") {
      const bans = await loadCustomBans();
      if (!bans.some((b) => b.phrase === phrase)) bans.unshift({ phrase, reason: String(body.reason || ""), addedAt: new Date().toISOString() });
      await saveCustomBans(bans.slice(0, 300));
      const candidates = (await loadBanCandidates()).filter((c) => c.phrase !== phrase);
      await saveBanCandidates(candidates);
      return NextResponse.json({ ok: true, bans, candidates });
    }
    if (action === "remove") {
      const bans = (await loadCustomBans()).filter((b) => b.phrase !== phrase);
      await saveCustomBans(bans);
      return NextResponse.json({ ok: true, bans });
    }
    if (action === "dismissCandidate") {
      const candidates = (await loadBanCandidates()).filter((c) => c.phrase !== phrase);
      await saveBanCandidates(candidates);
      return NextResponse.json({ ok: true, candidates });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
