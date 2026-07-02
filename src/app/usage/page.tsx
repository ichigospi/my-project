"use client";

import { useState, useEffect } from "react";
import { AI_MODEL_OPTIONS } from "@/lib/ai-model";

interface ModelEntry { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
interface DayRecord { date: string; models: Record<string, ModelEntry> }

const JPY_RATE = 150; // 概算表示用の固定レート

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-8": "Opus 4.8",
  "claude-fable-5": "Fable 5",
  "gpt-4o": "GPT-4o",
};

function modelLabel(id: string): string {
  return MODEL_LABELS[id] || id.replace(/-\d{8}$/, "");
}

function sumDay(d: DayRecord): { calls: number; inputTokens: number; outputTokens: number; costUsd: number } {
  return Object.values(d.models).reduce(
    (acc, m) => ({ calls: acc.calls + m.calls, inputTokens: acc.inputTokens + m.inputTokens, outputTokens: acc.outputTokens + m.outputTokens, costUsd: acc.costUsd + m.costUsd }),
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(n >= 10 ? 2 : 3)}`;
}
function fmtJpy(n: number): string {
  return `約¥${Math.round(n * JPY_RATE).toLocaleString()}`;
}
function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsagePage() {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setDays(d.days || []);
      })
      .catch(() => setError("使用量の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  // JSTの今日・今月
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const thisMonth = todayStr.slice(0, 7);

  const todayTotal = days.filter((d) => d.date === todayStr).map(sumDay)[0] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const monthDays = days.filter((d) => d.date.startsWith(thisMonth));
  const monthTotal = monthDays.map(sumDay).reduce(
    (a, b) => ({ calls: a.calls + b.calls, inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, costUsd: a.costUsd + b.costUsd }),
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );

  // 月別集計（モデル別内訳つき）
  const monthly = new Map<string, Record<string, ModelEntry>>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    const bucket = monthly.get(m) || {};
    for (const [model, e] of Object.entries(d.models)) {
      const cur = bucket[model] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      bucket[model] = { calls: cur.calls + e.calls, inputTokens: cur.inputTokens + e.inputTokens, outputTokens: cur.outputTokens + e.outputTokens, costUsd: cur.costUsd + e.costUsd };
    }
    monthly.set(m, bucket);
  }
  const monthlyRows = [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const renderModels = (models: Record<string, ModelEntry>) => (
    <div className="space-y-0.5">
      {Object.entries(models).sort((a, b) => b[1].costUsd - a[1].costUsd).map(([model, e]) => (
        <div key={model} className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium w-20 shrink-0">{modelLabel(model)}</span>
          <span className="text-gray-400">{e.calls}回</span>
          <span className="text-gray-400">入力{fmtTok(e.inputTokens)} / 出力{fmtTok(e.outputTokens)}</span>
          <span className="font-medium text-gray-700 ml-auto">{fmtUsd(e.costUsd)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">API使用料</h1>
        <p className="text-gray-500 mt-1 text-sm">台本ツールのAI API使用量とモデル使用料の概算（円は1ドル{JPY_RATE}円換算の目安）</p>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}

      {!loading && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">今日（{todayStr}）</p>
              <p className="text-2xl font-bold">{fmtUsd(todayTotal.costUsd)} <span className="text-sm font-normal text-gray-400">{fmtJpy(todayTotal.costUsd)}</span></p>
              <p className="text-xs text-gray-400 mt-1">{todayTotal.calls}回 / 入力{fmtTok(todayTotal.inputTokens)}・出力{fmtTok(todayTotal.outputTokens)}トークン</p>
            </div>
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">今月（{thisMonth}）</p>
              <p className="text-2xl font-bold">{fmtUsd(monthTotal.costUsd)} <span className="text-sm font-normal text-gray-400">{fmtJpy(monthTotal.costUsd)}</span></p>
              <p className="text-xs text-gray-400 mt-1">{monthTotal.calls}回 / 入力{fmtTok(monthTotal.inputTokens)}・出力{fmtTok(monthTotal.outputTokens)}トークン</p>
            </div>
          </div>

          {/* モデル料金の注意書き */}
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs font-medium text-blue-800 mb-1">モデルの目安（料金は入力/出力 100万トークンあたり）</p>
            <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
              {AI_MODEL_OPTIONS.map((o) => <li key={o.id}><strong>{o.label}</strong>：{o.desc}</li>)}
            </ul>
          </div>

          {/* 表示切り替え */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setView("daily")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "daily" ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              日別
            </button>
            <button onClick={() => setView("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "monthly" ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              月別
            </button>
          </div>

          {days.length === 0 && (
            <p className="text-sm text-gray-500">まだ使用記録がありません。台本の生成・チェックを実行すると自動で記録されます。</p>
          )}

          {/* 日別 */}
          {view === "daily" && days.length > 0 && (
            <div className="space-y-3">
              {days.map((d) => {
                const t = sumDay(d);
                return (
                  <div key={d.date} className="bg-card-bg rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">{d.date}</p>
                      <p className="text-sm font-bold">{fmtUsd(t.costUsd)} <span className="text-xs font-normal text-gray-400">{fmtJpy(t.costUsd)}</span></p>
                    </div>
                    {renderModels(d.models)}
                  </div>
                );
              })}
            </div>
          )}

          {/* 月別 */}
          {view === "monthly" && monthlyRows.length > 0 && (
            <div className="space-y-3">
              {monthlyRows.map(([month, models]) => {
                const t = Object.values(models).reduce(
                  (a, b) => ({ calls: a.calls + b.calls, inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, costUsd: a.costUsd + b.costUsd }),
                  { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
                );
                return (
                  <div key={month} className="bg-card-bg rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">{month}</p>
                      <p className="text-sm font-bold">{fmtUsd(t.costUsd)} <span className="text-xs font-normal text-gray-400">{fmtJpy(t.costUsd)}</span></p>
                    </div>
                    {renderModels(models)}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-6">
            ※ 台本作成フロー（骨組み・台本生成・修正・品質チェック）のAPI呼び出しを記録しています。金額はモデルの公表単価から算出した概算で、実際の請求はAnthropic/OpenAIの管理画面で確認してください。Whisper音声書き起こし・X投稿ツール等は未計上です。
          </p>
        </>
      )}
    </div>
  );
}
