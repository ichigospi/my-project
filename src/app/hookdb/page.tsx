"use client";

import { useState, useEffect } from "react";
import { getHooks, getCTAs, saveHook, saveCTA, deleteHook, deleteCTA, genId, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { HookEntry, CTAEntry, Genre, Style } from "@/lib/project-store";

export default function HookDBPage() {
  const [tab, setTab] = useState<"hooks" | "ctas">("hooks");
  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const [ctas, setCtas] = useState<CTAEntry[]>([]);
  const [filterGenre, setFilterGenre] = useState<Genre | "all">("all");
  const [filterStyle, setFilterStyle] = useState<Style | "all">("all");

  useEffect(() => { setHooks(getHooks()); setCtas(getCTAs()); }, []);

  const [newText, setNewText] = useState("");
  const [newGenre, setNewGenre] = useState<Genre>("love");
  const [newStyle, setNewStyle] = useState<Style>("healing");
  const [newScore, setNewScore] = useState(7);
  const [newSource, setNewSource] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    const entry = { id: genId(), text: newText.trim(), genre: newGenre, style: newStyle, score: newScore, sourceVideo: newSource, sourceChannel: "", tags: [], createdAt: new Date().toISOString() };
    if (tab === "hooks") { saveHook(entry); setHooks(getHooks()); }
    else { saveCTA(entry); setCtas(getCTAs()); }
    setNewText(""); setNewSource("");
  };

  const handleDelete = (id: string) => {
    if (tab === "hooks") { deleteHook(id); setHooks(getHooks()); }
    else { deleteCTA(id); setCtas(getCTAs()); }
  };

  const items = (tab === "hooks" ? hooks : ctas)
    .filter((i) => (filterGenre === "all" || i.genre === filterGenre) && (filterStyle === "all" || i.style === filterStyle))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">フック & CTA データベース</h1>
        <p className="text-gray-500 mt-1">分析から蓄積された高パフォーマンスのフック・CTAパターン</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([["hooks", "フック"] as const, ["ctas", "CTA"] as const]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === id ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
            {label}（{id === "hooks" ? hooks.length : ctas.length}件）
          </button>
        ))}
      </div>

      {/* 追加フォーム */}
      <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-semibold text-sm mb-3">{tab === "hooks" ? "フック" : "CTA"}を追加</h3>
        <div className="flex flex-wrap gap-3">
          <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)}
            placeholder={tab === "hooks" ? "フックテキスト" : "CTAテキスト"}
            className="flex-1 min-w-64 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
          <select value={newGenre} onChange={(e) => setNewGenre(e.target.value as Genre)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={newStyle} onChange={(e) => setNewStyle(e.target.value as Style)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            {Object.entries(STYLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">スコア:</span>
            <input type="number" min={1} max={10} value={newScore} onChange={(e) => setNewScore(parseInt(e.target.value) || 7)}
              className="w-14 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center" />
          </div>
          <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)}
            placeholder="参考動画（任意）" className="w-40 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
          <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">追加</button>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value as Genre | "all")}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
          <option value="all">全ジャンル</option>
          {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStyle} onChange={(e) => setFilterStyle(e.target.value as Style | "all")}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
          <option value="all">全スタイル</option>
          {Object.entries(STYLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{items.length}件</span>
      </div>

      {/* リスト */}
      {items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>{tab === "hooks" ? "フック" : "CTA"}がまだありません</p>
          <p className="text-sm mt-1">台本分析を行うと自動で蓄積されます</p>
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-card-bg rounded-lg p-4 shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.text}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[item.genre as Genre]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[item.style as Style]}</span>
                {item.sourceVideo && <span className="text-xs text-gray-400 truncate max-w-40">{item.sourceVideo}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg font-bold ${item.score >= 8 ? "text-green-600" : item.score >= 6 ? "text-yellow-600" : "text-red-500"}`}>
                {item.score}<span className="text-xs text-gray-400">/10</span>
              </div>
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-danger shrink-0 mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
