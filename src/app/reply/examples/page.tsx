// 実例集: 過去の「お客様メッセージ → 実際の返信」ペア（CRUD）
"use client";

import { useCallback, useEffect, useState } from "react";
import { REPLY_CATEGORIES, REPLY_STAGES, categoryLabel, stageLabel } from "@/lib/reply-prompts";

interface Example {
  id: string;
  category: string;
  stage: string;
  customerMessage: string;
  replyMessage: string;
  note: string;
  source: string;
  createdAt: string;
}

const EMPTY_FORM = { category: "general", stage: "", customerMessage: "", replyMessage: "", note: "" };

export default function ReplyExamplesPage() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/reply/examples");
    const data = await res.json();
    if (res.ok) setExamples(data);
    else setError(data.error || "読み込みに失敗しました");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.customerMessage.trim() || !form.replyMessage.trim()) {
      setError("お客様メッセージと返信文は必須です");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/reply/examples/${editingId}` : "/api/reply/examples", {
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

  const remove = async (id: string) => {
    if (!confirm("この実例を削除しますか？")) return;
    await fetch(`/api/reply/examples/${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (e: Example) => {
    setEditingId(e.id);
    setForm({ category: e.category, stage: e.stage || "", customerMessage: e.customerMessage, replyMessage: e.replyMessage, note: e.note });
    setShowForm(true);
  };

  const filtered = filter ? examples.filter((e) => e.category === filter) : examples;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          実際のやりとりを登録するほど、文体と判断の再現度が上がります。まずは20件を目標に。
        </p>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
          }}
          className="shrink-0 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
        >
          {showForm ? "閉じる" : "+ 実例を追加"}
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
              title="どの段階のお客様とのやりとりか"
            >
              <option value="">段階: 共通</option>
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
          </div>
          <textarea
            value={form.customerMessage}
            onChange={(e) => setForm({ ...form, customerMessage: e.target.value })}
            placeholder="お客様からのメッセージ"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={form.replyMessage}
            onChange={(e) => setForm({ ...form, replyMessage: e.target.value })}
            placeholder="実際に返した文（オーナーの文体そのまま）"
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="メモ（任意）: この返信のポイント"
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === "" ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
        >
          すべて（{examples.length}）
        </button>
        {REPLY_CATEGORIES.map((c) => {
          const count = examples.filter((e) => e.category === c.value).length;
          if (count === 0) return null;
          return (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === c.value ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
            >
              {c.emoji} {c.label}（{count}）
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">実例がまだありません</p>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-purple-600">{categoryLabel(e.category)}</span>
              {e.stage && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-600">{stageLabel(e.stage)}</span>
              )}
              {e.source === "learned" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-600">自動追加</span>
              )}
              {e.note && <span className="text-xs text-gray-400">※ {e.note}</span>}
              <div className="ml-auto flex gap-2 text-xs">
                <button onClick={() => startEdit(e)} className="text-gray-500 hover:text-gray-900">編集</button>
                <button onClick={() => remove(e.id)} className="text-red-400 hover:text-red-600">削除</button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-gray-400 mb-1">お客様</p>
                <p className="text-gray-700 whitespace-pre-wrap">{e.customerMessage}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-purple-400 mb-1">返信</p>
                <p className="text-gray-700 whitespace-pre-wrap">{e.replyMessage}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
