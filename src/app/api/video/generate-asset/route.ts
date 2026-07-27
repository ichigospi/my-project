import { NextRequest, NextResponse } from "next/server";
import { submitTextToVideo, LitMediaError } from "@/lib/litmedia";
import { saveAsset, assetUrl } from "@/lib/video-assets";

export const maxDuration = 300;

// AI素材の生成を開始する。
// openai_image は同期(即URLを返す)、sora_video / litvideo_video は taskId を返して
// /api/video/asset-status でポーリングする。
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    provider,
    prompt,
    aspect = "9:16",
    duration = 5,
    openaiApiKey,
    litmediaApiKey,
    litmediaModelId,
  } = body;

  if (!provider || !prompt) {
    return NextResponse.json({ error: "provider と prompt が必要です" }, { status: 400 });
  }

  try {
    if (provider === "openai_image") {
      if (!openaiApiKey) return NextResponse.json({ error: "OpenAI APIキーが必要です" }, { status: 400 });
      const size = aspect === "9:16" ? "1024x1536" : aspect === "16:9" ? "1536x1024" : "1024x1024";
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size, n: 1 }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: e.error?.message || `OpenAI画像生成エラー (${res.status})` },
          { status: res.status },
        );
      }
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) return NextResponse.json({ error: "OpenAI: 画像データが返りませんでした" }, { status: 502 });
      const id = await saveAsset(Buffer.from(b64, "base64"), "png");
      return NextResponse.json({ status: "ready", url: assetUrl(id) });
    }

    if (provider === "sora_video") {
      if (!openaiApiKey) return NextResponse.json({ error: "OpenAI APIキーが必要です" }, { status: 400 });
      const size = aspect === "9:16" ? "720x1280" : "1280x720";
      const seconds = duration <= 4 ? "4" : duration <= 8 ? "8" : "12";
      const res = await fetch("https://api.openai.com/v1/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
        body: JSON.stringify({ model: "sora-2", prompt, size, seconds }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: e.error?.message || `Sora動画生成エラー (${res.status})` },
          { status: res.status },
        );
      }
      const data = await res.json();
      if (!data.id) return NextResponse.json({ error: "Sora: タスクIDが返りませんでした" }, { status: 502 });
      return NextResponse.json({ status: "generating", taskId: data.id });
    }

    if (provider === "litvideo_video") {
      if (!litmediaApiKey) return NextResponse.json({ error: "LitMedia APIキーが必要です" }, { status: 400 });
      const taskId = await submitTextToVideo(litmediaApiKey, {
        prompt,
        ratio: aspect,
        duration: Math.min(Math.max(Math.round(duration), 5), 12),
        modelId: litmediaModelId ? Number(litmediaModelId) : undefined,
      });
      return NextResponse.json({ status: "generating", taskId });
    }

    return NextResponse.json({ error: `不明なprovider: ${provider}` }, { status: 400 });
  } catch (e) {
    console.error("POST /api/video/generate-asset", e);
    if (e instanceof LitMediaError) {
      return NextResponse.json({ error: `LitMedia: ${e.message} (code: ${e.code})` }, { status: 502 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
