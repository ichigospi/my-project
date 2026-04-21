"use client";

// Active Workers=1 の切り忘れ防止バナー。
//
// 使い方:
//   1. RunPod コンソールで Active Workers=1 にしたら、バナーの「ON 化した」ボタンを押す
//   2. バナーが赤くなって経過時間 + 推定課金を常時表示
//   3. 30 分ごとにブラウザ通知 + タブタイトルに警告金額
//   4. 使い終わったら「OFF 化完了」ボタンで警告解除
//
// 状態は localStorage に保存されるので、タブを閉じても復元される。
// 生成成功時に `window.dispatchEvent(new Event('imgtool-generated'))` が飛ぶ
// 前提で、最終活動時刻を更新する（長時間放置検出用）。

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEYS = {
  enabled: "imgtool.activeMode.enabled",
  startedAt: "imgtool.activeMode.startedAt",
  lastActivity: "imgtool.activeMode.lastActivity",
} as const;

// RTX 4090 の Serverless 単価（2026 年時点の概算）。将来変わったら調整。
const USD_PER_SECOND = 0.00031;
const NOTIFY_INTERVAL_MS = 30 * 60 * 1000; // 30 分ごとに再通知
const IDLE_WARN_MS = 20 * 60 * 1000; // 最後の生成から 20 分でモーダル警告
const IDLE_SNOOZE_MS = 10 * 60 * 1000; // 「まだ使う」で閉じたあと 10 分は再表示しない
const RUNPOD_CONSOLE_URL = "https://console.runpod.io/serverless/";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function formatUsd(usd: number): string {
  if (usd < 0.01) return "$0.00";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

// localStorage の 1 キーを useSyncExternalStore で購読する。
// SSR では null を返してクライアントで再 hydrate。
function useStorageValue(key: string): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key || e.key === null) onStoreChange();
      };
      const localHandler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener(`imgtool-storage-${key}`, localHandler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(`imgtool-storage-${key}`, localHandler);
      };
    },
    () => window.localStorage.getItem(key),
    () => null,
  );
}

// 同一タブ内で setItem しても storage event は飛ばないので、自作イベントで通知。
function writeStorage(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  window.dispatchEvent(new Event(`imgtool-storage-${key}`));
}

