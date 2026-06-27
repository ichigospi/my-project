"use client";

import { GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { ScriptProject, Genre, Style } from "@/lib/project-store";

const STYLE_ICONS: Record<Style, string> = {
  healing: "🌸",
  education: "📚",
  tarot: "🃏",
};

const STYLE_DESCRIPTIONS: Record<Style, string> = {
  healing: "癒し・瞑想・エネルギーワーク",
  education: "知識・解説・啓蒙",
  tarot: "リーディング進行型のカード鑑定",
};

export default function StepGenre({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  // 全スタイルを常時表示(チャンネル別の出し分けは廃止)
  const visibleStyles = Object.entries(STYLE_LABELS) as [Style, string][];
  const gridCols = visibleStyles.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-xl font-bold mb-6">① ジャンル & スタイルを選択</h2>

      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-semibold text-sm mb-3">ジャンル</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(GENRE_LABELS) as [Genre, string][]).map(([key, label]) => (
            <button key={key} onClick={() => onUpdate({ ...project, genre: key })}
              className={`p-4 rounded-xl text-center border-2 transition-all ${
                project.genre === key ? "border-accent bg-accent/5 text-accent" : "border-gray-100 hover:border-gray-200"
              }`}>
              <span className="text-2xl block mb-1">{key === "love" ? "💕" : key === "money" ? "💰" : "🌟"}</span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-semibold text-sm mb-3">スタイル</h3>
        <div className={`grid ${gridCols} gap-3`}>
          {visibleStyles.map(([key, label]) => (
            <button key={key} onClick={() => onUpdate({ ...project, style: key })}
              className={`p-4 rounded-xl text-center border-2 transition-all ${
                project.style === key ? "border-accent bg-accent/5 text-accent" : "border-gray-100 hover:border-gray-200"
              }`}>
              <span className="text-2xl block mb-1">{STYLE_ICONS[key]}</span>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-gray-500 block mt-1">
                {STYLE_DESCRIPTIONS[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => onUpdate({ ...project, status: "title" })}
        className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90">
        次へ →
      </button>
    </div>
  );
}
