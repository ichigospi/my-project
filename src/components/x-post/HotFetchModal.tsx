// 全競合からホット投稿を一括取得するモーダル
"use client";

import { useState } from "react";

interface Props {
  genre: "business" | "spiritual";
  onClose: () => void;
  onFetched: () => void;
}

interface PerCompetitorResult {
  competitorId: string;
  handle: string;
  status: "ok" | "skipped" | "error";
  fetched: number;
  hot: number;
  saved: number;
  skipped: number;
  error?: string;
}

interface BatchResponse {
  results: PerCompetitorResult[];
  totalCompetitors?: number;
  totalHot: number;
  totalSaved?: number;
  error?: string;
}

export default function HotFetchModal({ genre, onClose, onFetched }: Props) {
  const [hoursWithin, setHoursWithin] = useState(24);
  const [minImpressions, setMinImpressions] = useState(10000);
  const [minLikes, setMinLikes] = useState(0);
  const [minRetweets, setMinRetweets] = useState(0);
  const [maxPerAccount, setMaxPerAccount] = useState(30);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    if (minImpressions === 0 && minLikes === 0 && minRetweets === 0) {
      setError("閾値を最低1つ指定してください");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/x-post/competitors/batch-hot-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          hoursWithin,
          minImpressions,
          minLikes,
          minRetweets,
          maxPerAccount,
        }),
      });
      const data = (await res.json()) as BatchResponse;
      if (!res.ok) {
        setError(data.error || "実行失敗");
        if (data.results) setResult(data);
        return;
      }
      setResult(data);
      onFetched();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">🔥 ホットポスト一括取得</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
            <p><strong>このジャンルの全競合からX APIで最近の投稿を取得し、閾値を超えたものだけを保存します。</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>X API Bearer Token が必須（設定モーダルで登録済みか確認）</li>
              <li>X APIのレート制限に注意（多すぎる競合数だと途中で止まる場合あり）</li>
              <li>インプレッション数は API 仕様により取得できない場合があります → いいね/RT閾値で代用推奨</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">時間窓（投稿後N時間以内）</label>
              <input
                type="number"
                min={1}
                max={168}
                value={hoursWithin}
                onChange={(e) => setHoursWithin(Math.max(1, Math.min(168, Number(e.target.value) || 24)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <p className="text-xs text-gray-500 mt-0.5">24h = 1日 / 168h = 7日</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">1アカウント最大取得数</label>
              <input
                type="number"
                min={5}
                max={100}
                value={maxPerAccount}
                onChange={(e) => setMaxPerAccount(Math.max(5, Math.min(100, Number(e.target.value) || 30)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">閾値（いずれか1つでも超えればホット判定）</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">インプ最小</label>
                <input
                  type="number"
                  min={0}
                  value={minImpressions}
                  onChange={(e) => setMinImpressions(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">いいね最小</label>
                <input
                  type="number"
                  min={0}
                  value={minLikes}
                  onChange={(e) => setMinLikes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">RT最小</label>
                <input
                  type="number"
                  min={0}
                  value={minRetweets}
                  onChange={(e) => setMinRetweets(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-900">
                ✓ {result.totalCompetitors ?? result.results.length} 件の競合をスキャン
                / 🔥 {result.totalHot} 件がホット判定
                / 💾 {result.totalSaved ?? 0} 件を新規保存
              </div>
              <div className="border border-gray-200 rounded max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-gray-600">
                      <th className="px-2 py-1.5 text-left">アカウント</th>
                      <th className="px-2 py-1.5 text-right">取得</th>
                      <th className="px-2 py-1.5 text-right">🔥</th>
                      <th className="px-2 py-1.5 text-right">保存</th>
                      <th className="px-2 py-1.5 text-left">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.competitorId} className="border-t border-gray-100">
                        <td className="px-2 py-1 text-gray-800 truncate max-w-[140px]">@{r.handle}</td>
                        <td className="px-2 py-1 text-right text-gray-600">{r.fetched}</td>
                        <td className="px-2 py-1 text-right font-medium text-rose-700">{r.hot}</td>
                        <td className="px-2 py-1 text-right font-medium text-emerald-700">{r.saved}</td>
                        <td className="px-2 py-1 text-gray-500 truncate max-w-[180px]" title={r.error}>
                          {r.status === "error" ? `❌ ${r.error}` : r.status === "ok" ? "✓" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded"
          >
            {result ? "閉じる" : "キャンセル"}
          </button>
          <button
            onClick={execute}
            disabled={running}
            className="text-sm bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white px-4 py-1.5 rounded"
          >
            {running ? "実行中..." : result ? "もう一度実行" : "🔥 ホット取得実行"}
          </button>
        </div>
      </div>
    </div>
  );
}
