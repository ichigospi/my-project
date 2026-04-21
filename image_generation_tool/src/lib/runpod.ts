// RunPod Serverless ComfyUI クライアント。
//
// 複数 endpoint 対応: 環境変数は以下を参照する:
//   - RUNPOD_ENDPOINT_ID          通常の Lora のみ生成用
//   - RUNPOD_IPADAPTER_ENDPOINT_ID IP-Adapter Face 同梱イメージ用（顔参照時のみ）
// 呼び出し側で `kind` を指定するが、デフォルトは "default"（既存挙動と互換）。

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const DEFAULT_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const IPADAPTER_ENDPOINT_ID = process.env.RUNPOD_IPADAPTER_ENDPOINT_ID;

export type RunPodEndpointKind = "default" | "ipadapter";

export type ComfyUIWorkflow = Record<string, unknown>;

export interface ComfyUIInputImage {
  /** ワークフロー内の LoadImage.inputs.image でそのまま参照される名前（拡張子込みがベター）。 */
  name: string;
  /** base64 エンコードされた画像本体（data: プレフィクス無し）。 */
  image: string;
}

export interface RunPodJobResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  delayTime?: number;
  executionTime?: number;
  output?: {
    images?: Array<{ data: string; filename?: string }>;
    message?: string;
  };
  error?: string;
}

function resolveEndpointId(kind: RunPodEndpointKind): string {
  if (kind === "ipadapter") {
    if (!IPADAPTER_ENDPOINT_ID) {
      throw new Error(
        "RUNPOD_IPADAPTER_ENDPOINT_ID is not set (顔参照生成には IP-Adapter 対応イメージをデプロイした別 endpoint が必要)",
      );
    }
    return IPADAPTER_ENDPOINT_ID;
  }
  if (!DEFAULT_ENDPOINT_ID) {
    throw new Error("RUNPOD_ENDPOINT_ID is not set");
  }
  return DEFAULT_ENDPOINT_ID;
}

function baseUrl(kind: RunPodEndpointKind): string {
  return `https://api.runpod.ai/v2/${resolveEndpointId(kind)}`;
}

function authHeaders() {
  if (!RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY is not set");
  return {
    Authorization: `Bearer ${RUNPOD_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface SubmitOptions {
  kind?: RunPodEndpointKind;
  /** IP-Adapter 等で LoadImage に食わせる画像を base64 で添付する場合に指定。 */
  images?: ComfyUIInputImage[];
}

export async function submitJob(
  workflow: ComfyUIWorkflow,
  options: SubmitOptions = {},
): Promise<RunPodJobResponse> {
  const { kind = "default", images } = options;
  const inputPayload: Record<string, unknown> = { workflow };
  if (images && images.length > 0) inputPayload.images = images;

  const res = await fetch(`${baseUrl(kind)}/run`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ input: inputPayload }),
  });
  if (!res.ok) {
    throw new Error(`RunPod submit failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RunPodJobResponse;
}

export async function getJobStatus(
  jobId: string,
  kind: RunPodEndpointKind = "default",
): Promise<RunPodJobResponse> {
  const res = await fetch(`${baseUrl(kind)}/status/${jobId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`RunPod status failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RunPodJobResponse;
}

// 同期風に完了まで待つ（Phase 1-0 疎通確認用、本番では非同期化すべき）
export async function runJobToCompletion(
  workflow: ComfyUIWorkflow,
  options: SubmitOptions & { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<RunPodJobResponse> {
  // 高解像度 + 顔参照 + バッチでは cold start 含めて 10〜15 分かかることがあるため、
  // タイムアウトは 20 分に設定。
  const { pollIntervalMs = 2000, timeoutMs = 1_200_000, kind = "default", images } = options;

  const start = Date.now();
  const submitted = await submitJob(workflow, { kind, images });
  let current = submitted;

  while (current.status === "IN_QUEUE" || current.status === "IN_PROGRESS") {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`RunPod job timeout after ${timeoutMs}ms (jobId=${submitted.id})`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    current = await getJobStatus(submitted.id, kind);
  }

  return current;
}
