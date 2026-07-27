// LitMedia (LitVideo) 公式 skill API クライアント
// 仕様: https://github.com/litmedia-ai/skill (Bearer認証 + リクエスト署名 + create_id ポーリング)
import { createHash } from "crypto";

const BASE_URL = "https://litvideo-api.litmedia.ai";
const SIGN_SECRET = "uN3lu01bFtumul8W";

// 動画生成モデル(公式skillのMODEL_MAPより主要なもの)
export const LITMEDIA_VIDEO_MODELS = [
  { id: 1, label: "LitAI 5(おすすめ・自動選択)" },
  { id: 41, label: "Seedance 2.0" },
  { id: 43, label: "Kling V3" },
  { id: 31, label: "Wan 2.6" },
] as const;

export class LitMediaError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function signedParams(): string {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const randomStr = String(Math.floor(Math.random() * 100000000));
  const sha1 = createHash("sha1").update(timeStamp + randomStr + SIGN_SECRET).digest("hex");
  const signature = createHash("md5").update(sha1).digest("hex").toUpperCase();
  return new URLSearchParams({
    timeStamp,
    randomStr,
    signature,
    app_type: "2",
  }).toString();
}

async function post(apiKey: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}?${signedParams()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Monimaster-Device-Code": "",
      "Monimaster-Api-Version": "",
      "Monimaster-Device-Type": "110",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new LitMediaError(String(res.status), `LitMedia API HTTPエラー: ${res.status}`);
  }
  const data = await res.json();
  const code = String(data?.code ?? "");
  if (code !== "200") {
    throw new LitMediaError(code, data?.message || `LitMedia APIエラー (code: ${code})`);
  }
  return data?.data ?? data;
}

/** テキスト→動画の生成タスクを投げる。create_id を返す */
export async function submitTextToVideo(
  apiKey: string,
  opts: { prompt: string; modelId?: number; ratio: string; duration?: number; quality?: string },
): Promise<string> {
  const data = await post(apiKey, "/lit-video/do-text-video", {
    prompt: opts.prompt,
    video_model: opts.modelId ?? 1,
    quality: opts.quality ?? "720p",
    ratio: opts.ratio,
    duration: opts.duration ?? 5,
  });
  const createId = data?.create_id;
  if (!createId) throw new LitMediaError("NO_CREATE_ID", "LitMedia: create_id が返りませんでした");
  return String(createId);
}

/** 画像→動画の生成タスクを投げる。create_id を返す */
export async function submitImageToVideo(
  apiKey: string,
  opts: { prompt: string; imgUrl: string; modelId?: number; ratio: string; duration?: number; quality?: string },
): Promise<string> {
  const data = await post(apiKey, "/lit-video/do-image-video", {
    prompt: opts.prompt,
    img_url: opts.imgUrl,
    video_model: opts.modelId ?? 1,
    quality: opts.quality ?? "720p",
    ratio: opts.ratio,
    duration: opts.duration ?? 5,
    video_num: 1,
  });
  const createId = data?.create_id;
  if (!createId) throw new LitMediaError("NO_CREATE_ID", "LitMedia: create_id が返りませんでした");
  return String(createId);
}

export type LitMediaTaskResult =
  | { status: "generating" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string };

/** 動画生成タスクの状態を1回だけ確認する(status: 0=進行中 1=完了 2=失敗) */
export async function checkVideoTask(apiKey: string, createId: string): Promise<LitMediaTaskResult> {
  const data = await post(apiKey, "/lit-video/do-process", { create_id: createId });
  const status = Number(data?.status ?? 0);
  if (status === 1) {
    const child = Array.isArray(data?.child_data) ? (data.child_data as Record<string, unknown>[]) : [];
    const url =
      (child[0]?.down_video_url as string) ||
      (child[0]?.video_url as string) ||
      (data?.down_video_url as string) ||
      (data?.video_url as string) ||
      "";
    if (!url) return { status: "error", error: "LitMedia: 動画URLが取得できませんでした" };
    return { status: "ready", url };
  }
  if (status === 2) {
    return { status: "error", error: String(data?.real_error || data?.error || "LitMedia: 生成に失敗しました") };
  }
  return { status: "generating" };
}
