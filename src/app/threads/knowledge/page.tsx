"use client";

import { useCallback, useEffect, useState } from "react";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api } from "@/lib/threads-client";

interface KnowledgeItem {
  id: string;
  accountId: string | null;
  type: string;
  title: string;
  content: string;
  isInjected: boolean;
  updatedAt: string;
}

const TYPE_TABS = [
  { value: "rule", label: "投稿ルール", desc: "生成時に「必ず守る」として注入されます" },
  { value: "knowhow", label: "ノウハウ", desc: "作成時の判断基準として注入されます" },
  { value: "teaching", label: "教材", desc: "教材から抽出した指示・学びを保存" },
  { value: "memo", label: "メモ", desc: "気づきの走り書き置き場" },
];

const emptyForm = { title: "", content: "", shared: true, isInjected: true };

export default function ThreadsKnowledgePage() {
  const [accountId] = useThreadsAccountId();
  const [type, setType] = useState("rule");
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setItems(await api<KnowledgeItem[]>(`/api/threads/knowledge?accountId=${accountId}&type=${type}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [accountId, type]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (item: KnowledgeItem | null) => {
    setError("");
    if (!item) {
      setForm({ ...emptyForm });
      setEditing("new");
    } else {
      setForm({ title: item.title, content: item.content, shared: item.accountId === null, isInjected: item.isInjected });
      setEditing(item.id);
    }
  };

  const save = async () => {
    if (!form.content.trim()) {
      setError("内容は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        type,
        title: form.title,
        content: form.content,
        accountId: form.shared ? null : accountId,
        isInjected: form.isInjected,
      };
      if (editing === "new") {
        await api("/api/threads/knowledge", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/threads/knowledge/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: KnowledgeItem) => {
    if (!confirm(`「${item.title || item.content.slice(0, 20)}」を削除しますか？`)) return;
    await api(`/api/threads/knowledge/${item.id}`, { method: "DELETE" });
    await load();
  };

  const toggleInjected = async (item: KnowledgeItem) => {
    await api(`/api/threads/knowledge/${item.id}`, { method: "PATCH", body: JSON.stringify({ isInjected: !item.isInjected }) });
    await load();
  };

  const currentTab = TYPE_TABS.find((t) => t.value === type);

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ノウハウ・投稿ルール</h2>
          <p className="text-sm text-gray-600 mt-1">「注入ON」の項目はオマージュ生成のプロンプトに自動で入ります。</p>
        </div>
        <button onClick={() => startEdit(null)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 whitespace-nowrap">
          + 追加
        </button>
      </div>

      <div className="inline-flex rounded-lg bg-gray-100 p-1 flex-wrap">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${type === t.value ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {currentTab && <p className="text-xs text-gray-500 -mt-2">{currentTab.desc}</p>}

      {error && !editing && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{item.title || "（無題）"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.accountId ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                    {item.accountId ? "このアカ専用" : "全アカ共通"}
                  </span>
                  {item.isInjected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">注入ON</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap line-clamp-4">{item.content}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleInjected(item)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  注入{item.isInjected ? "OFF" : "ON"}
                </button>
                <button onClick={() => startEdit(item)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  編集
                </button>
                <button onClick={() => remove(item)} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            まだ登録がありません。
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">
              {currentTab?.label}を{editing === "new" ? "追加" : "編集"}
            </h3>
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
            <label className="block">
              <span className="text-xs font-medium text-gray-700">タイトル</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="例: 冒頭2行のルール"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">内容 *</span>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={10}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </label>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />
                全アカウント共通
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isInjected} onChange={(e) => setForm({ ...form, isInjected: e.target.checked })} />
                生成時に注入する
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
