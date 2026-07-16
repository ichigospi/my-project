// 貼り付けテキストをAIでパースして競合投稿として一括登録 → 続けて自動分類
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, parseDataUrlImage, resolveThreadsAiModel, type ThreadsAiImage } from "@/lib/threads-ai";
import {
  PASTE_PARSE_SYSTEM,
  CLASSIFY_SYSTEM,
  buildPasteParseInstruction,
  buildClassifyInstruction,
  type ParsedPastePost,
  type ClassifyResult,
} from "@/lib/threads-prompts";

// POST /api/threads/competitor-posts/parse
// Body: { competitorId, raw?, images?: string[](data URL), aiApiKey, model?, autoClassify? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitorId, raw, aiApiKey } = body as {
      competitorId: string;
      raw?: string;
      aiApiKey: string;
    };
    // スクリーンショット（data URL）→ API用画像に変換
    const images: ThreadsAiImage[] = (Array.isArray(body.images) ? (body.images as string[]) : [])
      .map(parseDataUrlImage)
      .filter((i): i is ThreadsAiImage => i !== null)
      .slice(0, 5);

    if (!competitorId || (!raw?.trim() && images.length === 0)) {
      return NextResponse.json({ error: "competitorId と、貼り付けテキストかスクショのどちらかは必須" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }
    const competitor = await prisma.threadsCompetitor.findUnique({ where: { id: competitorId } });
    if (!competitor) {
      return NextResponse.json({ error: "競合が見つかりません" }, { status: 404 });
    }

    const model = resolveThreadsAiModel(body.model);

    // ① パース（テキスト・スクショどちらでも）
    const today = new Date().toISOString().slice(0, 10);
    const parseRes = await callThreadsAI(aiApiKey, {
      systemPrompt: PASTE_PARSE_SYSTEM,
      userInstruction: raw?.trim()
        ? buildPasteParseInstruction(raw, today)
        : `今日の日付: ${today}\n\nスクリーンショットに写っている投稿をすべて分解してください。`,
      images,
      model,
      maxTokens: 8192,
    });
    if (parseRes.error) {
      return NextResponse.json({ error: parseRes.error, retryable: parseRes.retryable }, { status: parseRes.retryable ? 503 : 500 });
    }
    const parsed = extractJson<ParsedPastePost[]>(parseRes.text);
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ error: "投稿を抽出できませんでした。貼り付け内容を確認してください" }, { status: 422 });
    }

    // ② 登録
    const created = [];
    for (const p of parsed) {
      if (!p.content?.trim()) continue;
      const post = await prisma.threadsCompetitorPost.create({
        data: {
          competitorId,
          postUrl: p.postUrl ?? "",
          content: p.content,
          likes: Number(p.likes ?? 0),
          replies: Number(p.replies ?? 0),
          reposts: Number(p.reposts ?? 0),
          views: Number(p.views ?? 0),
          postedAt: p.postedAt ? safeDate(p.postedAt) : null,
          source: "manual",
        },
      });
      created.push(post);
    }
    if (created.length === 0) {
      return NextResponse.json({ error: "有効な投稿がありませんでした" }, { status: 422 });
    }

    // ③ 伸び判定: 同一競合内のいいね中央値の2倍以上（最低50）をホット扱い
    const allLikes = (
      await prisma.threadsCompetitorPost.findMany({
        where: { competitorId },
        select: { likes: true },
      })
    )
      .map((p) => p.likes)
      .sort((a, b) => a - b);
    const median = allLikes.length > 0 ? allLikes[Math.floor(allLikes.length / 2)] : 0;
    const hotThreshold = Math.max(50, median * 2);
    for (const post of created) {
      if (post.likes >= hotThreshold) {
        await prisma.threadsCompetitorPost.update({ where: { id: post.id }, data: { isHot: true } });
        post.isHot = true;
      }
    }

    // ④ 自動分類（失敗しても登録自体は成功として返す）
    let classified = 0;
    if (body.autoClassify !== false) {
      try {
        const classifyRes = await callThreadsAI(aiApiKey, {
          systemPrompt: CLASSIFY_SYSTEM,
          userInstruction: buildClassifyInstruction(created),
          model,
          maxTokens: 8192,
        });
        const results = extractJson<ClassifyResult[]>(classifyRes.text);
        if (results && Array.isArray(results)) {
          for (const r of results) {
            const target = created[r.index];
            if (!target) continue;
            await prisma.threadsCompetitorPost.update({
              where: { id: target.id },
              data: {
                planType: r.planType ?? "",
                hookType: r.hookType ?? "",
                structureJson: JSON.stringify({ ...r.structure, whyItWorks: r.whyItWorks }),
              },
            });
            classified++;
          }
        }
      } catch (e) {
        console.error("auto classify failed", e);
      }
    }

    return NextResponse.json({ createdCount: created.length, classified });
  } catch (e) {
    console.error("POST /api/threads/competitor-posts/parse", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
