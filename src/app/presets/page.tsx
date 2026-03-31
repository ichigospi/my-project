"use client";

import { useState, useEffect } from "react";
import { getPresets, savePreset, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { ScriptRulePreset, Genre, Style } from "@/lib/project-store";

export default function PresetsPage() {
  const [presets, setPresets] = useState<ScriptRulePreset[]>([]);
  const [editing, setEditing] = useState<ScriptRulePreset | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPresets(getPresets()); }, []);

  const handleSave = () => {
    if (!editing) return;
    savePreset(editing);
    setPresets(getPresets());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">台本ルールプリセット</h1>
        <p className="text-gray-500 mt-1">ジャンル×スタイルごとのベースルール・プロンプトを設定</p>
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((p) => (
            <div key={p.id} onClick={() => setEditing(p)}
              className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:border-accent/30 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{GENRE_LABELS[p.genre as Genre]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{STYLE_LABELS[p.style as Style]}</span>
              </div>
              <h3 className="font-semibold mb-2">{p.name}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.rules}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>目標: {p.targetWordCount}文字</span>
                <span>フック: {p.hookPattern.substring(0, 15)}...</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-2xl">
          <button onClick={() => setEditing(null)} className="text-accent text-sm font-medium mb-4 flex items-center gap-1 hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            一覧に戻る
          </button>
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{GENRE_LABELS[editing.genre as Genre]}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{STYLE_LABELS[editing.style as Style]}</span>
            </div>
            <h2 className="text-lg font-bold">{editing.name}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">台本ルール</label>
              <textarea value={editing.rules} onChange={(e) => setEditing({ ...editing, rules: e.target.value })}
                rows={4} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">台本生成プロンプト</label>
              <textarea value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                rows={3} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標文字数</label>
                <input type="number" value={editing.targetWordCount} onChange={(e) => setEditing({ ...editing, targetWordCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">フックパターン</label>
              <input type="text" value={editing.hookPattern} onChange={(e) => setEditing({ ...editing, hookPattern: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTAパターン</label>
              <input type="text" value={editing.ctaPattern} onChange={(e) => setEditing({ ...editing, ctaPattern: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <button onClick={handleSave} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
              {saved ? "保存しました！" : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
