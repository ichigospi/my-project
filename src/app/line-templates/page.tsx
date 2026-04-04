"use client";

import { useState, useEffect } from "react";

/* ── Types ── */
interface Template {
  id: string;
  category: string;
  name: string;
  triggerKeywords: string[];
  body: string;
  tone: string;
  usageCount: number;
}

const CATEGORIES = ["FAQ", "予約", "クレーム", "挨拶", "セールス"];
const TONES = ["丁寧", "カジュアル", "スピリチュアル"];
const STORAGE_KEY = "reply_templates";

/* ── Helpers ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

const CATEGORY_COLOR: Record<string, string> = {
  FAQ: "bg-blue-100 text-blue-800",
  "予約": "bg-green-100 text-green-800",
  "クレーム": "bg-red-100 text-red-800",
  "挨拶": "bg-yellow-100 text-yellow-800",
  "セールス": "bg-purple-100 text-purple-800",
};

const TONE_COLOR: Record<string, string> = {
  "丁寧": "bg-indigo-100 text-indigo-800",
  "カジュアル": "bg-orange-100 text-orange-800",
  "スピリチュアル": "bg-pink-100 text-pink-800",
};

/* ── Component ── */
export default function LineTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);

  // Form state
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [keywords, setKeywords] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTone, setEditTone] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  // Test preview
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const persist = (updated: Template[]) => {
    setTemplates(updated);
    saveTemplates(updated);
  };

  /* ── Add template ── */
  const handleAdd = () => {
    if (!name.trim() || !body.trim()) return;
    const newTemplate: Template = {
      id: uid(),
      category,
      name: name.trim(),
      triggerKeywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      body: body.trim(),
      tone,
      usageCount: 0,
    };
    persist([...templates, newTemplate]);
    setName("");
    setBody("");
    setKeywords("");
    setCategory(CATEGORIES[0]);
    setTone(TONES[0]);
  };

  /* ── Delete template ── */
  const handleDelete = (id: string) => {
    if (!confirm("このテンプレートを削除しますか？")) return;
    persist(templates.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
    if (previewId === id) setPreviewId(null);
  };

  /* ── Start editing ── */
  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setEditCategory(t.category);
    setEditName(t.name);
    setEditBody(t.body);
    setEditTone(t.tone);
    setEditKeywords(t.triggerKeywords.join(", "));
  };

  /* ── Save edit ── */
  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editBody.trim()) return;
    const updated = templates.map((t) =>
      t.id === editingId
        ? {
            ...t,
            category: editCategory,
            name: editName.trim(),
            body: editBody.trim(),
            tone: editTone,
            triggerKeywords: editKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
          }
        : t
    );
    persist(updated);
    setEditingId(null);
  };

  /* ── Cancel edit ── */
  const cancelEdit = () => {
    setEditingId(null);
  };

  /* ── Test preview ── */
  const getPreviewBody = (body: string) => {
    return body.replace(/\{name\}/g, "テスト太郎");
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-bold">返信テンプレート</h1>

      {/* Add Template Form */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">テンプレートを追加</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリ
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              テンプレート名 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 初回挨拶"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              トーン
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              本文 * <span className="text-gray-400 font-normal">（{"{name}"} で名前変数を挿入）</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="例: {name}様、お問い合わせありがとうございます。"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              トリガーキーワード <span className="text-gray-400 font-normal">(カンマ区切り)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例: 予約, 日程, 空き"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !body.trim()}
            className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            テンプレートを追加
          </button>
        </div>
      </div>

      {/* Template Cards */}
      {templates.length === 0 ? (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-400">テンプレートがまだありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col"
            >
              {editingId === t.id ? (
                /* ── Inline Edit Mode ── */
                <div className="space-y-3 flex-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      カテゴリ
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      テンプレート名
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      トーン
                    </label>
                    <select
                      value={editTone}
                      onChange={(e) => setEditTone(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {TONES.map((tn) => (
                        <option key={tn} value={tn}>
                          {tn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      本文
                    </label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      トリガーキーワード
                    </label>
                    <input
                      type="text"
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm hover:opacity-90 transition"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200 transition"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display Mode ── */
                <>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm">{t.name}</h3>
                    <span className="text-xs text-gray-400">
                      使用回数: {t.usageCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_COLOR[t.category] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {t.category}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        TONE_COLOR[t.tone] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {t.tone}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 flex-1 line-clamp-3 whitespace-pre-wrap">
                    {t.body}
                  </p>
                  {t.triggerKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {t.triggerKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Test Preview */}
                  {previewId === t.id && (
                    <div className="mb-3 bg-accent/5 border border-accent/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-accent mb-1">
                        テストプレビュー
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {getPreviewBody(t.body)}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      削除
                    </button>
                    <button
                      onClick={() =>
                        setPreviewId(previewId === t.id ? null : t.id)
                      }
                      className="text-xs text-gray-500 hover:underline font-medium ml-auto"
                    >
                      {previewId === t.id ? "プレビューを閉じる" : "テスト"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
