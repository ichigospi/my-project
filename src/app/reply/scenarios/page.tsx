// あるある集: 段階×シーンで探す「こういうときはこう送ろう」例文+解説
"use client";

import { useCallback, useEffect, useState } from "react";
import { REPLY_STAGES, REPLY_CATEGORIES, stageLabel, categoryLabel } from "@/lib/reply-prompts";

interface Scenario {
  id: string;
  stage: string;
  category: string;
  title: string;
  detail: string;
  explanation: string;
  exampleMessage: string;
  source: string;
}

const EMPTY_FORM = { stage: "other", category: "general", title: "", detail: "", explanation: "", exampleMessage: "" };

const STAGE_TABS = [{ value: "", label: "すべて", emoji: "🔎" }, ...REPLY_STAGES.map((s) => ({ ...s }))];

export default function ReplyScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [stageFilter, setStageFilter] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/reply/scenarios");
    const data = await res.json();
    if (res.ok) setScenarios(data);
    else setError(data.error || "読み込みに失敗しました");
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    setError("");
    try {
      const res = await fetch("/api/reply/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "初期セットの読み込みに失敗しました");
        return;
      }
      setMessage(`✓ プロ視点のあるあるを${data.added}件追加しました${data.skipped ? `（既存${data.skipped}件はスキップ）` : ""}`);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const copyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setOpenId(id);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async () => {
    if (!form.title.trim() || !form.exampleMessage.trim()) {
      setError("状況タイトルと例文は必須です");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/reply/scenarios/${editingId}` : "/api/reply/scenarios", {
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
    if (!confirm("このあるあるを削除しますか？")) return;
    await fetch(`/api/reply/scenarios/${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (s: Scenario) => {
    setEditingId(s.id);
    setForm({
      stage: s.stage,
      category: s.category,
      title: s.title,
      detail: s.detail,
      explanation: s.explanation,
      exampleMessage: s.exampleMessage,
    });
    setShowForm(true);
  };

  const q = query.trim().toLowerCase();
  const filtered = scenarios.filter((s) => {
    if (stageFilter && s.stage !== stageFilter) return false;
    if (!q) return true;
    return (s.title + s.detail + s.explanation + s.exampleMessage).toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          お客様の悩みを貼らなくてOK。<strong className="text-gray-700">段階を選ぶ → シーンを選ぶ</strong>だけで、例文と「なぜそう返すか」が出てきます。
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={seed}
            disabled={seeding}
            className="px-3 py-2 rounded-lg border border-purple-300 text-purple-600 text-xs font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors"
          >
            {seeding ? "読み込み中..." : "✨ プロの初期セットを読み込む"}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setForm({ ...EMPTY_FORM });
            }}
            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
          >
            {showForm ? "閉じる" : "+ 自分で追加"}
          </button>
        </div>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 追加・編集フォーム */}
      {showForm && (
        <section className="bg-white rounded-xl shadow-sm border border-purple-200 p-5 space-y-3">
          <div className="flex gap-3">
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {REPLY_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
              ))}
              <option value="other">その他・共通</option>
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {REPLY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="状況タイトル（例: 無料鑑定後、音沙汰がない）"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="状況の詳細（任意）"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            placeholder="解説: なぜこう返すか（任意）"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={form.exampleMessage}
            onChange={(e) => setForm({ ...form, exampleMessage: e.target.value })}
            placeholder="例文"
            rows={5}
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

      {/* 検索 + 段階タブ */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 キーワードで探す（例: 返金 / 感想 / 音沙汰）"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGE_TABS.map((s) => {
          const count = s.value ? scenarios.filter((x) => x.stage === s.value).length : scenarios.length;
          return (
            <button
              key={s.value}
              onClick={() => setStageFilter(s.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border whitespace-nowrap transition-colors ${
                stageFilter === s.value
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
              }`}
            >
              {s.emoji} {s.label}
              <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 一覧 */}
      {loaded && scenarios.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-purple-300 p-8 text-center space-y-3">
          <p className="text-3xl">💡</p>
          <p className="text-sm text-gray-600 font-medium">まだあるあるが登録されていません</p>
          <p className="text-xs text-gray-400">
            「✨ プロの初期セットを読み込む」を押すと、占い師兼スピリチュアルマーケター視点の
            <br className="hidden md:block" />
            よくあるシーン20個以上（例文+解説つき）がすぐ使えるようになります
          </p>
        </div>
      )}
      {loaded && scenarios.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">条件に合うあるあるが見つかりません</p>
      )}

      <div className="space-y-2">
        {filtered.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => {
                  setOpenId(open ? null : s.id);
                  setEditedText(s.exampleMessage);
                }}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-50/40 transition-colors"
              >
                <span className="text-lg shrink-0">{REPLY_STAGES.find((x) => x.value === s.stage)?.emoji || "💬"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {stageLabel(s.stage)} ・ {categoryLabel(s.category)}
                    {s.detail && ` ・ ${s.detail}`}
                  </p>
                </div>
                <span className="text-gray-400 text-sm shrink-0">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
                  {s.explanation && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-700 mb-1">💡 こう考える</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{s.explanation}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500">✉️ 例文（編集してから使えます。「〇〇さま」は名前に置き換え）</p>
                      <button
                        onClick={() => copyText(editedText, s.id)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                      >
                        {copied && openId === s.id ? "✓ コピーしました" : "📋 コピー"}
                      </button>
                    </div>
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={Math.min(12, Math.max(5, editedText.split("\n").length + 1))}
                      className="w-full border border-purple-200 bg-white rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => startEdit(s)} className="text-gray-500 hover:text-gray-900">この内容を編集</button>
                    <button onClick={() => remove(s.id)} className="text-red-400 hover:text-red-600">削除</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
