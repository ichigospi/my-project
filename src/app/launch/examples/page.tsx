"use client";

import { useState, useEffect, useCallback } from "react";

interface LaunchExample {
  id: string;
  type: string;
  title: string;
  content: string;
  note: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  posts_phase1: "Phase 1 投稿",
  posts_phase2: "Phase 2 投稿",
  posts_phase3: "Phase 3 投稿",
  columns: "コラム",
  letter: "セールスレター",
  line: "LINE配信",
};

const TYPE_FILTERS = [
  { value: "", label: "すべて" },
  { value: "posts_phase1", label: "Phase 1 投稿" },
  { value: "posts_phase2", label: "Phase 2 投稿" },
  { value: "posts_phase3", label: "Phase 3 投稿" },
  { value: "columns", label: "コラム" },
  { value: "letter", label: "セールスレター" },
  { value: "line", label: "LINE配信" },
];

export default function LaunchExamplesPage() {
  const [examples, setExamples] = useState<LaunchExample[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/launch/examples?type=${filter}` : "/api/launch/examples";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "読み込みに失敗しました");
        return;
      }
      setExamples(data.examples);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("この実例を削除しますか？")) return;
      try {
        const res = await fetch(`/api/launch/examples?id=${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "削除に失敗しました");
          return;
        }
        setExamples((prev) => prev.filter((ex) => ex.id !== id));
      } catch {
        setError("通信エラーが発生しました");
      }
    },
    []
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">学習した実例集</h1>
        <p className="text-sm text-gray-500 mt-1">
          「実例集に追加」ボタンで保存した実例。次回の生成時に自動で参照されます。
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-accent text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">読み込み中...</div>
      ) : examples.length === 0 ? (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500">
            まだ実例がありません。生成結果の「実例集に追加」ボタンから保存してください。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map((ex) => {
            const isExpanded = expanded === ex.id;
            return (
              <div
                key={ex.id}
                className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                        {TYPE_LABELS[ex.type] || ex.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(ex.createdAt).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    {ex.title && <h3 className="text-sm font-bold text-foreground">{ex.title}</h3>}
                    {ex.note && <p className="text-xs text-gray-500 mt-1">メモ: {ex.note}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(ex.id)}
                    className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    削除
                  </button>
                </div>
                <button
                  onClick={() => setExpanded(isExpanded ? null : ex.id)}
                  className="text-xs text-accent hover:underline"
                >
                  {isExpanded ? "閉じる" : "本文を表示"}
                </button>
                {isExpanded && (
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-foreground/80 bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto font-sans leading-relaxed">
                    {ex.content}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
