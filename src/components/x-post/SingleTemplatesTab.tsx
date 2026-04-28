// 単一ポストテンプレ: 一覧 + 追加/編集モーダル
"use client";

import { useEffect, useState, useCallback } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import {
  EDUCATION_TYPES,
  STRUCTURE_TYPES,
  emptyTemplateStructure,
  parseTemplate,
  type XSinglePostTemplate,
  type TemplateStructure,
} from "@/lib/x-post-types";
import ArrayInput from "./ArrayInput";

const HOOK_TYPES = [
  "", "不完全情報", "重要性", "希少性", "権威性", "恐怖・損失回避",
  "ターゲット刺し", "強烈な感情", "パワーワード", "簡易性", "矛盾",
  "ニュース性", "暴露・報告", "限定性", "反社会性",
];

interface ApiTemplate {
  id: string;
  genre: string;
  name: string;
  sourceType: string;
  sourceId: string | null;
  structure: string;
  skeleton: string;
  placeholders: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export default function SingleTemplatesTab() {
  const [genre] = useXPostGenre();
  const [items, setItems] = useState<XSinglePostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<XSinglePostTemplate | "new" | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/x-post/templates?genre=${genre}`);
      const data: ApiTemplate[] = await res.json();
      setItems(data.map(parseTemplate));
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((t) =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.skeleton.toLowerCase().includes(search.toLowerCase()) ||
    (t.structure.educationType ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (t.structure.hookType ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
        >
          + テンプレを追加
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 名前・スケルトン・教育タイプで検索"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <span className="text-xs text-gray-500">{items.length}件</span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-gray-500 text-sm">
            {items.length === 0 ? "まだ単一ポストテンプレがありません" : "該当するテンプレがありません"}
          </p>
          {items.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              競合ポスト・参考ポストの構造をテンプレ化して再利用できます
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} onClick={() => setEditing(t)} />
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditModal
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
// TemplateCard
// ============================================================

function TemplateCard({ template, onClick }: { template: XSinglePostTemplate; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm cursor-pointer transition"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-bold text-gray-900 truncate">{template.name}</h4>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(template.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {template.structure.hookType && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
            🎣 {template.structure.hookType}
          </span>
        )}
        {template.structure.educationType && (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
            📚 {template.structure.educationType}の教育
          </span>
        )}
        {template.structure.structureType && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
            🏗️ {template.structure.structureType}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap font-mono">
        {template.skeleton}
      </p>

      {template.placeholders.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.placeholders.slice(0, 6).map((p) => (
            <span key={p} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              [{p}]
            </span>
          ))}
          {template.placeholders.length > 6 && (
            <span className="text-xs text-gray-400">+{template.placeholders.length - 6}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Edit Modal
// ============================================================

interface ModalProps {
  item: XSinglePostTemplate | null;
  genre: string;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateEditModal({ item, genre, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [structure, setStructure] = useState<TemplateStructure>(
    item?.structure ?? emptyTemplateStructure()
  );
  const [skeleton, setSkeleton] = useState(item?.skeleton ?? "");
  const [placeholders, setPlaceholders] = useState<string[]>(item?.placeholders ?? []);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // スケルトンから [プレースホルダー] を自動抽出するヘルパー
  const detectPlaceholders = () => {
    const matches = skeleton.matchAll(/\[([^\]]+)\]/g);
    const found = Array.from(new Set(Array.from(matches, (m) => m[1])));
    setPlaceholders(found);
  };

  const save = async () => {
    if (!name.trim() || !skeleton.trim()) {
      alert("名前とスケルトンは必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        genre,
        name,
        structure: JSON.stringify(structure),
        skeleton,
        placeholders: JSON.stringify(placeholders),
        notes,
        sourceType: item?.sourceType ?? "scratch",
        sourceId: item?.sourceId ?? null,
      };
      const res = await fetch(
        item ? `/api/x-post/templates/${item.id}` : "/api/x-post/templates",
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
    const res = await fetch(`/api/x-post/templates/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{item ? "テンプレを編集" : "テンプレを追加"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              テンプレ名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 即効せどり成果報告型"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">フックタイプ</label>
              <select
                value={structure.hookType ?? ""}
                onChange={(e) => setStructure((s) => ({ ...s, hookType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {HOOK_TYPES.map((h) => (
                  <option key={h} value={h}>{h || "(未指定)"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">教育タイプ</label>
              <select
                value={structure.educationType ?? ""}
                onChange={(e) => setStructure((s) => ({ ...s, educationType: e.target.value as TemplateStructure["educationType"] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">(未指定)</option>
                {EDUCATION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">構造タイプ</label>
              <select
                value={structure.structureType ?? ""}
                onChange={(e) => setStructure((s) => ({ ...s, structureType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">(未指定)</option>
                {STRUCTURE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">強化要素（任意）</label>
            <ArrayInput
              values={structure.reinforcementElements ?? []}
              onChange={(v) => setStructure((s) => ({ ...s, reinforcementElements: v }))}
              placeholder="例: 即効性、限定性、優越感"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">
                スケルトン <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={detectPlaceholders}
                className="text-xs text-indigo-600 hover:underline"
              >
                プレースホルダー自動抽出
              </button>
            </div>
            <textarea
              value={skeleton}
              onChange={(e) => setSkeleton(e.target.value)}
              rows={8}
              placeholder="今日[誰]に[手法名]教えたんだけど、[期間]で利益[金額]円ゲットしてて[感情]"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              [変数名] の形でプレースホルダーを書いておくと、生成時にAIが穴埋めできます
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">プレースホルダー一覧</label>
            <ArrayInput
              values={placeholders}
              onChange={setPlaceholders}
              placeholder="例: 誰、手法名、期間"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ（使い所・元ポスト等）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
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
