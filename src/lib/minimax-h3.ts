// MiniMax H3 (Hailuo 3.0) 公式API クライアント
// 仕様: https://platform.minimax.io/docs/guides/video-generation
//
// 非同期3ステップ: タスク作成(task_id が返る) → ステータス照会 → ダウンロードURL取得。
// H3 は content[] に text / image_url を並べるマルチモーダル入力で、
// 画像を先頭に置くと開始フレーム(first frame)として扱われる = 画像→動画。
//
// 注意: レスポンスの形はエンドポイントのバージョンによって
// download_url が直接返る場合と file_id 経由の場合があるため、両方を見て解決する。
// 想定外の形が返ったときは生のレスポンスをエラーに載せて原因を追えるようにしている。

const BASE_URL = "https://api.minimax.io";
const MODEL = "MiniMax-H3";

// H3が受け付けるクリップ長(秒)
const MIN_DURATION = 4;
const MAX_DURATION = 15;

export class MiniMaxError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

async function call(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: init?.body,
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = asRecord(JSON.parse(raw));
  } catch {
    // 非JSONが返るのは基本的に障害系。生の本文をエラーに載せる
  }
  // MiniMaxは HTTP 200 でも base_resp.status_code で失敗を返すことがある
  const base = asRecord(data.base_resp);
  const statusMsg = typeof base.status_msg === "string" ? base.status_msg : "";
  if (!res.ok) {
    throw new MiniMaxError(String(res.status), statusMsg || raw.slice(0, 300) || `HTTPエラー ${res.status}`);
  }
  const code = Number(base.status_code ?? 0);
  if (code !== 0) {
    throw new MiniMaxError(String(code), statusMsg || `MiniMax APIエラー (code: ${code})`);
  }
  return data;
}

/** レスポンスの入れ子(直下 / data 配下)を1階層フラットにして探しやすくする */
function payloadOf(data: Record<string, unknown>): Record<string, unknown> {
  return { ...asRecord(data.data), ...data };
}

function clampDuration(duration?: number): number {
  const d = Math.round(Number(duration) || MIN_DURATION);
  return Math.min(Math.max(d, MIN_DURATION), MAX_DURATION);
}

/**
 * 動画生成タスクを投げて task_id を返す。
 * imageDataUrl(data:image/...;base64,... または公開URL)を渡すと画像→動画になる。
 */
export async function submitVideo(
  apiKey: string,
  opts: { prompt: string; imageDataUrl?: string; aspect?: string; duration?: number; resolution?: string },
): Promise<string> {
  const content: ContentItem[] = [];
  if (opts.imageDataUrl) content.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  content.push({ type: "text", text: opts.prompt });

  const data = await call(apiKey, "/v2/video_generation", {
    method: "POST",
    body: JSON.stringify({
      model: MODEL,
      content,
      duration: clampDuration(opts.duration),
      resolution: opts.resolution === "2K" ? "2K" : "768P",
      ratio: opts.aspect || "9:16",
    }),
  });

  const payload = payloadOf(data);
  const taskId = payload.task_id ?? payload.id;
  if (!taskId) {
    throw new MiniMaxError("NO_TASK_ID", `MiniMax: task_id が返りませんでした (応答: ${JSON.stringify(data).slice(0, 300)})`);
  }
  return String(taskId);
}

export type MiniMaxTaskResult =
  | { status: "generating" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string };

/** 完了レスポンスからダウンロードURLを拾う(返る場所がいくつかあるため順に見る) */
function findDownloadUrl(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.download_url,
    payload.video_url,
    asRecord(payload.video).download_url,
    asRecord(payload.video).url,
    asRecord(payload.file).download_url,
  ];
  const url = candidates.find((v) => typeof v === "string" && v);
  return typeof url === "string" ? url : null;
}

/** file_id からダウンロードURLを取得する */
async function retrieveFileUrl(apiKey: string, fileId: string): Promise<string> {
  const data = await call(apiKey, `/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`);
  const url = findDownloadUrl(payloadOf(data));
  if (!url) {
    throw new MiniMaxError("NO_DOWNLOAD_URL", `MiniMax: ダウンロードURLが取得できませんでした (応答: ${JSON.stringify(data).slice(0, 300)})`);
  }
  return url;
}

/** タスクの状態を1回確認する */
export async function checkVideoTask(apiKey: string, taskId: string): Promise<MiniMaxTaskResult> {
  const data = await call(apiKey, `/v2/query/video_generation?task_id=${encodeURIComponent(taskId)}`);
  const payload = payloadOf(data);
  const status = String(payload.status ?? "").toLowerCase();

  if (status === "fail" || status === "failed" || status === "error") {
    const msg = payload.status_msg || payload.error || payload.message;
    return { status: "error", error: typeof msg === "string" && msg ? msg : "MiniMax: 生成に失敗しました" };
  }

  const direct = findDownloadUrl(payload);
  if (direct) return { status: "ready", url: direct };

  const fileId = payload.file_id ?? asRecord(payload.video_result).file_id;
  if (fileId) return { status: "ready", url: await retrieveFileUrl(apiKey, String(fileId)) };

  return { status: "generating" };
}
