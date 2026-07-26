// 修正差分からのルール抽出: AI案とオーナーの最終文を比較し、ルール候補を提案する
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { callAI } from "@/lib/ai-helper";
import { buildLearnFromEditPrompt } from "@/lib/reply-prompts";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { draftId, aiApiKey } = body;
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });

    const draft = await prisma.replyDraft.findUnique({ where: { id: draftId } });
    if (!draft) return NextResponse.json({ error: "ドラフトが見つかりません" }, { status: 404 });
    if (!draft.finalReply.trim() || draft.finalReply.trim() === draft.draft.trim()) {
      return NextResponse.json({ error: "修正された最終文がありません（AI案のままです）" }, { status: 400 });
    }

    const prompt = buildLearnFromEditPrompt({
      customerMessage: draft.customerMessage,
      aiDraft: draft.draft,
      finalReply: draft.finalReply,
    });

    const res = await callAI(aiApiKey, prompt, { maxTokens: 2048 });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: 500 });
    }

    const cleaned = res.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "AIの応答をパースできませんでした", retryable: true }, { status: 500 });
    }

    const proposals = JSON.parse(match[0]) as {
      category?: string;
      title?: string;
      situation?: string;
      guideline?: string;
    }[];

    return NextResponse.json({
      proposals: proposals
        .filter((p) => p.title && p.guideline)
        .map((p) => ({
          category: p.category || "general",
          title: p.title || "",
          situation: p.situation || "",
          guideline: p.guideline || "",
        })),
    });
  } catch (e) {
    console.error("POST /api/reply/learn", e);
    return NextResponse.json({ error: String(e), retryable: true }, { status: 500 });
  }
}
