// デイリープランの一覧取得・新規生成
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callXPostAI, type XPostModel } from "@/lib/x-post-ai";
import {
  buildDailyPlanSystemPrompt,
  buildDailyPlanUserMessage,
  parseDailyPlanProposals,
} from "@/lib/x-post-prompts";
import {
  buildSlotStructure,
  applyConnectionRandomization,
} from "@/lib/x-post-daily-planner";
import {
  parseSettings,
  defaultSettings,
  type DailyPlanSlot,
} from "@/lib/x-post-types";

// GET /api/x-post/daily-plans?genre=business&date=2026-04-28
//   date 省略時はジャンルの全プラン一覧（直近30日）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const date = searchParams.get("date");
    const where: Record<string, string> = {};
    if (genre) where.genre = genre;
    if (date) where.date = date;
    const plans = await prisma.xDailyPlan.findMany({
      where,
      orderBy: { date: "desc" },
      take: date ? undefined : 30,
    });
    return NextResponse.json(plans);
  } catch (e) {
    console.error("GET /api/x-post/daily-plans", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/daily-plans
// Body: { genre, date, aiApiKey?, model?, customInstruction?, withAiThemes? }
// withAiThemes が false ならスロット構造だけ算出してテーマは空
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genre, date, aiApiKey, model, customInstruction, withAiThemes = true } = body as {
      genre: "business" | "spiritual";
      date: string;
      aiApiKey?: string;
      model?: XPostModel;
      customInstruction?: string;
      withAiThemes?: boolean;
    };

    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date は YYYY-MM-DD 形式" }, { status: 400 });
    }
    if (withAiThemes && !aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定（withAiThemes=true の場合は必須）" }, { status: 400 });
    }

    // 1. 設定取得
    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre) ?? defaultSettings(genre);

    // 2. 過去N日のジャンル別生成ポスト履歴から教育タイプの最終投稿日を取得
    const lookbackDays = 14;
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
    const recentPosts = await prisma.xGeneratedPost.findMany({
      where: { genre, createdAt: { gte: lookbackDate } },
      orderBy: { createdAt: "desc" },
      select: { educationType: true, createdAt: true },
    });
    const recentPostsByEducation: Record<string, string | null> = {};
    for (const p of recentPosts) {
      if (!p.educationType) continue;
      const dateStr = p.createdAt.toISOString().slice(0, 10);
      if (!recentPostsByEducation[p.educationType] || recentPostsByEducation[p.educationType]! < dateStr) {
        recentPostsByEducation[p.educationType] = dateStr;
      }
    }

    // 3. スロット構造を算出
    let slots: DailyPlanSlot[] = buildSlotStructure({
      postsPerDay: settings.postsPerDay,
      educationConfig: settings.educationConfig,
      recentPostsByEducation,
      todayDate: date,
    });

    // 4. 接続タイプの自動付与
    slots = applyConnectionRandomization(slots, settings.sequenceConfig);

    // 5. AIによるテーマ提案
    if (withAiThemes && aiApiKey) {
      try {
        const { systemPrompt, knowledgeContext } = await buildDailyPlanSystemPrompt(genre);
        const recentThemes = recentPosts
          .slice(0, 10)
          .map((p) => `[${p.educationType}]`)
          .join(", ");
        const userMessage = buildDailyPlanUserMessage({
          date,
          genre,
          slots: slots.map((s) => ({
            slot: s.slot,
            educationType: s.educationType,
            connectionType: s.connectionType,
          })),
          recentThemesSummary: recentThemes || undefined,
          customInstruction,
        });

        const aiRes = await callXPostAI(aiApiKey, {
          systemPrompt,
          knowledgeContext,
          userInstruction: userMessage,
          model: model ?? (settings.defaultModel as XPostModel),
          maxTokens: 2048,
        });

        if (!aiRes.error) {
          const { proposals } = parseDailyPlanProposals(aiRes.text);
          // スロット番号でマッチングしてテーマを埋める
          slots = slots.map((s) => {
            const p = proposals.find((pr) => pr.slot === s.slot);
            if (!p) return s;
            return {
              ...s,
              theme: p.theme,
              hookType: p.hookType,
              reasoning: p.reasoning,
            };
          });
        }
      } catch (e) {
        // AI失敗してもスロット構造は返す
        console.error("AI theme suggestion failed", e);
      }
    }

    // 6. DBに upsert（同じ日付のプランがあれば上書き）
    const plan = await prisma.xDailyPlan.upsert({
      where: { genre_date: { genre, date } },
      create: {
        genre,
        date,
        slots: JSON.stringify(slots),
        notes: "",
        status: "draft",
      },
      update: {
        slots: JSON.stringify(slots),
        notes: "",
        status: "draft",
      },
    });

    return NextResponse.json({
      plan,
      slots,
      recentPostsByEducation,
      lookbackDays,
    });
  } catch (e) {
    console.error("POST /api/x-post/daily-plans", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

