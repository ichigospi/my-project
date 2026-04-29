// 取得済みポストのクリーンアップモーダル
"use client";

import { useState, useEffect, useCallback } from "react";
import type { XCompetitor } from "@/lib/x-post-types";

interface Props {
  competitor: XCompetitor;
  onClose: () => void;
  onCleaned: () => void;
}

interface PreviewResponse {
  total: number;
  duplicatesFound: number;
  zeroImpFound: number;
  totalToDelete: number;
  remaining: number;
  dryRun: boolean;
}

export default function CleanupModal({ competitor, onClose, onCleaned }: Props) {
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [removeZeroImpressions, setRemoveZeroImpressions] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    if (!removeDuplicates && !removeZeroImpressions) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/x-post/posts/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: competitor.id,
          removeDuplicates,
          removeZeroImpressions,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "プレビュー失敗");
        return;
      }
      setPreview(data);
    } finally {
      setPreviewing(false);
    }
  }, [competitor.id, removeDuplicates, removeZeroImpressions]);

  useEffect(() => {
    runPreview();
  }, [runPreview]);

  const execute = async () => {
    if (!preview || preview.totalToDelete === 0) return;
    if (!confirm(`${preview.totalToDelete}件のポストを削除します。よろしいですか？\n（取り消せません。再インポートで戻せます）`)) {
      return;
    }
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/x-post/posts/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: competitor.id,
          removeDuplicates,
          removeZeroImpressions,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "削除失敗");
        return;
      }
      setDone(data);
      onCleaned();
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">🧹 クリーンアップ</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              対象: 🪞 @{competitor.handle}{competitor.name && `（${competitor.name}）`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={removeDuplicates}
                onChange={(e) => setRemoveDuplicates(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-gray-900">完全一致の重複を削除</div>
                <div className="text-xs text-gray-500">
                  本文が完全に同じポストが複数ある場合、インプ・いいね・日付情報が一番揃ってる1件を残して他を削除
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={removeZeroImpressions}
                onChange={(e) => setRemoveZeroImpressions(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-gray-900">インプレッション 0 のポストを削除</div>
                <div className="text-xs text-gray-500">
                  分析対象として使えないポスト（CSV未対応・古い投稿等）を除去
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {previewing && (
            <div className="text-xs text-gray-500">プレビュー中...</div>
          )}

          {preview && !done && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1 text-sm">
              <div className="font-medium text-gray-900">プレビュー</div>
              <div className="text-xs text-gray-700 space-y-0.5">
                <div>現在のポスト数: <strong>{preview.total}</strong> 件</div>
                {removeDuplicates && (
                  <div>重複として削除: <strong className="text-rose-700">{preview.duplicatesFound}</strong> 件</div>
                )}
                {removeZeroImpressions && (
                  <div>インプ0として削除: <strong className="text-rose-700">{preview.zeroImpFound}</strong> 件</div>
                )}
                <div className="pt-1 border-t border-gray-200">
                  削除合計: <strong className="text-rose-700">{preview.totalToDelete}</strong> 件
                  → 残り <strong className="text-emerald-700">{preview.total - preview.totalToDelete}</strong> 件
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-900">
              ✓ {done.totalToDelete} 件削除しました（残り {done.remaining} 件）
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded"
          >
            {done ? "閉じる" : "キャンセル"}
          </button>
          {!done && (
            <button
              onClick={execute}
              disabled={executing || !preview || preview.totalToDelete === 0}
              className="text-sm bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white px-4 py-1.5 rounded"
            >
              {executing
                ? "削除中..."
                : preview && preview.totalToDelete > 0
                  ? `${preview.totalToDelete}件を削除`
                  : "削除対象なし"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
