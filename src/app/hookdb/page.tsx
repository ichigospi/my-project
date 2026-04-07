"use client";

import { useState, useEffect } from "react";
import {
  getHooks, getCTAs, getThumbnailWords, getTitles,
  saveHook, saveCTA, saveThumbnailWord, saveTitle,
  deleteHook, deleteCTA, deleteThumbnailWord, deleteTitle,
  genId, GENRE_LABELS, STYLE_LABELS,
} from "@/lib/project-store";
import type { HookEntry, CTAEntry, ThumbnailWordEntry, TitleEntry, Genre, Style } from "@/lib/project-store";

type TabId = "hooks" | "ctas" | "thumbnails" | "titles";

export default function HookDBPage() {
  const [tab, setTab] = useState<TabId>("hooks");
  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const [ctas, setCtas] = useState<CTAEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<ThumbnailWordEntry[]>([]);
  const [titles, setTitles] = useState<TitleEntry[]>([]);
  const [filterGenre, setFilterGenre] = useState<Genre | "all">("all");
  const [filterStyle, setFilterStyle] = useState<Style | "all">("all");
  const [highPerformOnly, setHighPerformOnly] = useState(false);

  useEffect(() => {
    setHooks(getHooks());
    setCtas(getCTAs());
    setThumbnails(getThumbnailWords());
    setTitles(getTitles());
  }, []);

  const [newText, setNewText] = useState("");
  const [newGenre, setNewGenre] = useState<Genre>("love");
  const [newStyle, setNewStyle] = useState<Style>("healing");
  const [newScore, setNewScore] = useState(7);
  const [newSource, setNewSource] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    const now = new Date().toISOString();
    if (tab === "hooks") {
      saveHook({ id: genId(), text: newText.trim(), genre: newGenre, style: newStyle, score: newScore, sourceVideo: newSource, sourceChannel: "", tags: [], createdAt: now });
      setHooks(getHooks());
    } else if (tab === "ctas") {
      saveCTA({ id: genId(), text: newText.trim(), genre: newGenre, style: newStyle, score: newScore, sourceVideo: newSource, sourceChannel: "", tags: [], createdAt: now });
      setCtas(getCTAs());
    } else if (tab === "thumbnails") {
      saveThumbnailWord({ id: genId(), word: newText.trim(), genre: newGenre, style: newStyle, score: newScore, sourceVideo: newSource, sourceChannel: "", createdAt: now });
      setThumbnails(getThumbnailWords());
    } else {
      saveTitle({ id: genId(), title: newText.trim(), genre: newGenre, style: newStyle, score: newScore, sourceVideo: newSource, sourceChannel: "", createdAt: now });
      setTitles(getTitles());
    }
    setNewText(""); setNewSource("");
  };

  const handleDelete = (id: string) => {
    if (tab === "hooks") { deleteHook(id); setHooks(getHooks()); }
    else if (tab === "ctas") { deleteCTA(id); setCtas(getCTAs()); }
    else if (tab === "thumbnails") { deleteThumbnailWord(id); setThumbnails(getThumbnailWords()); }
    else { deleteTitle(id); setTitles(getTitles()); }
  };

  // 平均再生数を計算（全エントリのsourceViewsから）
  const allViews = [...hooks, ...ctas, ...thumbnails, ...titles]
    .map((i) => (i as { sourceViews?: number }).sourceViews || 0)
    .filter((v) => v > 0);
  const avgViews = allViews.length > 0 ? allViews.reduce((a, b) => a + b, 0) / allViews.length : 0;
  const highPerformThreshold = avgViews * 3;

  const filterItems = <T extends { genre: Genre; style: Style; sourceViews?: number }>(items: T[]): T[] => {
    return items
      .filter((i) => (filterGenre === "all" || i.genre === filterGenre) && (filterStyle === "all" || i.style === filterStyle))
      .filter((i) => !highPerformOnly || (i.sourceViews && i.sourceViews >= highPerformThreshold));
  };

  const getItems = () => {
    if (tab === "hooks") return filterItems(hooks).sort((a, b) => b.score - a.score);
    if (tab === "ctas") return filterItems(ctas).sort((a, b) => b.score - a.score);
    if (tab === "thumbnails") return filterItems(thumbnails).sort((a, b) => b.score - a.score);
    return filterItems(titles).sort((a, b) => b.score - a.score);
  };

  const items = getItems();
  const tabLabels: Record<TabId, string> = { hooks: "フック", ctas: "CTA", thumbnails: "サムネワード", titles: "タイトル" };
  const tabCounts: Record<TabId, number> = { hooks: hooks.length, ctas: ctas.length, thumbnails: thumbnails.length, titles: titles.length };
  const placeholders: Record<TabId, string> = {
    hooks: "フックテキスト",
    ctas: "CTAテキスト",
    thumbnails: "サムネワード（例: 金運爆上げ）",
    titles: "タイトルまたはタイトル要素",
  };

  const getText = (item: HookEntry | CTAEntry | ThumbnailWordEntry | TitleEntry) => {
    if ("word" in item) return item.word;
    if ("title" in item) return item.title;
    return item.text;
  };

  const getViews = (item: HookEntry | CTAEntry | ThumbnailWordEntry | TitleEntry) => {
    return (item as { sourceViews?: number }).sourceViews;
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">フック & CTA データベース</h1>
        <p className="text-gray-500 mt-1">分析から蓄積された高パフォーマンスのフック・CTA・サムネワード・タイトルパターン</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["hooks", "ctas", "thumbnails", "titles"] as TabId[]).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === id ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
            {tabLabels[id]}（{tabCounts[id]}件）
          </button>
        ))}
      </div>

      {/* 追加フォーム */}
      <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-semibold text-sm mb-3">{tabLabels[tab]}を追加</h3>
        <div className="flex flex-wrap gap-3">
          <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)}
            placeholder={placeholders[tab]}
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
      <div className="flex flex-wrap gap-3 mb-4">
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={highPerformOnly} onChange={(e) => setHighPerformOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-accent" />
          <span className="text-sm text-gray-600">高パフォーマンスのみ（平均再生数の3倍以上）</span>
        </label>
        <span className="text-sm text-gray-500 self-center">{items.length}件</span>
        {highPerformOnly && avgViews > 0 && (
          <span className="text-xs text-gray-400 self-center">
            基準: {Math.round(highPerformThreshold).toLocaleString()}再生以上
          </span>
        )}
      </div>

      {/* リスト */}
      {items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>{tabLabels[tab]}がまだありません</p>
          <p className="text-sm mt-1">台本分析を行うと自動で蓄積されます</p>
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-card-bg rounded-lg p-4 shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{getText(item)}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[item.genre as Genre]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[item.style as Style]}</span>
                {item.sourceVideo && <span className="text-xs text-gray-400 truncate max-w-40">{item.sourceVideo}</span>}
                {getViews(item) ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getViews(item)! >= highPerformThreshold && highPerformThreshold > 0 ? "bg-green-100 text-green-700" : "text-gray-400"}`}>
                    {getViews(item)!.toLocaleString()}再生
                  </span>
                ) : null}
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
