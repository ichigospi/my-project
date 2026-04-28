"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import { getApiKey } from "@/lib/channel-store";
import { DEFAULT_X_POST_MODEL, X_POST_MODEL_LABELS, type XPostModel } from "@/lib/x-post-ai";
import {
  CONNECTION_TYPES,
  parseDailyPlan,
  type XDailyPlanRecord,
  type DailyPlanSlot,
  type EducationType,
  type ConnectionType,
  EDUCATION_TYPES,
} from "@/lib/x-post-types";
import SettingsModal from "@/components/x-post/SettingsModal";

const CONNECTION_LABEL: Record<ConnectionType | "", string> = {
  "": "（最終）",
  quote_rt: "↪ 引用RT",
  consecutive: "↓ 連投",
  independent: "·  独立",
  story_chain: "→ ストーリー連投",
};

const todayString = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
})();

interface ApiPlan {
  id: string;
  genre: string;
  date: string;
  slots: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function DailyPlanPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  const [date, setDate] = useState(todayString);
  const [plan, setPlan] = useState<XDailyPlanRecord | null>(null);
  const [history, setHistory] = useState<XDailyPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<XPostModel>(DEFAULT_X_POST_MODEL);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        fetch(`/api/x-post/daily-plans?genre=${genre}&date=${date}`),
        fetch(`/api/x-post/daily-plans?genre=${genre}`),
      ]);
      const pData: ApiPlan[] = await pRes.json();
      const hData: ApiPlan[] = await hRes.json();
      setPlan(pData[0] ? parseDailyPlan(pData[0]) : null);
      setHistory(hData.map(parseDailyPlan));
    } finally {
      setLoading(false);
    }
  }, [genre, date]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const generate = async (withAi: boolean) => {
    setError(null);
    if (withAi) {
      const aiKey = getApiKey("ai_api_key");
      if (!aiKey) {
        setError("AI APIキーが未設定です。YTツール側の設定ページから登録してください。");
        return;
      }
    }
    setGenerating(true);
    try {
      const aiKey = withAi ? getApiKey("ai_api_key") : undefined;
      const res = await fetch("/api/x-post/daily-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          date,
          aiApiKey: aiKey,
          model,
          customInstruction: customInstruction.trim() || undefined,
          withAiThemes: withAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "プラン生成失敗");
        return;
      }
      loadPlan();
      setCustomInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const updateSlot = async (slotIndex: number, patch: Partial<DailyPlanSlot>) => {
    if (!plan) return;
    const newSlots = plan.slots.map((s, i) => i === slotIndex ? { ...s, ...patch } : s);
    const updated: XDailyPlanRecord = { ...plan, slots: newSlots };
    setPlan(updated);
    await fetch(`/api/x-post/daily-plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: JSON.stringify(newSlots) }),
    });
  };

  const completedCount = plan?.slots.filter((s) => s.status === "posted").length ?? 0;

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📅</span>
            デイリープラン
            <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            教育バランスを見て今日の5ポストを構成。AIが各スロットのテーマも提案します。
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm rounded transition-colors"
        >
          ⚙️ 設定
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      {/* 日付選択 + 生成 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700">日付:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={() => setDate(todayString)}
            className="text-xs text-indigo-600 hover:underline"
          >
            今日に戻す
          </button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-700">追加指示・モデル選択</summary>
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">追加指示（任意）</label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
                placeholder="例: 今日はローンチ前なのでアフィ参戦の伏線を強めに"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">モデル:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as XPostModel)}
                className="px-2 py-1 border border-gray-300 rounded text-xs flex-1"
              >
                {Object.entries(X_POST_MODEL_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => generate(true)}
            disabled={generating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded transition-colors"
          >
            {generating ? "🤖 生成中..." : plan ? "✨ AIテーマ込みで再生成" : "✨ AIテーマ込みで生成"}
          </button>
          <button
            onClick={() => generate(false)}
            disabled={generating}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 text-sm font-medium rounded transition-colors"
          >
            🛠️ スロット構造のみ
          </button>
        </div>
      </div>

      {/* プラン本体 */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">読み込み中...</div>
      ) : !plan ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-gray-500 text-sm">この日のプランはまだ作成されていません</p>
          <p className="text-xs text-gray-400 mt-1">上のボタンから生成してください</p>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-900">
              {plan.slots.length}スロット構成 ({completedCount}/{plan.slots.length} 投稿済)
            </h3>
            <span className="text-xs text-gray-500">
              更新: {new Date(plan.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            {plan.slots.map((slot, i) => (
              <SlotCard
                key={i}
                slot={slot}
                planId={plan.id}
                isLast={i === plan.slots.length - 1}
                onUpdate={(patch) => updateSlot(i, patch)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 履歴 */}
      <section className="mt-8">
        <h3 className="text-base font-bold text-gray-900 mb-2">📚 過去のプラン</h3>
        {history.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
            まだ履歴がありません
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {history.slice(0, 30).map((h) => (
              <button
                key={h.id}
                onClick={() => setDate(h.date)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${
                  h.date === date ? "bg-indigo-50" : ""
                }`}
              >
                <div>
                  <span className="font-medium text-gray-900">{h.date}</span>
                  <span className="ml-3 text-xs text-gray-500">{h.slots.length}スロット</span>
                </div>
                <div className="text-xs text-gray-500 truncate max-w-[60%]">
                  {h.slots.map((s) => s.educationType).filter(Boolean).join(" / ") || "(未生成)"}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </main>
  );
}

