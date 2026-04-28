// 参考ポスト・テンプレ用のフォルダサイドバー
"use client";

import { useEffect, useState, useCallback } from "react";
import { folderColorClass, FOLDER_COLORS, type XFolderWithCount } from "@/lib/x-post-types";

export const SYSTEM_ALL = "__all__";
export const SYSTEM_UNFILED = "__unfiled__";

interface Props {
  genre: string;
  selectedFolderId: string; // SYSTEM_ALL | SYSTEM_UNFILED | folder.id
  onSelectFolder: (id: string) => void;
  totalCount: number;
  unfiledCount: number;
}

export default function FolderSidebar({ genre, selectedFolderId, onSelectFolder, totalCount, unfiledCount }: Props) {
  const [folders, setFolders] = useState<XFolderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [editing, setEditing] = useState<XFolderWithCount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/x-post/folders?genre=${genre}`);
      const data = await res.json();
      setFolders(data);
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/x-post/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genre, name: newName, color: newColor }),
    });
    if (!res.ok) {
      alert("作成失敗");
      return;
    }
    setAdding(false);
    setNewName("");
    setNewColor("blue");
    load();
  };

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelectFolder(SYSTEM_ALL)}
        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${
          selectedFolderId === SYSTEM_ALL ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100 text-gray-700"
        }`}
      >
        <span>📁 全て</span>
        <span className="text-xs text-gray-500">{totalCount}</span>
      </button>
      <button
        onClick={() => onSelectFolder(SYSTEM_UNFILED)}
        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${
          selectedFolderId === SYSTEM_UNFILED ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100 text-gray-700"
        }`}
      >
        <span>📂 未分類</span>
        <span className="text-xs text-gray-500">{unfiledCount}</span>
      </button>

      <div className="border-t border-gray-200 my-2" />

      {loading && folders.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400">読み込み中...</div>
      )}

      {folders.map((f) => (
        <FolderItem
          key={f.id}
          folder={f}
          selected={selectedFolderId === f.id}
          onSelect={() => onSelectFolder(f.id)}
          onEdit={() => setEditing(f)}
        />
      ))}

      {adding ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-2 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            placeholder="フォルダ名"
            autoFocus
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setNewColor(c.value)}
                className={`w-6 h-6 rounded ${c.className} ${newColor === c.value ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                title={c.label}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={create} className="flex-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded">作成</button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">×</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          + 新フォルダ
        </button>
      )}

      {editing && (
        <FolderEditModal
          folder={editing}
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

function FolderItem({ folder, selected, onSelect, onEdit }: {
  folder: XFolderWithCount;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-md text-sm transition-colors ${
        selected ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 text-left px-3 py-2 flex items-center gap-2 min-w-0"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${folderColorClass(folder.color)}`} />
        <span className="truncate">{folder.name}</span>
        <span className="text-xs text-gray-500 ml-auto shrink-0">{folder._count.items}</span>
      </button>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 px-2 text-gray-400 hover:text-gray-700 transition-opacity"
        aria-label="編集"
      >
        ⋯
      </button>
    </div>
  );
}

function FolderEditModal({ folder, onClose, onSaved }: {
  folder: XFolderWithCount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);

  const save = async () => {
    if (!name.trim()) return;
    const res = await fetch(`/api/x-post/folders/${folder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      alert("更新失敗");
      return;
    }
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`フォルダ「${folder.name}」を削除しますか？\n（中のポストは消えません）`)) return;
    const res = await fetch(`/api/x-post/folders/${folder.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">フォルダ編集</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">色</label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-8 h-8 rounded ${c.className} ${color === c.value ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <button onClick={remove} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded">🗑️ 削除</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">キャンセル</button>
            <button onClick={save} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
