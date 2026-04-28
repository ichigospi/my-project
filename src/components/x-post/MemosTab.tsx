// メモタブ: 自由メモ（タイトル + 本文 + タグ）
"use client";

import { useEffect, useState, useCallback } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import type { XMemo } from "@/lib/x-post-types";
import ArrayInput from "./ArrayInput";

interface ApiMemo {
  id: string;
  genre: string;
  title: string;
  content: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

function parse(record: ApiMemo): XMemo {
  let tags: string[] = [];
  try { tags = JSON.parse(record.tags || "[]"); } catch { tags = []; }
  return { ...record, tags };
}

export default function MemosTab() {
  const [genre] = useXPostGenre();
  const [items, setItems] = useState<XMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<XMemo | "new" | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/x-post/knowledge?genre=${genre}&type=memo`);
      const data: ApiMemo[] = await res.json();
      setItems(data.map(parse));
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((m) =>
    !search ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
        >
          + メモを追加
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 検索"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <span className="text-xs text-gray-500">{items.length}件</span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-gray-500 text-sm">
            {items.length === 0 ? "まだメモがありません" : "該当するメモがありません"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => setEditing(m)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm cursor-pointer transition"
            >
              <h4 className="font-bold text-gray-900 mb-1 truncate">{m.title || "(無題)"}</h4>
              <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{m.content}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">#{t}</span>
                  ))}
                </div>
                <span className="text-xs text-gray-400">{new Date(m.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MemoModal
          item={editing === "new" ? null : editing}
          genre={genre}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  item: XMemo | null;
  genre: string;
  onClose: () => void;
  onSaved: () => void;
}

function MemoModal({ item, genre, onClose, onSaved }: ModalProps) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) {
      alert("本文は必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        genre,
        type: "memo",
        title,
        content,
        tags: JSON.stringify(tags),
      };
      const res = await fetch(
        item ? `/api/x-post/knowledge/${item.id}` : "/api/x-post/knowledge",
        {
          method: item ? "PUT" : "POST",
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
    if (!item) return;
    if (!confirm("このメモを削除しますか？")) return;
    const res = await fetch(`/api/x-post/knowledge/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{item ? "メモを編集" : "メモを追加"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">タイトル</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">本文 <span className="text-red-500">*</span></label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">タグ</label>
            <ArrayInput values={tags} onChange={setTags} placeholder="タグを入力してEnter" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            {item && (
              <button onClick={remove} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">🗑️ 削除</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">キャンセル</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded">
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
