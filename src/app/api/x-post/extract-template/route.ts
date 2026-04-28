// 競合ポスト/参考ポストからテンプレを自動抽出
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildExtractTemplateSystemPrompt,
  buildExtractTemplateUserMessage,
  parseExtractedTemplate,
} from "@/lib/x-post-prompts";
import { parseSettings, defaultSettings } from "@/lib/x-post-types";

// POST /api/x-post/extract-template
// Body:
//   { postId: string, aiApiKey, model?, save?: boolean }  …競合ポストから抽出
//   または
//   { genre, content: string, aiApiKey, model?, save?: boolean }  …生テキストから抽出
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, content: rawContent, genre: rawGenre, aiApiKey, model, save = false, name: nameOverride } = body as {
      postId?: string;
      content?: string;
      genre?: "business" | "spiritual";
      aiApiKey?: string;
      model?: XPostModel;
      save?: boolean;
      name?: string;
    };

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定" }, { status: 400 });
    }

    let genre: "business" | "spiritual";
    let content: string;
    let postMeta: { likes?: number; retweets?: number; impressions?: number } | undefined;
    let sourceId: string | null = null;

    if (postId) {
      const post = await prisma.xPost.findUnique({
        where: { id: postId },
        include: { competitor: { select: { genre: true } } },
      });
      if (!post) {
        return NextResponse.json({ error: "ポストが見つかりません" }, { status: 404 });
      }
      const g = post.competitor.genre;
      if (g !== "business" && g !== "spiritual") {
        return NextResponse.json({ error: "ジャンル不正" }, { status: 400 });
      }
      genre = g;
      content = post.content;
      postMeta = { likes: post.likes, retweets: post.retweets, impressions: post.impressions };
      sourceId = post.id;
    } else if (rawContent && (rawGenre === "business" || rawGenre === "spiritual")) {
      genre = rawGenre;
      content = rawContent;
    } else {
      return NextResponse.json({ error: "postId か (genre + content) が必要" }, { status: 400 });
    }

    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre) ?? defaultSettings(genre);

    const { systemPrompt, knowledgeContext } = await buildExtractTemplateSystemPrompt(genre);
    const userMessage = buildExtractTemplateUserMessage({ genre, postContent: content, postMeta });

    const aiRes = await callXPostAI(aiApiKey, {
      systemPrompt,
      knowledgeContext,
      userInstruction: userMessage,
      model: model ?? (settings.defaultModel as XPostModel),
      maxTokens: 1500,
    });

    if (aiRes.error) {
      return NextResponse.json({ error: aiRes.error, retryable: aiRes.retryable }, { status: 500 });
    }

    const { template, parseError } = parseExtractedTemplate(aiRes.text);
    if (!template) {
      return NextResponse.json({ error: "テンプレ抽出のパース失敗", raw: aiRes.text }, { status: 500 });
    }

    let savedId: string | null = null;
    if (save) {
      const created = await prisma.xPostTemplate.create({
        data: {
          genre,
          name: nameOverride || template.name || "(無題テンプレ)",
          sourceType: postId ? "competitor_post" : "scratch",
          sourceId,
          structure: JSON.stringify(template.structure),
          skeleton: template.skeleton,
          placeholders: JSON.stringify(template.placeholders),
          notes: template.notes,
        },
      });
      savedId = created.id;
    }

    return NextResponse.json({
      template,
      raw: aiRes.text,
      parseError,
      savedId,
      usage: aiRes.usage,
      model: aiRes.model,
    });
  } catch (e) {
    console.error("POST /api/x-post/extract-template", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
