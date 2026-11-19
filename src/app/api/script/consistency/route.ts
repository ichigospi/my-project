import { NextRequest, NextResponse } from "next/server";
import { runConsistencyPass } from "@/lib/consistency";
import { buildTechniqueBrief } from "@/lib/tarot-norms";
import { loadCustomBans } from "@/lib/custom-bans";
import type { CardPlan } from "@/lib/project-store";

// 整合編集: 重複・矛盾・場所違い・AIっぽさだけを段落単位で直す（台本出力室のボタンから手動でも呼べる）
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aiApiKey = String(body.aiApiKey || "");
    const script = String(body.script || "");
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!script.trim()) return NextResponse.json({ error: "台本がありません" }, { status: 400 });
    const plan = (body.cardPlan || null) as CardPlan | null;
    const genre = String(body.genre || "");
    const { result, summary, error } = await runConsistencyPass(aiApiKey, body.aiModel, script, {
      backbone: plan?.backbone || null,
      cards: plan?.slots?.filter((sl) => sl.card).map((sl) => ({ name: sl.card!.name, orientation: sl.card!.orientation })) || [],
      techniqueBrief: buildTechniqueBrief(plan?.techniques, { genre }),
      customBans: await loadCustomBans().catch(() => []),
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ script: result.script, summary, applied: result.applied.length, rejected: result.rejected.length, changes: result.applied.map((a) => ({ index: a.index, reason: a.reason, before: a.before, after: a.after })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "整合編集に失敗しました" }, { status: 500 });
  }
}
