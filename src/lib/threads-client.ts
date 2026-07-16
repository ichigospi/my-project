// Threadsツールのクライアント側共通処理
"use client";

import { getApiKey } from "@/lib/channel-store";
import { DEFAULT_THREADS_AI_MODEL, THREADS_AI_MODELS, type ThreadsAiModel } from "@/lib/threads-ai";

export { THREADS_AI_MODELS };
export type { ThreadsAiModel };

// AIキー（設定画面で保存されたlocalStorageのキーを使用）
export function getAiKey(): string {
  return getApiKey("ai_api_key");
}

const MODEL_STORAGE_KEY = "threads_ai_model";

export function getThreadsModel(): ThreadsAiModel {
  if (typeof window === "undefined") return DEFAULT_THREADS_AI_MODEL;
  const saved = localStorage.getItem(MODEL_STORAGE_KEY) || "";
  return THREADS_AI_MODELS.some((m) => m.id === saved)
    ? (saved as ThreadsAiModel)
    : DEFAULT_THREADS_AI_MODEL;
}

export function setThreadsModel(model: ThreadsAiModel) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_STORAGE_KEY, model);
}

// fetchラッパー: エラー時はメッセージを投げる
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `エラー (${res.status})`);
  }
  return data as T;
}

// 画像ファイルを縮小してdata URL化（スクショ読み取り用。長辺maxDimpxのJPEGに圧縮）
export async function filesToDataUrls(files: File[], maxDim = 1600, maxCount = 5): Promise<string[]> {
  const targets = files.filter((f) => f.type.startsWith("image/")).slice(0, maxCount);
  const results: string[] = [];
  for (const file of targets) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      results.push(canvas.toDataURL("image/jpeg", 0.85));
      bitmap.close();
    } catch {
      continue;
    }
  }
  return results;
}

// 数値の表示用フォーマット（12000 → 1.2万）
export function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  return String(n);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// datetime-local input用（ローカルタイム）
export function toLocalInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 参考投稿スナップショットの型（クライアント表示用）
export interface RefSnapshotView {
  postId?: string;
  authorHandle?: string;
  content?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  views?: number;
  postUrl?: string;
  postedAt?: string | null;
}

export function parseSnapshot(json: string | undefined): RefSnapshotView | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as RefSnapshotView;
    return obj && obj.content ? obj : null;
  } catch {
    return null;
  }
}

export const DRAFT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-neutral-800 text-neutral-300" },
  approved: { label: "承認済", cls: "bg-blue-500/20 text-blue-300" },
  scheduled: { label: "予約中", cls: "bg-amber-500/20 text-amber-300" },
  published: { label: "投稿済", cls: "bg-emerald-500/20 text-emerald-300" },
  rejected: { label: "却下", cls: "bg-rose-500/20 text-rose-300" },
};
