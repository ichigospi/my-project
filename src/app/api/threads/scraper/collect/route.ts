// 競合の収集（手動トリガー）
// 502対策で2フェーズに分離: phase="start" で起動して即返す → phase="ingest" で完了確認＆取込
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { collectCompetitorPosts, startCollectRun, ingestCollectRun } from "@/lib/threads-collector";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json().catch(() => ({}));
    const phase = body.phase as string | undefined;

    // 起動フェーズ: Apifyのrunを開始してrunIdを返す（数秒で終わる）
    if (phase === "start") {
      const res = await startCollectRun({
        accountId: body.accountId || undefined,
        competitorId: body.competitorId || undefined,
      });
      return NextResponse.json(res);
    }

    // 取込フェーズ: 実行状況を確認し、完了していれば取込む（RUNNINGなら即返す）
    if (phase === "ingest") {
      if (!body.runId) {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
      }
      const res = await ingestCollectRun({
        runId: body.runId,
        datasetId: body.datasetId || undefined,
        accountId: body.accountId || undefined,
        competitorId: body.competitorId || undefined,
      });
      return NextResponse.json(res);
    }

    // 後方互換: phase未指定は従来どおり同期実行（スケジューラ・旧クライアント用）
    const summary = await collectCompetitorPosts({
      accountId: body.accountId || undefined,
      competitorId: body.competitorId || undefined,
    });
    return NextResponse.json(summary);
  } catch (e) {
    console.error("POST /api/threads/scraper/collect", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
