"use client";

// 企画の「編集中ロック」のクライアント側。
// 開いている間は60秒ごとにハートビート、閉じたら解放。他の人が編集中なら lockedBy を返す（閲覧は止めない）。
import { useEffect, useRef, useState } from "react";

export interface ProjectLock { userId: string; userName: string; role: string; since: string; at: string }

const HEARTBEAT_MS = 60_000;

async function post(projectId: string, action: "acquire" | "heartbeat" | "release" | "takeover"): Promise<{ ok: boolean; lock?: ProjectLock; lockedBy?: ProjectLock; me?: string; error?: string }> {
  try {
    const res = await fetch("/api/projects/lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, action }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d as { error?: string }).error || `HTTP ${res.status}` };
    return d as { ok: boolean; lock?: ProjectLock; lockedBy?: ProjectLock; me?: string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useProjectLock(projectId: string | null | undefined) {
  const [lockedBy, setLockedBy] = useState<ProjectLock | null>(null);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState("");
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    idRef.current = projectId || null;
    setLockedBy(null); setMine(false); setError("");
    if (!projectId) return;
    let stopped = false;
    const tick = async (action: "acquire" | "heartbeat") => {
      const r = await post(projectId, action);
      if (stopped) return;
      if (r.error) { setError(r.error); return; }
      if (r.ok) { setMine(true); setLockedBy(null); }
      else if (r.lockedBy) { setMine(false); setLockedBy(r.lockedBy); }
    };
    tick("acquire");
    const timer = setInterval(() => tick("heartbeat"), HEARTBEAT_MS);
    const release = () => {
      // タブを閉じるときも確実に届くよう sendBeacon を使う
      try {
        const blob = new Blob([JSON.stringify({ projectId, action: "release" })], { type: "application/json" });
        navigator.sendBeacon("/api/projects/lock", blob);
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", release);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("beforeunload", release);
      void post(projectId, "release");
    };
  }, [projectId]);

  const takeover = async () => {
    if (!idRef.current) return;
    const r = await post(idRef.current, "takeover");
    if (r.ok) { setMine(true); setLockedBy(null); setError(""); }
    else setError(r.error || "引き継ぎに失敗しました");
  };

  return { lockedBy, mine, error, takeover };
}

// 一覧用: 複数企画のロック状態をまとめて取得
export async function fetchProjectLocks(ids: string[]): Promise<{ locks: Record<string, ProjectLock>; me: string }> {
  if (ids.length === 0) return { locks: {}, me: "" };
  try {
    const res = await fetch(`/api/projects/lock?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { locks: {}, me: "" };
    return { locks: (d.locks || {}) as Record<string, ProjectLock>, me: String(d.me || "") };
  } catch {
    return { locks: {}, me: "" };
  }
}

export function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}
