"use client";

import { useState } from "react";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import SingleTemplatesTab from "@/components/x-post/SingleTemplatesTab";
import SequencePatternsTab from "@/components/x-post/SequencePatternsTab";

type Tab = "single" | "sequence";

const TABS: { value: Tab; label: string; emoji: string; description: string }[] = [
  {
    value: "single",
    label: "単一ポストテンプレ",
    emoji: "📋",
    description: "1ポスト分の構造（フック・教育タイプ・スケルトン）を保存して再利用",
  },
  {
    value: "sequence",
    label: "シーケンスパターン",
    emoji: "🔗",
    description: "複数ポストの流れ + 接続タイプ（引用RT / 連投 / 独立 / ストーリー連投）",
  },
];

export default function TemplatesPage() {
  const [genre] = useXPostGenre();
  const [tab, setTab] = useState<Tab>("single");
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";
  const tabMeta = TABS.find((t) => t.value === tab);

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📋</span>
          テンプレ + シーケンスパターン
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          単一ポストの型と複数ポストの連鎖パターンを管理。生成画面・デイリープランから参照されます。
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg mb-4">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.value
                  ? "border-indigo-500 text-indigo-600 bg-indigo-50/50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
        {tabMeta && (
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
            {tabMeta.description}
          </div>
        )}
      </div>

      <div>
        {tab === "single" && <SingleTemplatesTab />}
        {tab === "sequence" && <SequencePatternsTab />}
      </div>
    </main>
  );
}
