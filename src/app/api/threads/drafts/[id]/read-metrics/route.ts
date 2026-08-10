// 投稿後のスクショから実績（表示回数/いいね/コメント/リポスト）を読み取る
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { callThreadsAI, extractJson, parseDataUrlImage, resolveThreadsAiModel, type ThreadsAiImage } from "@/lib/threads-ai";

export const maxDuration = 60;

const READ_METRICS_SYSTEM = `あなたはThreads（スレッズ）の投稿スクリーンショットから数値を正確に読み取る専門家です。
画像に写っている「自分の投稿」のインサイト数値を読み取ってください。

読み取る項目:
- views: 表示回数（「表示」「ビュー」「views」の数値。最も重要）
- likes: いいね数（ハート❤️の数値）
- replies: 返信・コメント数（💬の数値）
- reposts: リポスト数（🔁の数値。引用含む）

ルール:
- 「1.2万」「3,456」「1万」「12K」等はすべて半角の整数に変換する（1.2万→12000、12K→12000）。
- 複数枚ある場合（本文＋続きのツリー等）は、本文（先頭）の投稿の数値を優先。全体の合計ではなく代表値を返す。
- 読み取れない項目は 0 にする。推測で埋めない。
- 出力は次のJSONのみ。前置き・説明・コードフェンスは書かない。
{ "views": 数値, "likes": 数値, "replies": 数値, "reposts": 数値 }`;

interface ReadMetricsResult {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("editor");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const aiApiKey = body.aiApiKey as string | undefined;
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが未設定です" }, { status: 400 });

    const images: ThreadsAiImage[] = (Array.isArray(body.images) ? (body.images as string[]) : [])
      .map(parseDataUrlImage)
      .filter((x): x is ThreadsAiImage => x !== null)
      .slice(0, 6);
    if (images.length === 0) {
      return NextResponse.json({ error: "スクショ画像を入れてください" }, { status: 400 });
    }

    const model = resolveThreadsAiModel(body.model);
    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: READ_METRICS_SYSTEM,
      userInstruction: "このスクショから表示回数・いいね・コメント・リポストの数値を読み取ってJSONで返してください。",
      images,
      model,
      maxTokens: 300,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: res.retryable ? 503 : 500 });
    }
    const parsed = extractJson<ReadMetricsResult>(res.text);
    if (!parsed) {
      return NextResponse.json({ error: "数値を読み取れませんでした。もう一度お試しください" }, { status: 502 });
    }
    return NextResponse.json({
      views: Math.max(0, Math.round(Number(parsed.views) || 0)),
      likes: Math.max(0, Math.round(Number(parsed.likes) || 0)),
      replies: Math.max(0, Math.round(Number(parsed.replies) || 0)),
      reposts: Math.max(0, Math.round(Number(parsed.reposts) || 0)),
    });
  } catch (e) {
    console.error("POST /api/threads/drafts/[id]/read-metrics", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
