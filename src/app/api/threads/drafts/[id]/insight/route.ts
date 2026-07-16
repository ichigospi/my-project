// AI考察の下書き生成（実績数値 vs オマージュ元の比較）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, resolveThreadsAiModel } from "@/lib/threads-ai";
import { INSIGHT_SYSTEM, buildInsightInstruction } from "@/lib/threads-prompts";
import { parseRefSnapshot } from "@/lib/threads-server";

// POST /api/threads/drafts/:id/insight
// Body: { aiApiKey, model? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }
    const draft = await prisma.threadsPostDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: "投稿案が見つかりません" }, { status: 404 });
    }

    const res = await callThreadsAI(body.aiApiKey, {
      systemPrompt: INSIGHT_SYSTEM,
      userInstruction: buildInsightInstruction({
        content: draft.content,
        metrics: { views: draft.views, likes: draft.likes, replies: draft.replies, reposts: draft.reposts },
        refA: parseRefSnapshot(draft.refASnapshot),
        refB: parseRefSnapshot(draft.refBSnapshot),
      }),
      model: resolveThreadsAiModel(body.model),
      maxTokens: 1024,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: res.retryable ? 503 : 500 });
    }
    return NextResponse.json({ insight: res.text.trim() });
  } catch (e) {
    console.error("POST /api/threads/drafts/[id]/insight", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
