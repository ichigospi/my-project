"use client";

// 生成履歴 / ギャラリー画面。
// - 成功画像のグリッド表示（クリックで詳細パネル）
// - 失敗分もフィルタで見られる
// - 詳細パネル: 拡大表示 + パラメータ + seed + DL + 削除
//
// 後フェーズ候補: 再生成（プロンプトをメイン画面にロード）、
//                 バッチグルーピング（同じ runpodJobId でまとめる）

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "@/components/clsx";

interface GenerationItem {
  id: string;
  createdAt: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  seed: string;
  runpodJobId: string | null;
  status: string;
  delayTimeMs: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
  imagePath: string | null;
}

type StatusFilter = "all" | "completed" | "failed";

function imageUrlOf(item: GenerationItem): string | null {
  if (!item.imagePath) return null;
  const basename = item.imagePath.split("/").pop();
  return basename ? `/api/image/${basename}` : null;
}

export default function HistoryPage() {
  const [items, setItems] = useState<GenerationItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  // reload は filter 変更時の useEffect で自動実行されるので不要

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch(`/api/history?status=${filter}&limit=200`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: GenerationItem[] };
        if (!aborted) setItems(data.items);
      } catch (e) {
        if (!aborted) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      aborted = true;
    };
  }, [filter]);

  const filtered = useMemo(() => items ?? [], [items]);
  const active = useMemo(
    () => (activeId ? filtered.find((x) => x.id === activeId) ?? null : null),
    [activeId, filtered],
  );

  async function handleDelete(item: GenerationItem) {
    if (!window.confirm("この生成履歴と画像を削除します。よろしいですか？")) return;
    const res = await fetch(`/api/history/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => (prev ?? []).filter((x) => x.id !== item.id));
      if (activeId === item.id) setActiveId(null);
    } else {
      alert("削除に失敗しました");
    }
  }

  function switchFilter(f: StatusFilter) {
    setFilter(f);
    // useEffect が filter 変更を検知して自動で再取得する
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          読み込み失敗: {loadError}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-200">
            ← 生成画面へ
          </Link>
          <h1 className="text-xl font-bold">📸 履歴 / ギャラリー</h1>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-gray-900 p-1">
          {(["all", "completed", "failed"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => switchFilter(f)}
              className={clsx(
                "rounded px-2.5 py-1 text-[11px]",
                filter === f
                  ? "bg-indigo-500 text-white"
                  : "text-gray-400 hover:bg-gray-800",
              )}
            >
              {f === "all" ? "すべて" : f === "completed" ? "成功のみ" : "失敗のみ"}
            </button>
          ))}
        </div>
      </header>

      {items === null ? (
        <p className="text-sm text-gray-400">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-700 p-8 text-center text-xs text-gray-500">
          履歴がまだありません。生成画面で画像を生成してみてください。
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((it) => {
            const url = imageUrlOf(it);
            const completed = it.status === "completed";
            return (
              <li
                key={it.id}
                className={clsx(
                  "group relative overflow-hidden rounded-md border bg-gray-900/60",
                  completed ? "border-gray-800" : "border-red-900/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(it.id)}
                  className="block w-full text-left"
                >
                  {completed && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-red-950/40 text-[10px] text-red-300">
                      FAILED
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="truncate text-[10px] text-gray-400" title={it.prompt}>
                      {it.prompt}
                    </p>
                    <p className="mt-0.5 flex items-center justify-between text-[9px] text-gray-600">
                      <span>{new Date(it.createdAt).toLocaleString("ja-JP")}</span>
                      <span>
                        {it.width}×{it.height}
                      </span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 詳細パネル（モーダル風） */}
      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
          onClick={() => setActiveId(null)}
        >
          <div
            className="relative mt-10 w-full max-w-4xl rounded-lg border border-gray-800 bg-gray-950 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-200"
            >
              閉じる ✕
            </button>

            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              {active.status === "completed" && imageUrlOf(active) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrlOf(active) ?? ""}
                  alt=""
                  className="max-h-[80vh] w-full rounded-md border border-gray-800 object-contain"
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-md border border-red-900 bg-red-950/40 text-sm text-red-300">
                  {active.errorMessage ?? "画像なし"}
                </div>
              )}

              <div className="text-[11px] text-gray-400">
                <h2 className="mb-2 text-sm font-semibold text-gray-200">詳細</h2>
                <dl className="space-y-1.5">
                  <InfoRow label="作成" value={new Date(active.createdAt).toLocaleString("ja-JP")} />
                  <InfoRow label="状態" value={active.status} />
                  <InfoRow
                    label="サイズ"
                    value={`${active.width} × ${active.height}`}
                  />
                  <InfoRow
                    label="品質"
                    value={`steps ${active.steps} / cfg ${active.cfg}`}
                  />
                  <InfoRow label="sampler" value={active.sampler} />
                  <InfoRow label="seed" value={active.seed} mono />
                  <InfoRow label="model" value={active.model} mono truncate />
                  {active.runpodJobId ? (
                    <InfoRow label="runpod job" value={active.runpodJobId} mono truncate />
                  ) : null}
                  {active.executionTimeMs != null ? (
                    <InfoRow
                      label="時間"
                      value={`delay ${active.delayTimeMs ?? 0}ms / exec ${active.executionTimeMs}ms`}
                    />
                  ) : null}
                </dl>

                <h3 className="mb-1 mt-3 text-xs font-semibold text-gray-300">
                  プロンプト
                </h3>
                <p className="whitespace-pre-wrap break-words font-mono text-[10px] text-gray-400">
                  {active.prompt}
                </p>

                {active.negativePrompt ? (
                  <>
                    <h3 className="mb-1 mt-3 text-xs font-semibold text-gray-300">
                      ネガティブ
                    </h3>
                    <p className="whitespace-pre-wrap break-words font-mono text-[10px] text-gray-500">
                      {active.negativePrompt}
                    </p>
                  </>
                ) : null}

                {active.errorMessage ? (
                  <>
                    <h3 className="mb-1 mt-3 text-xs font-semibold text-red-300">
                      エラー
                    </h3>
                    <p className="whitespace-pre-wrap break-words text-[10px] text-red-300">
                      {active.errorMessage}
                    </p>
                  </>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {active.status === "completed" && imageUrlOf(active) ? (
                    <a
                      href={imageUrlOf(active) ?? ""}
                      download
                      className="rounded-md bg-gray-800 px-3 py-1.5 text-[11px] hover:bg-gray-700"
                    >
                      💾 ダウンロード
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(active)}
                    className="rounded-md bg-red-900/40 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-900/70"
                  >
                    🗑 削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-gray-500">{label}</dt>
      <dd
        className={clsx(
          "min-w-0 flex-1 text-gray-300",
          mono && "font-mono",
          truncate && "truncate",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
