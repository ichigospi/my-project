// 投稿案の壁打ちチャット
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, resolveThreadsAiModel } from "@/lib/threads-ai";
import { buildChatSystemPrompt } from "@/lib/threads-prompts";
import { parseRefSnapshot } from "@/lib/threads-server";

// GET /api/threads/drafts/:id/chat （履歴取得）
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const messages = await prisma.threadsChatMessage.findMany({
      where: { draftId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(messages);
  } catch (e) {
    console.error("GET /api/threads/drafts/[id]/chat", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/threads/drafts/:id/chat
// Body: { message, aiApiKey, model? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, aiApiKey } = body as { message: string; aiApiKey: string };
    if (!message?.trim()) {
      return NextResponse.json({ error: "message は必須" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }

    const draft = await prisma.threadsPostDraft.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: "投稿案が見つかりません" }, { status: 404 });
    }

    // 直近の履歴（最大20件）+ 今回のメッセージ
    const history = await prisma.threadsChatMessage.findMany({
      where: { draftId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const messages = history
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    messages.push({ role: "user", content: message });

    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: buildChatSystemPrompt({
        draftContent: draft.content,
        refA: parseRefSnapshot(draft.refASnapshot),
        refB: parseRefSnapshot(draft.refBSnapshot),
      }),
      messages,
      model: resolveThreadsAiModel(body.model),
      maxTokens: 4096,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: res.retryable ? 503 : 500 });
    }

    // ユーザー発言とAI返答を保存
    await prisma.threadsChatMessage.create({
      data: { draftId: id, role: "user", content: message },
    });
    const assistant = await prisma.threadsChatMessage.create({
      data: { draftId: id, role: "assistant", content: res.text },
    });
    return NextResponse.json(assistant);
  } catch (e) {
    console.error("POST /api/threads/drafts/[id]/chat", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
