// Xポストツールの設定モーダル（ジャンル別）
"use client";

import { useEffect, useState } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import {
  EDUCATION_TYPES,
  parseSettings,
  serializeSettings,
  defaultSettings,
  type XSettingsForm,
  type EducationType,
} from "@/lib/x-post-types";
import { X_POST_MODEL_LABELS, type XPostModel } from "@/lib/x-post-ai";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [genre] = useXPostGenre();
  const [form, setForm] = useState<XSettingsForm>(() => defaultSettings(genre));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/x-post/settings?genre=${genre}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setForm(parseSettings(data, genre));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [genre]);

  const updateMinPerDays = (type: EducationType, value: number | undefined) => {
    setForm((prev) => ({
      ...prev,
      educationConfig: {
        ...prev.educationConfig,
        minPerDays: {
          ...prev.educationConfig.minPerDays,
          [type]: value,
        },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/x-post/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeSettings(form)),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`保存失敗: ${e.error || res.statusText}`);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl p-8" onClick={(e) => e.stopPropagation()}>
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">⚙️ Xポストツール設定（{genre === "business" ? "ビジネス系" : "占いスピ系"}）</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1日のポスト本数 */}
          <Section title="🗓️ 投稿本数">
            <Field label="1日のポスト本数">
              <input
                type="number"
                min={1}
                max={20}
                value={form.postsPerDay}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postsPerDay: Math.max(1, Math.min(20, Number(e.target.value) || 5)) }))
                }
                className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </Field>
          </Section>

          {/* 教育バランス */}
          <Section title="📚 教育バランス（最低頻度）">
            <p className="text-xs text-gray-500 mb-3">
              各教育タイプを「最低X日に1回」投稿するルール。デイリープランがこの頻度に基づいて構成されます。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {EDUCATION_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <label className="flex-1 truncate text-gray-700">{t}の教育</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    placeholder="—"
                    value={form.educationConfig.minPerDays[t] ?? ""}
                    onChange={(e) =>
                      updateMinPerDays(t, e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-xs text-gray-500">日に1回</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">空欄: その教育タイプはローテーション対象外</p>
          </Section>

          {/* 接続タイプ使用率 */}
          <Section title="🔗 接続タイプ使用率（合計100%）">
            <p className="text-xs text-gray-500 mb-3">
              スロット間の接続をどんな割合で振るか。引用RTを多めにすると連投シリーズが増えます。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["quoteRtRate", "引用RT"],
                ["consecutiveRate", "連投"],
                ["independentRate", "独立"],
                ["storyChainRate", "ストーリー連投"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex-1 text-sm text-gray-700">{label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.sequenceConfig[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sequenceConfig: { ...f.sequenceConfig, [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                      }))
                    }
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              ))}
            </div>
          </Section>

          {/* デフォルトモデル */}
          <Section title="🤖 AI設定">
            <Field label="デフォルトモデル">
              <select
                value={form.defaultModel}
                onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value as XPostModel }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {Object.entries(X_POST_MODEL_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="X API Bearer Token（任意・自動収集機能で使用予定）">
              <input
                type="password"
                value={form.xApiBearerToken}
                onChange={(e) => setForm((f) => ({ ...f, xApiBearerToken: e.target.value }))}
                placeholder="未設定時は手動ペースト収集のみ"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.spiceEnabled}
                onChange={(e) => setForm((f) => ({ ...f, spiceEnabled: e.target.checked }))}
              />
              <span>強化教育（読む見る/変化/素直/アウトプット/基準値/覚悟）を生成時に自動スパイス</span>
            </label>
          </Section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
            キャンセル
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-sm font-bold text-gray-900 mb-2">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