// ============================================================
// SlotCard
// ============================================================

function SlotCard({ slot, planId, isLast, onUpdate }: {
  slot: DailyPlanSlot;
  planId: string;
  isLast: boolean;
  onUpdate: (patch: Partial<DailyPlanSlot>) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <div className="bg-indigo-100 text-indigo-700 font-bold rounded w-8 h-8 flex items-center justify-center shrink-0 text-sm">
          {slot.slot}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <select
              value={slot.educationType}
              onChange={(e) => onUpdate({ educationType: e.target.value as EducationType | "" })}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border-0 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">(未指定)</option>
              {EDUCATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}の教育</option>
              ))}
            </select>
            {slot.hookType && (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                🎣 {slot.hookType}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {slot.status === "posted" ? "✅ 投稿済" : slot.status === "generated" ? "✏️ 生成済" : "📝 下書き"}
            </span>
          </div>

          {slot.theme ? (
            <p className="text-sm text-gray-800 mb-1 whitespace-pre-wrap">{slot.theme}</p>
          ) : (
            <p className="text-sm text-gray-400 mb-1 italic">（テーマ未設定）</p>
          )}

          {slot.reasoning && (
            <p className="text-xs text-gray-500 italic">理由: {slot.reasoning}</p>
          )}

          {editing && (
            <div className="mt-3 space-y-2 bg-gray-50 rounded p-2">
              <textarea
                value={slot.theme}
                onChange={(e) => onUpdate({ theme: e.target.value })}
                rows={3}
                placeholder="テーマを編集"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={slot.hookType}
                  onChange={(e) => onUpdate({ hookType: e.target.value })}
                  placeholder="フックタイプ"
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                />
                {!isLast && (
                  <select
                    value={slot.connectionType || "consecutive"}
                    onChange={(e) => onUpdate({ connectionType: e.target.value as ConnectionType })}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    {CONNECTION_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded"
          >
            {editing ? "閉じる" : "編集"}
          </button>
          <Link
            href={`/x-post/create?from=daily&planId=${planId}&slot=${slot.slot}&education=${encodeURIComponent(slot.educationType)}&theme=${encodeURIComponent(slot.theme)}&hook=${encodeURIComponent(slot.hookType ?? "")}`}
            className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-center"
          >
            ✏️ 生成
          </Link>
        </div>
      </div>
      {!isLast && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-1 text-xs text-gray-500 text-center">
          {CONNECTION_LABEL[slot.connectionType] || "↓ 連投"}
        </div>
      )}
    </div>
  );
}
