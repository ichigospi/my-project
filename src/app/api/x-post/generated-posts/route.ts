// 生成ポストの一覧取得・生成（AI呼び出し）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildGenerateSystemPrompt,
  buildGenerateUserMessage,
  parseGeneratedResult,
  type GenerateUserMessageOpts,
} from "@/lib/x-post-prompts";
import { parseSettings, defaultSettings } from "@/lib/x-post-types";

// GET /api/x-post/generated-posts?genre=business&dailyPlanId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const dailyPlanId = searchParams.get("dailyPlanId");

    const where: Record<string, unknown> = {};
    if (genre) where.genre = genre;
    if (dailyPlanId) where.dailyPlanId = dailyPlanId;

    const posts = await prisma.xGeneratedPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: dailyPlanId ? undefined : 50,
    });
    return NextResponse.json(posts);
  } catch (e) {
    console.error("GET /api/x-post/generated-posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/generated-posts
// Body: { genre, aiApiKey, model?, mode, educationType, topic, ...其他オプション }
//   生成のみ実行する場合は save=false
//   保存する場合は save=true（output に AI 生成結果を入れる、もしくは AI を呼ばずに既存テキストを保存）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      genre,
      aiApiKey,
      model,
      save = true,
      mode,
      educationType = "",
      logicType = "",
      topic = "",
      hookType = "",
      structureType = "",
      reinforcementElements = [],
      templateSkeleton,
      templatePlaceholders,
      referenceExamples,
      customInstruction,
      // 保存メタ
      sourceTemplateId,
      sourceAnalysisId,
      sequencePatternId,
      dailyPlanId,
      slotIndex,
    } = body as {
      genre: "business" | "spiritual";
      aiApiKey?: string;
      model?: XPostModel;
      save?: boolean;
      mode: "scratch" | "template" | "daily_slot";
      educationType?: string;
      logicType?: "" | "課題解決型" | "欲求喚起型";
      topic?: string;
      hookType?: string;
      structureType?: string;
      reinforcementElements?: string[];
      templateSkeleton?: string;
      templatePlaceholders?: string[];
      referenceExamples?: string[];
      customInstruction?: string;
      sourceTemplateId?: string;
      sourceAnalysisId?: string;
      sequencePatternId?: string;
      dailyPlanId?: string;
      slotIndex?: number;
    };

    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    if (!aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定" }, { status: 400 });
    }
    if (mode !== "scratch" && mode !== "template" && mode !== "daily_slot") {
      return NextResponse.json({ error: "mode は scratch / template / daily_slot" }, { status: 400 });
    }

    // 設定からデフォルトモデル・スパイス設定を取得
    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre) ?? defaultSettings(genre);

    const userMsgOpts: GenerateUserMessageOpts = {
      genre,
      mode,
      educationType,
      logicType: logicType as GenerateUserMessageOpts["logicType"],
      topic,
      hookType,
      structureType,
      reinforcementElements,
      spiceEnabled: settings.spiceEnabled,
      templateSkeleton,
      templatePlaceholders,
      referenceExamples,
      customInstruction,
    };

    const { systemPrompt, knowledgeContext } = await buildGenerateSystemPrompt(genre);
    const userMessage = buildGenerateUserMessage(userMsgOpts);

    const aiRes = await callXPostAI(aiApiKey, {
      systemPrompt,
      knowledgeContext,
      userInstruction: userMessage,
      model: model ?? (settings.defaultModel as XPostModel),
      maxTokens: 2048,
    });

    if (aiRes.error) {
      return NextResponse.json({ error: aiRes.error, retryable: aiRes.retryable }, { status: 500 });
    }

    const { result, parseError } = parseGeneratedResult(aiRes.text);

    // 保存（save=true 時のみ）
    let savedId: string | null = null;
    if (save && result.posts.length > 0) {
      const created = await prisma.xGeneratedPost.create({
        data: {
          genre,
          topic,
          instruction: customInstruction ?? "",
          educationType,
          logicType,
          output: JSON.stringify(result),
          metadata: JSON.stringify({
            mode,
            hookType,
            structureType,
            reinforcementElements,
            model: aiRes.model,
            usage: aiRes.usage,
          }),
          sourceTemplateId: sourceTemplateId ?? null,
          sourceAnalysisId: sourceAnalysisId ?? null,
          sequencePatternId: sequencePatternId ?? null,
          dailyPlanId: dailyPlanId ?? null,
          slotIndex: typeof slotIndex === "number" ? slotIndex : null,
        },
      });
      savedId = created.id;
    }

    return NextResponse.json({
      result,
      raw: aiRes.text,
      parseError,
      usage: aiRes.usage,
      model: aiRes.model,
      savedId,
    });
  } catch (e) {
    console.error("POST /api/x-post/generated-posts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
