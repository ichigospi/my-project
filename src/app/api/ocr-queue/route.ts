import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 読み取り待ちキュー（AppSettingで管理）
// キー: ocr_queue → JSON配列

interface OcrQueueItem {
  id: string;
  videoId: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  views: number;
  status: "pending" | "processing" | "done" | "error";
  transcript?: string;
  error?: string;
  requestedAt: string;
  completedAt?: string;
}

async function getQueue(): Promise<OcrQueueItem[]> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "ocr_queue" } });
  return setting?.value ? JSON.parse(setting.value) : [];
}

async function saveQueue(queue: OcrQueueItem[]) {
  await prisma.appSetting.upsert({
    where: { key: "ocr_queue" },
    update: { value: JSON.stringify(queue) },
    create: { key: "ocr_queue", value: JSON.stringify(queue) },
  });
}

// GET: キューの一覧を取得
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const queue = await getQueue();
    return NextResponse.json({ queue });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: キューに追加 or 結果を書き戻し
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const queue = await getQueue();

    if (body.action === "add") {
      // 重複チェック
      if (queue.some((q) => q.videoId === body.videoId && q.status !== "done" && q.status !== "error")) {
        return NextResponse.json({ ok: true, message: "既にキューにあります" });
      }
      queue.push({
        id: body.id || Date.now().toString(36),
        videoId: body.videoId,
        videoTitle: body.videoTitle || "",
        channelName: body.channelName || "",
        thumbnailUrl: body.thumbnailUrl || "",
        views: body.views || 0,
        status: "pending",
        requestedAt: new Date().toISOString(),
      });
      await saveQueue(queue);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "complete") {
      const idx = queue.findIndex((q) => q.id === body.id);
      if (idx >= 0) {
        queue[idx].status = "done";
        queue[idx].transcript = body.transcript;
        queue[idx].completedAt = new Date().toISOString();
        await saveQueue(queue);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "error") {
      const idx = queue.findIndex((q) => q.id === body.id);
      if (idx >= 0) {
        queue[idx].status = "error";
        queue[idx].error = body.error;
        await saveQueue(queue);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "remove") {
      const filtered = queue.filter((q) => q.id !== body.id);
      await saveQueue(filtered);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
