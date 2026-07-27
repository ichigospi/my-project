import { NextRequest, NextResponse } from "next/server";
import { checkVideoTask, LitMediaError } from "@/lib/litmedia";
import { saveAsset, importAssetFromUrl, assetUrl } from "@/lib/video-assets";

export const maxDuration = 300;

// 生成タスクの状態を1回確認する。完了していたら素材を取り込んで配信URLを返す。
// クライアント側が数十秒間隔でポーリングする想定。
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider, taskId, openaiApiKey, litmediaApiKey } = body;

  if (!provider || !taskId) {
    return NextResponse.json({ error: "provider と taskId が必要です" }, { status: 400 });
  }

  try {
    if (provider === "sora_video") {
      if (!openaiApiKey) return NextResponse.json({ error: "OpenAI APIキーが必要です" }, { status: 400 });
      const res = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${openaiApiKey}` },
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: e.error?.message || `Soraステータス取得エラー (${res.status})` },
          { status: res.status },
        );
      }
      const data = await res.json();
      if (data.status === "completed") {
        const contentRes = await fetch(
          `https://api.openai.com/v1/videos/${encodeURIComponent(taskId)}/content`,
          { headers: { Authorization: `Bearer ${openaiApiKey}` } },
        );
        if (!contentRes.ok) {
          return NextResponse.json({ error: `Sora動画のダウンロードに失敗 (${contentRes.status})` }, { status: 502 });
        }
        const id = await saveAsset(Buffer.from(await contentRes.arrayBuffer()), "mp4");
        return NextResponse.json({ status: "ready", url: assetUrl(id) });
      }
      if (data.status === "failed") {
        return NextResponse.json({ status: "error", error: data.error?.message || "Sora: 生成に失敗しました" });
      }
      return NextResponse.json({ status: "generating", progress: data.progress ?? null });
    }

    if (provider === "litvideo_video") {
      if (!litmediaApiKey) return NextResponse.json({ error: "LitMedia APIキーが必要です" }, { status: 400 });
      const result = await checkVideoTask(litmediaApiKey, String(taskId));
      if (result.status === "ready") {
        const id = await importAssetFromUrl(result.url, "mp4");
        return NextResponse.json({ status: "ready", url: assetUrl(id) });
      }
      if (result.status === "error") {
        return NextResponse.json({ status: "error", error: result.error });
      }
      return NextResponse.json({ status: "generating" });
    }

    return NextResponse.json({ error: `不明なprovider: ${provider}` }, { status: 400 });
  } catch (e) {
    console.error("POST /api/video/asset-status", e);
    if (e instanceof LitMediaError) {
      return NextResponse.json({ error: `LitMedia: ${e.message} (code: ${e.code})` }, { status: 502 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
