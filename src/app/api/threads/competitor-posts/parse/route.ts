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
    const postFormat: "short" | "long" | "tree" | "" = ["short", "long", "tree"].includes(body.postFormat)
      ? body.postFormat
      : "";
    const tags: string[] = Array.isArray(body.tags)
      ? (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean).slice(0, 30)
      : [];
    const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";

    // ① パース（テキスト・スクショどちらでも。長文ツリー/長文は1投稿に結合）
    const today = new Date().toISOString().slice(0, 10);
    const instruction = buildPasteParseInstruction({
      raw: raw?.trim() || undefined,
      todayIso: today,
      postFormat,
      hasImages: images.length > 0,
    });
    const parseRes = await callThreadsAI(aiApiKey, {
      systemPrompt: PASTE_PARSE_SYSTEM,
      userInstruction: instruction,
      images,
      model,
      maxTokens: 8192,
    });
    if (parseRes.error) {
      return NextResponse.json({ error: parseRes.error, retryable: parseRes.retryable }, { status: parseRes.retryable ? 503 : 500 });
    }
    let parsed = coerceToPostArray(extractJson<unknown>(parseRes.text));
    let lastText = parseRes.text;
    // JSONとして解釈できない場合は厳格指示で1回だけ再試行
    if (!parsed) {
      const retry = await callThreadsAI(aiApiKey, {
        systemPrompt: PASTE_PARSE_SYSTEM,
        userInstruction:
          instruction +
          "\n\n※重要: トップレベルが【JSON配列】のデータのみを厳密に出力してください（オブジェクトで包まない・説明・コードフェンス（```）は一切書かない）。本文が読み取れた投稿だけを配列で返す。",
        images,
        model,
        maxTokens: 8192,
      });
      if (!retry.error) {
        lastText = retry.text;
        parsed = coerceToPostArray(extractJson<unknown>(retry.text));
      }
    }
    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            "投稿を抽出できませんでした。スクショに投稿の本文が写っているか確認してください（プロフィール画面ではなく、投稿一覧/投稿詳細のスクショが必要です）。テキスト貼り付けでも試せます。",
          debug: (lastText || "").slice(0, 300),
        },
        { status: 422 },
      );
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
          postFormat,
          tags: JSON.stringify(tags),
          purpose,
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

// AIの返却を投稿配列に正規化（配列そのまま / {posts:[...]}等のオブジェクト包み / 単一オブジェクトに対応）
function coerceToPostArray(raw: unknown): ParsedPastePost[] | null {
  if (Array.isArray(raw)) return raw as ParsedPastePost[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["posts", "items", "results", "data", "投稿", "list"]) {
      if (Array.isArray(obj[key])) return obj[key] as ParsedPastePost[];
    }
    // 単一投稿オブジェクト（contentやtextを持つ）なら1要素の配列に
    if (typeof obj.content === "string" || typeof obj.text === "string") {
      return [raw as ParsedPastePost];
    }
  }
  return null;
}
