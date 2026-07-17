// 投稿に合った画像をAIで生成
// ① Claudeが投稿本文から画像プロンプトを作成 → ② OpenAI gpt-image-1 で生成 → draftのmediaUrlsに保存
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, resolveThreadsAiModel } from "@/lib/threads-ai";
import {
  IMAGE_PROMPT_SYSTEM,
  buildImagePromptInstruction,
  type ImagePromptResult,
} from "@/lib/threads-prompts";

const MAX_IMAGES_PER_DRAFT = 4;

async function generateWithOpenAI(openaiApiKey: string, prompt: string): Promise<{ dataUrl?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 80,
        n: 1,
      }),
    });
    clearTimeout(timer);
    const data = (await res.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { error: `OpenAI: ${data.error?.message ?? `HTTP ${res.status}`}` };
    }
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return { error: "OpenAIから画像が返りませんでした" };
    return { dataUrl: `data:image/jpeg;base64,${b64}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: /abort/i.test(msg) ? "画像生成がタイムアウトしました。再実行してください" : msg };
  }
}

// POST /api/threads/drafts/:id/image
// Body: { aiApiKey, model?, styleInstruction? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.aiApiKey) {
      return NextResponse.json({ error: "AI APIキーが未設定です" }, { status: 400 });
    }

    const [draft, settings] = await Promise.all([
      prisma.threadsPostDraft.findUnique({ where: { id } }),
      prisma.threadsToolSettings.findFirst(),
    ]);
    if (!draft) {
      return NextResponse.json({ error: "投稿案が見つかりません" }, { status: 404 });
    }
    if (!draft.content.trim()) {
      return NextResponse.json({ error: "投稿本文が空です。先に本文を作成してください" }, { status: 400 });
    }
    if (!settings?.openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI APIキーが未登録です。設定画面（⚙️設定）で登録してください" },
        { status: 400 },
      );
    }

    let mediaUrls: string[] = [];
    try {
      mediaUrls = JSON.parse(draft.mediaUrls || "[]") as string[];
    } catch {
      mediaUrls = [];
    }
    if (mediaUrls.length >= MAX_IMAGES_PER_DRAFT) {
      return NextResponse.json({ error: `画像は1投稿あたり${MAX_IMAGES_PER_DRAFT}枚まで。不要な画像を削除してください` }, { status: 400 });
    }

    // ① Claudeが画像プロンプトを作成
    const promptRes = await callThreadsAI(body.aiApiKey, {
      systemPrompt: IMAGE_PROMPT_SYSTEM,
      userInstruction: buildImagePromptInstruction(draft.content, body.styleInstruction),
      model: resolveThreadsAiModel(body.model),
      maxTokens: 1024,
    });
    if (promptRes.error) {
      return NextResponse.json({ error: promptRes.error, retryable: promptRes.retryable }, { status: promptRes.retryable ? 503 : 500 });
    }
    const imagePrompt = extractJson<ImagePromptResult>(promptRes.text);
    if (!imagePrompt?.prompt) {
      return NextResponse.json({ error: "画像プロンプトの作成に失敗しました。再実行してください" }, { status: 422 });
    }

    // ② OpenAIで画像生成
    const gen = await generateWithOpenAI(settings.openaiApiKey, imagePrompt.prompt);
    if (!gen.dataUrl) {
      return NextResponse.json({ error: gen.error ?? "画像生成に失敗しました" }, { status: 502 });
    }

    // ③ draftに保存
    mediaUrls.push(gen.dataUrl);
    await prisma.threadsPostDraft.update({
      where: { id },
      data: { mediaUrls: JSON.stringify(mediaUrls) },
    });

    return NextResponse.json({
      image: gen.dataUrl,
      description: imagePrompt.description,
      imageCount: mediaUrls.length,
    });
  } catch (e) {
    console.error("POST /api/threads/drafts/[id]/image", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
