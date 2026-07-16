// 競合投稿の構造分解 + 企画分類を（再）実行
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, resolveThreadsAiModel } from "@/lib/threads-ai";
import {
  CLASSIFY_SYSTEM,
  buildClassifyInstruction,
  type ClassifyResult,
} from "@/lib/threads-prompts";

// POST /api/threads/competitor-posts/classify
// Body: { postIds: string[], aiApiKey, model? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postIds, aiApiKey } = body as { postIds: string[]; aiApiKey: string };
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: "postIds は1件以上必須" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }

    const posts = await prisma.threadsCompetitorPost.findMany({
      where: { id: { in: postIds } },
    });
    if (posts.length === 0) {
      return NextResponse.json({ error: "対象投稿が見つかりません" }, { status: 404 });
    }

    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: CLASSIFY_SYSTEM,
      userInstruction: buildClassifyInstruction(posts),
      model: resolveThreadsAiModel(body.model),
      maxTokens: 8192,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: res.retryable ? 503 : 500 });
    }
    const results = extractJson<ClassifyResult[]>(res.text);
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ error: "分類結果をパースできませんでした" }, { status: 422 });
    }

    let updated = 0;
    for (const r of results) {
      const target = posts[r.index];
      if (!target) continue;
      await prisma.threadsCompetitorPost.update({
        where: { id: target.id },
        data: {
          planType: r.planType ?? "",
          hookType: r.hookType ?? "",
          structureJson: JSON.stringify({ ...r.structure, whyItWorks: r.whyItWorks }),
        },
      });
      updated++;
    }
    return NextResponse.json({ updated });
  } catch (e) {
    console.error("POST /api/threads/competitor-posts/classify", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
