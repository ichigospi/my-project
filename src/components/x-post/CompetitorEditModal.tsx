// 競合アカウント追加/編集モーダル
"use client";

import { useState } from "react";
import type { XCompetitor } from "@/lib/x-post-types";

interface Props {
  competitor: XCompetitor | null;
  genre: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CompetitorEditModal({ competitor, genre, onClose, onSaved }: Props) {
  const [handle, setHandle] = useState(competitor?.handle ?? "");
  const [name, setName] = useState(competitor?.name ?? "");
  const [note, setNote] = useState(competitor?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!handle.trim()) {
      alert("ハンドルは必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = { genre, handle: handle.replace(/^@/, ""), name, note };
      const res = await fetch(
        competitor ? `/api/x-post/competitors/${competitor.id}` : "/api/x-post/competitors",
        {
          method: competitor ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`保存失敗: ${e.error || res.statusText}`);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!competitor) return;
    if (!confirm(`@${competitor.handle} を削除しますか？\n（収集済みポストもすべて削除されます）`)) return;
    const res = await fetch(`/api/x-post/competitors/${competitor.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{competitor ? "競合アカウントを編集" : "競合アカウントを追加"}</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            ハンドル (@) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@xxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: にきち垢"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="例: せどり系・実績訴求が得意"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="flex justify-between pt-2">
          <div>
            {competitor && (
              <button onClick={remove} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded">
                🗑️ 削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">
              キャンセル
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-1.5 rounded"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
