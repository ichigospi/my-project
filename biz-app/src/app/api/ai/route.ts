import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { runAnalysis } from "@/lib/ai";
import { getSetting, setSetting } from "@/lib/settings";

// レポート一覧 + APIキー設定状態
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [reports, apiKey] = await Promise.all([
    prisma.aiReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, content: true, feedback: true },
    }),
    getSetting("ai_api_key"),
  ]);

  return NextResponse.json({
    reports,
    hasApiKey: !!(apiKey || process.env.ANTHROPIC_API_KEY),
  });
}

// 分析を実行してレポートを保存
export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));

  // APIキーの保存（管理者のみ）
  if (body.apiKey !== undefined) {
    const adminAuth = await requireAuth("admin");
    if ("error" in adminAuth) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
    }
    await setSetting("ai_api_key", String(body.apiKey).trim());
    return NextResponse.json({ ok: true });
  }

  const result = await runAnalysis();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const report = await prisma.aiReport.create({
    data: {
      scope: "all",
      input: result.input ?? "",
      content: result.content ?? "",
    },
  });

  return NextResponse.json({ report: { id: report.id, createdAt: report.createdAt, content: report.content, feedback: "" } });
}