export default function ActiveModeBanner() {
  const enabledRaw = useStorageValue(STORAGE_KEYS.enabled);
  const startedAtRaw = useStorageValue(STORAGE_KEYS.startedAt);
  const lastActivityRaw = useStorageValue(STORAGE_KEYS.lastActivity);

  const enabled = enabledRaw === "true";
  const startedAt = startedAtRaw ? Number(startedAtRaw) : null;
  const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;

  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [idleModalOpen, setIdleModalOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const lastNotifyRef = useRef<number>(0);
  // 「まだ使う」で閉じた時刻。IDLE_SNOOZE_MS の間は再表示しない。
  const idleSnoozedUntilRef = useRef<number>(0);

  // 生成イベント → 最終活動時刻を更新
  useEffect(() => {
    function onGenerated() {
      writeStorage(STORAGE_KEYS.lastActivity, String(Date.now()));
      setIdleModalOpen(false);
    }
    window.addEventListener("imgtool-generated", onGenerated);
    return () => window.removeEventListener("imgtool-generated", onGenerated);
  }, []);

  // 1 秒毎の時計更新 + 通知チェック（enabled 時のみ）
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNowTs(t);

      if (t - lastNotifyRef.current >= NOTIFY_INTERVAL_MS) {
        lastNotifyRef.current = t;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const elapsedMs = startedAt ? t - startedAt : 0;
          const cost = (elapsedMs / 1000) * USD_PER_SECOND;
          new Notification("⚠️ Active Workers 稼働中", {
            body: `有効化から ${formatElapsed(elapsedMs)} / 推定 ${formatUsd(cost)}. 不要なら RunPod を OFF に。`,
            tag: "imgtool-active-mode",
          });
        }
      }

      // スヌーズ期間中はモーダル出さない
      if (
        lastActivity &&
        t - lastActivity >= IDLE_WARN_MS &&
        t >= idleSnoozedUntilRef.current
      ) {
        setIdleModalOpen(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, startedAt, lastActivity]);

  // ブラウザタブタイトルに課金額を表示
  useEffect(() => {
    if (!enabled || !startedAt) return;
    const prefixRe = /^⚠️ \$[\d.]+ • /;
    const baseTitle = document.title.replace(prefixRe, "");
    const elapsedMs = nowTs - startedAt;
    const cost = (elapsedMs / 1000) * USD_PER_SECOND;
    document.title = `⚠️ ${formatUsd(cost)} • ${baseTitle}`;
    return () => {
      document.title = baseTitle;
    };
  }, [enabled, startedAt, nowTs]);

  const activate = useCallback(() => {
    const t = Date.now();
    writeStorage(STORAGE_KEYS.enabled, "true");
    writeStorage(STORAGE_KEYS.startedAt, String(t));
    writeStorage(STORAGE_KEYS.lastActivity, String(t));
    lastNotifyRef.current = t;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const deactivate = useCallback(() => {
    writeStorage(STORAGE_KEYS.enabled, "false");
    writeStorage(STORAGE_KEYS.startedAt, null);
    writeStorage(STORAGE_KEYS.lastActivity, null);
    setIdleModalOpen(false);
  }, []);

  if (!enabled) {
    return (
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950 px-3 py-1 text-[10px] text-gray-400">
        <span>
          💸 RunPod で Active Workers=1 にしたら、ここを ON にして切り忘れを防ぎましょう
        </span>
        <button
          type="button"
          onClick={activate}
          className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500"
        >
          ON 化した
        </button>
      </div>
    );
  }

  const elapsedMs = startedAt ? nowTs - startedAt : 0;
  const cost = (elapsedMs / 1000) * USD_PER_SECOND;
  const idleMs = lastActivity ? nowTs - lastActivity : 0;

  if (minimized) {
    return (
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-red-800 bg-red-950 px-3 py-1 text-[11px] text-red-100">
        <button type="button" onClick={() => setMinimized(false)} className="truncate">
          ⚠️ Active Mode ON — {formatElapsed(elapsedMs)} / {formatUsd(cost)}
          <span className="ml-2 text-red-300 underline">展開</span>
        </button>
        <a
          href={RUNPOD_CONSOLE_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-500"
        >
          🛑 RunPod
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b-2 border-red-600 bg-red-950 shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-xs text-red-100">
          <span className="text-base">⚠️</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-100">
              Active Workers=1 有効中 • 課金継続中
            </p>
            <p className="mt-0.5 text-[11px] text-red-200">
              有効化から <strong>{formatElapsed(elapsedMs)}</strong>
              {" / 推定課金 "}
              <strong className="text-yellow-200">{formatUsd(cost)}</strong>
              {lastActivity ? (
                <>
                  {" / 最後の生成から "}
                  <span
                    className={
                      idleMs > IDLE_WARN_MS
                        ? "font-bold text-yellow-300"
                        : "text-red-300"
                    }
                  >
                    {formatElapsed(idleMs)}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={RUNPOD_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-500"
              title="RunPod コンソールを開いて Active Workers=0 に戻す"
            >
              🛑 RunPod で OFF にする
            </a>
            <button
              type="button"
              onClick={deactivate}
              className="rounded border border-red-400/40 bg-red-900/40 px-2.5 py-1 text-[11px] text-red-100 hover:bg-red-900/70"
              title="RunPod で OFF にしたあと、この警告を消す"
            >
              OFF 化完了
            </button>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="rounded border border-red-400/40 bg-red-900/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/70"
              title="バナーを最小化"
            >
              —
            </button>
          </div>
        </div>
      </div>

      {idleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            idleSnoozedUntilRef.current = Date.now() + IDLE_SNOOZE_MS;
            setIdleModalOpen(false);
          }}
        >
          <div
            className="max-w-md rounded-lg border-2 border-red-600 bg-red-950 p-5 text-sm text-red-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-bold text-yellow-200">
              ⚠️ {formatElapsed(idleMs)} 生成していません
            </h3>
            <p className="mb-2 text-[12px] text-red-200">
              もう画像生成を使っていないなら、Active Workers=1 を OFF に戻すのを忘れずに。
              このまま放置すると 1 時間あたり 約 <strong>$1.12</strong> 課金され続けます。
            </p>
            <p className="mb-4 text-[12px] text-red-200">
              現在までの推定: <strong className="text-yellow-200">{formatUsd(cost)}</strong>{" "}
              （{formatElapsed(elapsedMs)}）
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={RUNPOD_CONSOLE_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  idleSnoozedUntilRef.current = Date.now() + IDLE_SNOOZE_MS;
                  setIdleModalOpen(false);
                }}
                className="rounded bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500"
              >
                🛑 RunPod を開いて OFF にする
              </a>
              <button
                type="button"
                onClick={() => {
                  idleSnoozedUntilRef.current = Date.now() + IDLE_SNOOZE_MS;
                  setIdleModalOpen(false);
                }}
                className="rounded border border-red-400/40 bg-red-900/40 px-3 py-1.5 text-[12px] text-red-100 hover:bg-red-900/70"
              >
                まだ使う（10 分スヌーズ）
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
