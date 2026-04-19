// RunPod Serverless ComfyUI クライアント

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

export type ComfyUIWorkflow = Record<string, unknown>;

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

function authHeaders() {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set");
  }
  return {
    Authorization: `Bearer ${RUNPOD_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function submitJob(workflow: ComfyUIWorkflow): Promise<RunPodJobResponse> {
  const res = await fetch(`${BASE_URL}/run`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ input: { workflow } }),
  });
  if (!res.ok) {
    throw new Error(`RunPod submit failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RunPodJobResponse;
}

export async function getJobStatus(jobId: string): Promise<RunPodJobResponse> {
  const res = await fetch(`${BASE_URL}/status/${jobId}`, {
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
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<RunPodJobResponse> {
  const { pollIntervalMs = 2000, timeoutMs = 600_000 } = options;

  const start = Date.now();
  const submitted = await submitJob(workflow);
  let current = submitted;

  while (current.status === "IN_QUEUE" || current.status === "IN_PROGRESS") {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`RunPod job timeout after ${timeoutMs}ms (jobId=${submitted.id})`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    current = await getJobStatus(submitted.id);
  }

  return current;
}
