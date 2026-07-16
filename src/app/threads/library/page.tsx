"use client";

import { useCallback, useEffect, useState } from "react";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api } from "@/lib/threads-client";

interface LibraryItem {
  id: string;
  accountId: string | null;
  type: string;
  title: string;
  content: string;
  strength: number;
  useCount: number;
  note: string;
}

const TYPE_TABS = [
  { value: "hook", label: "🧲 フック", desc: "冒頭の掴み。生成時に差し替えて使えます" },
  { value: "plan", label: "💡 企画", desc: "投稿の企画骨子。生成時に指定できます" },
  { value: "cta", label: "📣 CTA", desc: "締め・行動喚起。生成時に差し替えて使えます" },
];

const emptyForm = { title: "", content: "", strength: 3, note: "", shared: true };

export default function ThreadsLibraryPage() {
  const [accountId] = useThreadsAccountId();
  const [type, setType] = useState("hook");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setItems(await api<LibraryItem[]>(`/api/threads/library?accountId=${accountId}&type=${type}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [accountId, type]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (item: LibraryItem | null) => {
    setError("");
    if (!item) {
      setForm({ ...emptyForm });
      setEditing("new");
    } else {
      setForm({ title: item.title, content: item.content, strength: item.strength, note: item.note, shared: item.accountId === null });
      setEditing(item.id);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("タイトルと内容は必須です");
      return;
    }
    setError("");
    try {
      const payload = { type, title: form.title, content: form.content, strength: form.strength, note: form.note, accountId: form.shared ? null : accountId };
      if (editing === "new") {
        await api("/api/threads/library", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/threads/library/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (item: LibraryItem) => {
    if (!confirm(`「${item.title}」を削除しますか？`)) return;
    await api(`/api/threads/library/${item.id}`, { method: "DELETE" });
    await load();
  };

  const currentTab = TYPE_TABS.find((t) => t.value === type);

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ライブラリ</h2>
          <p className="text-sm text-gray-600 mt-1">強いフック・企画・CTAをストックし、オマージュ生成時に呼び出します。</p>
        </div>
        <button onClick={() => startEdit(null)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 whitespace-nowrap">
          + 追加
        </button>
      </div>

      <div className="inline-flex rounded-lg bg-gray-100 p-1">
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
                  <span className="font-bold text-gray-900 text-sm">{item.title}</span>
                  <span className="text-xs text-amber-500">{"★".repeat(item.strength)}{"☆".repeat(5 - item.strength)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.accountId ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                    {item.accountId ? "このアカ専用" : "全アカ共通"}
                  </span>
                  {item.useCount > 0 && <span className="text-[10px] text-gray-400">使用 {item.useCount}回</span>}
                </div>
                <p className="text-xs text-gray-700 mt-1.5 whitespace-pre-wrap">{item.content}</p>
                {item.note && <p className="text-[11px] text-gray-400 mt-1">{item.note}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
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
            まだ登録がありません。リサーチ画面の「フック登録」からも追加できます。
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{currentTab?.label}を{editing === "new" ? "追加" : "編集"}</h3>
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
            <label className="block">
              <span className="text-xs font-medium text-gray-700">タイトル *</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="例: 数字ギャップ型フック" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">内容 *</span>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={type === "hook" ? "例: 「〇〇な人の97%が知らない△△」のように数字で意外性を出す型" : ""} />
            </label>
            <div className="flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                強さ:
                <select value={form.strength} onChange={(e) => setForm({ ...form, strength: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{"★".repeat(n)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />
                全アカウント共通
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">メモ</span>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="なぜ強いのか、使い所など" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
