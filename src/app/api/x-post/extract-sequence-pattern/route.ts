// 複数の競合ポストからシーケンスパターンを自動抽出
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildExtractSequenceSystemPrompt,
  buildExtractSequenceUserMessage,
  parseExtractedSequence,
} from "@/lib/x-post-prompts";
import { parseSettings } from "@/lib/x-post-types";

// POST /api/x-post/extract-sequence-pattern
// Body: { postIds: string[], aiApiKey, model?, save?: boolean, name? }
//   postIds は時系列順（古→新 or 投稿順）の前提
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postIds, aiApiKey, model, save = false, name: nameOverride } = body as {
      postIds?: string[];
      aiApiKey?: string;
      model?: XPostModel;
      save?: boolean;
      name?: string;
    };

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定" }, { status: 400 });
    }
    if (!Array.isArray(postIds) || postIds.length < 2 || postIds.length > 8) {
      return NextResponse.json({ error: "postIds は2〜8件" }, { status: 400 });
    }

    const posts = await prisma.xPost.findMany({
      where: { id: { in: postIds } },
      include: { competitor: { select: { genre: true } } },
    });
    if (posts.length !== postIds.length) {
      return NextResponse.json({ error: "一部ポストが見つかりません" }, { status: 404 });
    }

    // 全部同じジャンルでないとパターンとして成立しない
    const genres = new Set(posts.map((p) => p.competitor.genre));
    if (genres.size !== 1) {
      return NextResponse.json({ error: "選択ポストのジャンルが揃っていません" }, { status: 400 });
    }
    const genre = posts[0].competitor.genre;
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "ジャンル不正" }, { status: 400 });
    }

    // postIds の順番を保つ
    const ordered = postIds
      .map((id) => posts.find((p) => p.id === id))
      .filter((p): p is (typeof posts)[number] => Boolean(p));

    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre);

    const { systemPrompt, knowledgeContext } = await buildExtractSequenceSystemPrompt(genre);
    const userMessage = buildExtractSequenceUserMessage({
      genre,
      posts: ordered.map((p, i) => ({
        index: i + 1,
        content: p.content,
        isQuoteRt: p.isQuoteRt,
        likes: p.likes,
        retweets: p.retweets,
      })),
    });

    const aiRes = await callXPostAI(aiApiKey, {
      systemPrompt,
      knowledgeContext,
      userInstruction: userMessage,
      model: model ?? (settings.defaultModel as XPostModel),
      maxTokens: 2500,
    });

    if (aiRes.error) {
      return NextResponse.json({ error: aiRes.error, retryable: aiRes.retryable }, { status: 500 });
    }

    const { pattern, parseError } = parseExtractedSequence(aiRes.text);
    if (!pattern) {
      return NextResponse.json({ error: "シーケンス抽出のパース失敗", raw: aiRes.text }, { status: 500 });
    }

    let savedId: string | null = null;
    if (save) {
      const created = await prisma.xSequencePattern.create({
        data: {
          genre,
          name: nameOverride || pattern.name || "(無題シーケンス)",
          description: pattern.description,
          pattern: JSON.stringify(pattern.pattern),
          example: pattern.example,
          isBuiltIn: false,
        },
      });
      savedId = created.id;
    }

    return NextResponse.json({
      pattern,
      raw: aiRes.text,
      parseError,
      savedId,
      usage: aiRes.usage,
      model: aiRes.model,
    });
  } catch (e) {
    console.error("POST /api/x-post/extract-sequence-pattern", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
