// あるある集（ReplyScenario）の一覧取得・作成・初期セット投入
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { SCENARIO_SEEDS } from "@/lib/reply-scenarios-seed";

export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const scenarios = await prisma.replyScenario.findMany({
      where: { isActive: true },
      orderBy: [{ stage: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(scenarios);
  } catch (e) {
    console.error("GET /api/reply/scenarios", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST { seed: true } で初期セット投入（既に同タイトルがあるものはスキップ）
// POST { stage, category, title, ... } で1件追加
export async function POST(request: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();

    if (body.seed) {
      const existing = await prisma.replyScenario.findMany({ select: { title: true } });
      const existingTitles = new Set(existing.map((s) => s.title));
      const toAdd = SCENARIO_SEEDS.filter((s) => !existingTitles.has(s.title));
      for (const s of toAdd) {
        await prisma.replyScenario.create({ data: { ...s, source: "builtin" } });
      }
      return NextResponse.json({ added: toAdd.length, skipped: SCENARIO_SEEDS.length - toAdd.length });
    }

    const { stage = "other", category = "general", title, detail = "", explanation = "", exampleMessage } = body;
    if (!title || !exampleMessage) {
      return NextResponse.json({ error: "title と exampleMessage は必須です" }, { status: 400 });
    }
    const scenario = await prisma.replyScenario.create({
      data: { stage, category, title, detail, explanation, exampleMessage, source: "manual" },
    });
    return NextResponse.json(scenario);
  } catch (e) {
    console.error("POST /api/reply/scenarios", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
