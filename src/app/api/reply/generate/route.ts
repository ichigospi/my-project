// 返信ドラフト生成: 分類 → エスカレーション判定 → ルール・類似実例を注入して返信案を作成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { callAI } from "@/lib/ai-helper";
import { calcSimilarity } from "@/lib/similarity";
import {
  REPLY_SETTINGS_KEY,
  parseReplySettings,
  buildReplySystemPrompt,
  buildReplyUserMessage,
  parseReplyResult,
} from "@/lib/reply-prompts";

const MAX_EXAMPLES = 6;

export async function POST(request: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { customerMessage, customerName = "", context = "", aiApiKey } = body;
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
    if (!customerMessage?.trim()) {
      return NextResponse.json({ error: "お客様のメッセージを入力してください" }, { status: 400 });
    }

    const [settingsRow, policies, allExamples] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: REPLY_SETTINGS_KEY } }),
      prisma.replyPolicy.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
      prisma.replyExample.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    ]);
    const settings = parseReplySettings(settingsRow?.value);

    // 類似実例を選出（類似度上位。ヒットが少なければ新しい実例で補完）
    const scored = allExamples
      .map((e) => ({ e, score: calcSimilarity(customerMessage, e.customerMessage) }))
      .sort((a, b) => b.score - a.score);
    const picked = scored.filter((s) => s.score > 0.05).slice(0, MAX_EXAMPLES).map((s) => s.e);
    for (const s of scored) {
      if (picked.length >= MAX_EXAMPLES) break;
      if (!picked.includes(s.e)) picked.push(s.e);
    }

    // 同じお客様との過去のやりとり（送信済みのもの）を文脈として注入
    const pastReplies = customerName.trim()
      ? (
          await prisma.replyDraft.findMany({
            where: {
              customerName: customerName.trim(),
              status: { in: ["approved", "sent"] },
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          })
        )
          .reverse()
          .map((d) => ({ customerMessage: d.customerMessage, reply: d.finalReply || d.draft }))
      : [];

    const system = buildReplySystemPrompt(settings, policies);
    const userMessage = buildReplyUserMessage({
      customerMessage,
      customerName,
      context,
      examples: picked,
      pastReplies,
    });

    const res = await callAI(aiApiKey, userMessage, { system, maxTokens: 4096 });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: 500 });
    }

    const result = parseReplyResult(res.text);
    if (!result) {
      return NextResponse.json({ error: "AIの応答をパースできませんでした", retryable: true }, { status: 500 });
    }

    // ステータス: エスカレーション > 承認モード > 直接送信可
    const status = result.isEscalation
      ? "escalated"
      : settings.approvalMode === "approval"
        ? "pending_approval"
        : "draft";

    const draft = await prisma.replyDraft.create({
      data: {
        customerName: customerName.trim(),
        customerMessage,
        context,
        category: result.category,
        isEscalation: result.isEscalation,
        escalationReason: result.escalationReason,
        confidence: result.confidence,
        reasoning: result.reasoning,
        usedPolicyIds: JSON.stringify(result.usedPolicyIds),
        usedExampleIds: JSON.stringify(result.usedExampleIds),
        draft: result.draft,
        status,
        createdByName: auth.session?.user?.name || "",
      },
    });

    // 根拠表示用に、参照されたルール・実例の中身も返す
    const usedPolicies = policies.filter((p) => result.usedPolicyIds.includes(p.id));
    const usedExamples = picked.filter((e) => result.usedExampleIds.includes(e.id));

    return NextResponse.json({ draft, usedPolicies, usedExamples, approvalMode: settings.approvalMode });
  } catch (e) {
    console.error("POST /api/reply/generate", e);
    return NextResponse.json({ error: String(e), retryable: true }, { status: 500 });
  }
}
