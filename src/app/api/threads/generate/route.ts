// オマージュ投稿の生成（参考A/B + ライブラリ差し替え + アカウント情報を注入）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, resolveThreadsAiModel } from "@/lib/threads-ai";
import {
  HOMAGE_SYSTEM,
  buildHomageInstruction,
  checkCopySimilarity,
  type HomageCandidate,
  type HomageMode,
  type LibraryItemInput,
} from "@/lib/threads-prompts";
import { buildRefSnapshot, loadAccountKnowledgeContext } from "@/lib/threads-server";

// POST /api/threads/generate
// Body: { accountId, refAPostId, refBPostId?, mode, modeInstruction?, libraryItemIds?, extraInstruction?, count?, aiApiKey, model? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, refAPostId, refBPostId, aiApiKey } = body as {
      accountId: string;
      refAPostId: string;
      refBPostId?: string;
      aiApiKey: string;
    };
    if (!accountId || !refAPostId) {
      return NextResponse.json({ error: "accountId と refAPostId は必須" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }

    const [knowledgeContext, refA, refB] = await Promise.all([
      loadAccountKnowledgeContext(accountId),
      buildRefSnapshot(refAPostId),
      refBPostId ? buildRefSnapshot(refBPostId) : Promise.resolve(null),
    ]);
    if (!knowledgeContext) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }
    if (!refA) {
      return NextResponse.json({ error: "参考投稿Aが見つかりません" }, { status: 404 });
    }

    // ライブラリ差し替え
    let libraryItems: LibraryItemInput[] = [];
    const libraryItemIds = (body.libraryItemIds ?? []) as string[];
    if (libraryItemIds.length > 0) {
      const items = await prisma.threadsLibraryItem.findMany({
        where: { id: { in: libraryItemIds } },
      });
      libraryItems = items.map((i) => ({
        type: i.type as LibraryItemInput["type"],
        title: i.title,
        content: i.content,
      }));
      // 使用回数をカウント
      await prisma.threadsLibraryItem.updateMany({
        where: { id: { in: libraryItemIds } },
        data: { useCount: { increment: 1 } },
      });
    }

    const mode = (["single", "hybrid", "custom"].includes(body.mode) ? body.mode : "single") as HomageMode;
    const count = Math.min(5, Math.max(1, Number(body.count ?? 3)));
    const model = resolveThreadsAiModel(body.model);

    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: HOMAGE_SYSTEM,
      knowledgeContext,
      userInstruction: buildHomageInstruction({
        refA,
        refB,
        mode,
        modeInstruction: body.modeInstruction,
        libraryItems,
        extraInstruction: body.extraInstruction,
        count,
      }),
      model,
      maxTokens: 8192,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: res.retryable ? 503 : 500 });
    }
    const parsed = extractJson<{ candidates: HomageCandidate[] }>(res.text);
    if (!parsed?.candidates || parsed.candidates.length === 0) {
      return NextResponse.json({ error: "生成結果をパースできませんでした。再実行してください" }, { status: 422 });
    }

    // 類似度チェック（完コピ検出）
    const candidates = parsed.candidates.map((c) => {
      const simA = checkCopySimilarity(c.content, refA.content);
      const simB = refB ? checkCopySimilarity(c.content, refB.content) : null;
      return { ...c, similarity: { refA: simA, refB: simB } };
    });

    return NextResponse.json({
      candidates,
      refA,
      refB,
      generationMeta: {
        mode,
        modeInstruction: body.modeInstruction ?? "",
        libraryItemIds,
        extraInstruction: body.extraInstruction ?? "",
        model,
      },
      usage: res.usage,
    });
  } catch (e) {
    console.error("POST /api/threads/generate", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
