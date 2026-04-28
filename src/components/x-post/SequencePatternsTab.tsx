// シーケンスパターン: 一覧 + 追加/編集モーダル（マルチスロット）
"use client";

import { useEffect, useState, useCallback } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import {
  EDUCATION_TYPES,
  STRUCTURE_TYPES,
  CONNECTION_TYPES,
  parseSequencePattern,
  type XSequencePatternRecord,
  type SequenceSlot,
  type ConnectionType,
  type EducationType,
} from "@/lib/x-post-types";
import ArrayInput from "./ArrayInput";

interface ApiPattern {
  id: string;
  genre: string;
  name: string;
  description: string;
  pattern: string;
  example: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

const CONNECTION_LABEL: Record<ConnectionType | "", string> = {
  "": "（最終スロット）",
  quote_rt: "↪︎ 引用RT",
  consecutive: "↓ 連投",
  independent: "·  独立",
  story_chain: "→ ストーリー連投",
};

export default function SequencePatternsTab() {
  const [genre] = useXPostGenre();
  const [items, setItems] = useState<XSequencePatternRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<XSequencePatternRecord | "new" | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/x-post/sequence-patterns?genre=${genre}`);
      const data: ApiPattern[] = await res.json();
      setItems(data.map(parseSequencePattern));
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
        >
          + パターンを追加
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 パターン名・説明で検索"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <span className="text-xs text-gray-500">{items.length}件</span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">🔗</div>
          <p className="text-gray-500 text-sm">
            {items.length === 0 ? "まだシーケンスパターンがありません" : "該当するパターンがありません"}
          </p>
          {items.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              連投や引用RTで繋ぐ複数ポストの流れをパターン化できます
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PatternCard key={p.id} pattern={p} onClick={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing && (
        <PatternEditModal
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

// ============================================================
// PatternCard
// ============================================================

function PatternCard({ pattern, onClick }: { pattern: XSequencePatternRecord; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm cursor-pointer transition"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-bold text-gray-900 truncate">
            {pattern.isBuiltIn && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-1">標準</span>}
            {pattern.name}
          </h4>
          {pattern.description && (
            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{pattern.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-400">
            {pattern.genre === "any" ? "共通" : pattern.genre === "business" ? "ビジ" : "占い"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        {pattern.pattern.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {s.slot}. {s.educationType ? `${s.educationType}` : "—"}
            </span>
            {i < pattern.pattern.length - 1 && (
              <span className="text-gray-400 px-1">
                {CONNECTION_LABEL[s.connectionType] || "↓"}
              </span>
            )}
          </span>
        ))}
        {pattern.pattern.length === 0 && <span className="text-gray-400">スロットなし</span>}
      </div>
    </div>
  );
}

// ============================================================
// Edit Modal
// ============================================================

interface ModalProps {
  item: XSequencePatternRecord | null;
  genre: string;
  onClose: () => void;
  onSaved: () => void;
}

function emptySlot(slotNum: number): SequenceSlot {
  return {
    slot: slotNum,
    educationType: "",
    structureType: "",
    skeleton: "",
    placeholders: [],
    connectionType: "",
  };
}

function PatternEditModal({ item, genre, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [patternGenre, setPatternGenre] = useState<string>(item?.genre ?? "any");
  const [description, setDescription] = useState(item?.description ?? "");
  const [example, setExample] = useState(item?.example ?? "");
  const [isBuiltIn, setIsBuiltIn] = useState(item?.isBuiltIn ?? false);
  const [slots, setSlots] = useState<SequenceSlot[]>(
    item?.pattern && item.pattern.length > 0
      ? item.pattern
      : [emptySlot(1)]
  );
  const [saving, setSaving] = useState(false);

  // 新規時に親側の現在ジャンルを反映（編集時はそのまま）
  useEffect(() => {
    if (!item) setPatternGenre(genre);
  }, [item, genre]);

  const updateSlot = (i: number, patch: Partial<SequenceSlot>) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const addSlot = () => {
    setSlots((prev) => {
      // 直前の slot は default で「連投」接続にする
      const updated = prev.map((s, i) =>
        i === prev.length - 1 && !s.connectionType
          ? { ...s, connectionType: "consecutive" as ConnectionType }
          : s
      );
      return [...updated, emptySlot(prev.length + 1)];
    });
  };

  const removeSlot = (i: number) => {
    if (slots.length <= 1) {
      alert("スロットは最低1つ必要です");
      return;
    }
    setSlots((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, slot: idx + 1 }))
    );
  };

  const moveSlot = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((s, idx) => ({ ...s, slot: idx + 1 }));
    });
  };

  const save = async () => {
    if (!name.trim()) {
      alert("名前は必須です");
      return;
    }
    if (slots.some((s) => !s.skeleton.trim())) {
      alert("全スロットのスケルトンを入力してください");
      return;
    }
    // 最終スロットの connectionType は空にする
    const cleaned = slots.map((s, i) => ({
      ...s,
      slot: i + 1,
      connectionType: i === slots.length - 1 ? "" : (s.connectionType || "consecutive") as ConnectionType,
    }));

    setSaving(true);
    try {
      const payload = {
        genre: patternGenre,
        name,
        description,
        pattern: JSON.stringify(cleaned),
        example,
        isBuiltIn,
      };
      const res = await fetch(
        item ? `/api/x-post/sequence-patterns/${item.id}` : "/api/x-post/sequence-patterns",
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
    if (!confirm(`「${item.name}」を削除しますか？`)) return;
    const res = await fetch(`/api/x-post/sequence-patterns/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{item ? "パターンを編集" : "シーケンスパターンを追加"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,150px] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                パターン名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ライフスタイル爆発→マネタイズ流れ展開"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">適用ジャンル</label>
              <select
                value={patternGenre}
                onChange={(e) => setPatternGenre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="any">共通</option>
                <option value="business">ビジネス系</option>
                <option value="spiritual">占いスピ系</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">説明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このパターンの使い所"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* スロットエディタ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">スロット ({slots.length})</h4>
            </div>
            {slots.map((slot, i) => (
              <SlotEditor
                key={i}
                slot={slot}
                index={i}
                isLast={i === slots.length - 1}
                canMoveUp={i > 0}
                canMoveDown={i < slots.length - 1}
                onUpdate={(patch) => updateSlot(i, patch)}
                onRemove={() => removeSlot(i)}
                onMoveUp={() => moveSlot(i, -1)}
                onMoveDown={() => moveSlot(i, 1)}
              />
            ))}
            <button
              type="button"
              onClick={addSlot}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
            >
              + スロット追加
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">オリジナル例文（参考）</label>
            <textarea
              value={example}
              onChange={(e) => setExample(e.target.value)}
              rows={6}
              placeholder={`Slot 1: ベッドで寝てるだけで日給10万入ってきたw\n\nSlot 2 (引用RT):\nちなみにマネタイズの流れこんな感じ\n・スレズで無料鑑定\n・無料鑑定から有料鑑定\n・claudeで時短\n・3〜5万円アップセル`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isBuiltIn}
              onChange={(e) => setIsBuiltIn(e.target.checked)}
            />
            <span>標準パターンとしてマーク（一覧上部に表示）</span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            {item && (
              <button onClick={remove} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded">
                🗑️ 削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
    </div>
  );
}

// ============================================================
// SlotEditor
// ============================================================

interface SlotEditorProps {
  slot: SequenceSlot;
  index: number;
  isLast: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (patch: Partial<SequenceSlot>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SlotEditor({
  slot,
  index,
  isLast,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SlotEditorProps) {
  const detectPlaceholders = () => {
    const matches = slot.skeleton.matchAll(/\[([^\]]+)\]/g);
    const found = Array.from(new Set(Array.from(matches, (m) => m[1])));
    onUpdate({ placeholders: found });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-bold text-gray-900">Slot {index + 1}</h5>
        <div className="flex gap-1 text-xs">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="px-2 py-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
            type="button"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="px-2 py-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
            type="button"
          >
            ▼
          </button>
          <button
            onClick={onRemove}
            className="px-2 py-1 text-red-500 hover:bg-red-50 rounded"
            type="button"
          >
            ✕ 削除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">教育タイプ</label>
          <select
            value={slot.educationType}
            onChange={(e) => onUpdate({ educationType: e.target.value as EducationType | "" })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="">(未指定)</option>
            {EDUCATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">構造タイプ</label>
          <select
            value={slot.structureType}
            onChange={(e) => onUpdate({ structureType: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="">(未指定)</option>
            {STRUCTURE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-0.5">
          <label className="block text-xs text-gray-600">スケルトン</label>
          <button
            type="button"
            onClick={detectPlaceholders}
            className="text-xs text-indigo-600 hover:underline"
          >
            プレースホルダー自動抽出
          </button>
        </div>
        <textarea
          value={slot.skeleton}
          onChange={(e) => onUpdate({ skeleton: e.target.value })}
          rows={3}
          placeholder="[変数名] でプレースホルダー"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-0.5">プレースホルダー</label>
        <ArrayInput
          values={slot.placeholders}
          onChange={(v) => onUpdate({ placeholders: v })}
          placeholder="変数名を入力してEnter"
        />
      </div>

      {!isLast && (
        <div>
          <label className="block text-xs text-gray-600 mb-0.5">次のスロットへの接続</label>
          <select
            value={slot.connectionType || "consecutive"}
            onChange={(e) => onUpdate({ connectionType: e.target.value as ConnectionType })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          >
            {CONNECTION_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
