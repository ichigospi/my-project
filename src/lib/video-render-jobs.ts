// レンダリングジョブの管理(サーバーメモリ)
// 10〜20分の長尺動画はエンコードに数十分かかり、HTTPリクエストを開いたまま
// 待つとタイムアウトするため、投げて(submit)→ポーリング(poll)方式にする。
// Railwayは単一インスタンスなのでプロセス内Mapで十分。再起動でジョブは消える。

export interface RenderJob {
  id: string;
  status: "rendering" | "done" | "error";
  url?: string;
  sizeMb?: number;
  duration?: number;
  error?: string;
  createdAt: number;
}

const globalStore = globalThis as unknown as { __videoRenderJobs?: Map<string, RenderJob> };
const jobs: Map<string, RenderJob> = globalStore.__videoRenderJobs || new Map();
globalStore.__videoRenderJobs = jobs;

const JOB_TTL_MS = 3 * 60 * 60 * 1000; // 3時間で掃除

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createJob(): RenderJob {
  cleanup();
  const job: RenderJob = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
    status: "rendering",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function completeJob(id: string, result: { url: string; sizeMb: number; duration: number }) {
  const job = jobs.get(id);
  if (job) Object.assign(job, { status: "done", ...result });
}

export function failJob(id: string, error: string) {
  const job = jobs.get(id);
  if (job) Object.assign(job, { status: "error", error });
}
