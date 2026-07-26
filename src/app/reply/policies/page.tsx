// 判断ルール: オーナーの脳のトレース（CRUD）
"use client";

import { useCallback, useEffect, useState } from "react";
import { REPLY_CATEGORIES, REPLY_STAGES, categoryLabel, stageLabel } from "@/lib/reply-prompts";

interface Policy {
  id: string;
  category: string;
  stage: string;
  title: string;
  situation: string;
  guideline: string;
  priority: number;
  isActive: boolean;
  source: string;
}

const EMPTY_FORM = { category: "general", stage: "", title: "", situation: "", guideline: "", priority: 0 };

export default function ReplyPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/reply/policies");
    const data = await res.json();
    if (res.ok) setPolicies(data);
    else setError(data.error || "読み込みに失敗しました");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.title.trim() || !form.guideline.trim()) {
      setError("ルール名と対応方針は必須です");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/reply/policies/${editingId}` : "/api/reply/policies", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      setShowForm(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Policy) => {
    await fetch(`/api/reply/policies/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("このルールを削除しますか？")) return;
    await fetch(`/api/reply/policies/${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (p: Policy) => {
    setEditingId(p.id);
    setForm({ category: p.category, stage: p.stage || "", title: p.title, situation: p.situation, guideline: p.guideline, priority: p.priority });
    setShowForm(true);
  };

  const grouped = REPLY_CATEGORIES.map((c) => ({
    ...c,
    items: policies.filter((p) => p.category === c.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          「こういう時はこう対応する」というオーナーの判断基準。生成時にAIへ注入されます（編集はオーナー/管理者のみ）。
        </p>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
          }}
          className="shrink-0 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
        >
          {showForm ? "閉じる" : "+ ルールを追加"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <section className="bg-white rounded-xl shadow-sm border border-purple-200 p-5 space-y-3">
          <div className="flex gap-3">
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              title="どの段階のお客様に適用するか"
            >
              <option value="">全段階共通</option>
              {REPLY_STAGES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.emoji} {st.label}
                </option>
              ))}
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {REPLY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="ルール名（例: 返金要求はまず共感）"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              placeholder="優先度"
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              title="優先度（大きいほど優先）"
            />
          </div>
          <input
            value={form.situation}
            onChange={(e) => setForm({ ...form, situation: e.target.value })}
            placeholder="どういう状況のとき（例: 鑑定結果に納得できないという連絡が来たとき）"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={form.guideline}
            onChange={(e) => setForm({ ...form, guideline: e.target.value })}
            placeholder="どう対応するか（例: まず感情を受け止め、規約の説明は2通目以降。即返金の約束はしない）"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {busy ? "保存中..." : editingId ? "更新する" : "追加する"}
          </button>
        </section>
      )}

      {policies.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">
          ルールがまだありません。まずは5〜10個、よくある対応の判断基準を登録しましょう。
        </p>
      )}

      {grouped.map((g) => (
        <section key={g.value} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            {g.emoji} {g.label}
            <span className="ml-2 text-xs font-normal text-gray-400">{g.items.length}件</span>
          </h2>
          <div className="space-y-2">
            {g.items.map((p) => (
              <div
                key={p.id}
                className={`border rounded-lg p-3 flex items-start gap-3 ${p.isActive ? "border-gray-100" : "border-gray-100 opacity-50"}`}
              >
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-gray-900">
                    {p.title}
                    {p.stage && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-600">{stageLabel(p.stage)}</span>
                    )}
                    {p.source === "learned" && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-600">学習</span>
                    )}
                  </p>
                  {p.situation && <p className="text-xs text-gray-500 mt-0.5">状況: {p.situation}</p>}
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap">{p.guideline}</p>
                </div>
                <div className="shrink-0 flex flex-col gap-1 text-xs">
                  <button onClick={() => startEdit(p)} className="text-gray-500 hover:text-gray-900">編集</button>
                  <button onClick={() => toggleActive(p)} className="text-gray-500 hover:text-gray-900">
                    {p.isActive ? "無効化" : "有効化"}
                  </button>
                  <button onClick={() => remove(p.id)} className="text-red-400 hover:text-red-600">削除</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* categoryLabel はどこにも該当しないカテゴリのフォールバック表示に使用 */}
      {policies.filter((p) => !REPLY_CATEGORIES.some((c) => c.value === p.category)).map((p) => (
        <p key={p.id} className="text-xs text-gray-400">未分類ルール: {categoryLabel(p.category)} / {p.title}</p>
      ))}
    </div>
  );
}
