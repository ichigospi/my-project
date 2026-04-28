"use client";

import { useState } from "react";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import AccountInfoTab from "@/components/x-post/AccountInfoTab";
import TeachingsTab from "@/components/x-post/TeachingsTab";
import ReferencesTab from "@/components/x-post/ReferencesTab";
import MemosTab from "@/components/x-post/MemosTab";

type Tab = "account" | "teachings" | "references" | "memos";

const TABS: { value: Tab; label: string; emoji: string; description: string }[] = [
  { value: "account", label: "自アカ情報", emoji: "📌", description: "コンセプト・口調・KW・過去のストーリー" },
  { value: "teachings", label: "教材", emoji: "📖", description: "学んだ教材・ノウハウから抽出した指示書" },
  { value: "references", label: "参考ポスト", emoji: "📥", description: "伸びた投稿の実例集（フォルダ分け対応）" },
  { value: "memos", label: "メモ", emoji: "📝", description: "自由記述メモ" },
];

export default function KnowledgePage() {
  const [genre] = useXPostGenre();
  const [tab, setTab] = useState<Tab>("account");
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";
  const tabMeta = TABS.find((t) => t.value === tab);

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📚</span>
          ナレッジ管理
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          自アカ情報・教材・参考ポスト・メモを統一管理。AI生成時にここの内容が参照されます。
        </p>
      </div>

      {/* 4タブ */}
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
        {tab === "account" && <AccountInfoTab />}
        {tab === "teachings" && <TeachingsTab />}
        {tab === "references" && <ReferencesTab />}
        {tab === "memos" && <MemosTab />}
      </div>
    </main>
  );
}
