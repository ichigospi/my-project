// 基礎教材タブ: x_post_system/ 配下のマークダウンを読み取り専用で表示
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";

interface FileEntry {
  category: "common" | "business" | "spiritual" | "prompts";
  filename: string;
  relativePath: string;
  label: string;
}

interface FileContent {
  file: string;
  label: string;
  content: string;
  bytes: number;
}

const CATEGORY_LABEL: Record<FileEntry["category"], string> = {
  common: "🌐 共通教材（13個の中核）",
  business: "💼 ビジ垢専用",
  spiritual: "🔮 占い垢専用",
  prompts: "🧠 プロンプト",
};

export default function BaseKnowledgeTab() {
  const [genre] = useXPostGenre();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<FileContent | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await fetch("/api/x-post/base-knowledge");
      const data = await r.json();
      setFiles(Array.isArray(data.files) ? data.files : []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ジャンルに応じて初期選択を決める
  useEffect(() => {
    if (selected || files.length === 0) return;
    const first =
      files.find((f) => f.relativePath === "knowledge_common/post_principles.md") ??
      files[0];
    if (first) setSelected(first.relativePath);
  }, [files, selected]);

  // 選択ファイルの中身取得
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingContent(true);
    fetch(`/api/x-post/base-knowledge?file=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data: FileContent) => {
        if (cancelled) return;
        setContent(data.content !== undefined ? data : null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingContent(false);
      });
    return () => { cancelled = true; };
  }, [selected]);

  // ジャンルに応じて表示するセクションを絞る（共通＋自ジャンル＋プロンプト）
  const visibleFiles = useMemo(() => {
    return files.filter((f) => {
      if (f.category === "common" || f.category === "prompts") return true;
      return f.category === genre;
    });
  }, [files, genre]);

  const grouped = useMemo(() => {
    const map: Record<FileEntry["category"], FileEntry[]> = {
      common: [], business: [], spiritual: [], prompts: [],
    };
    for (const f of visibleFiles) map[f.category].push(f);
    return map;
  }, [visibleFiles]);

  const orderedCategories: FileEntry["category"][] = ["common", genre as "business" | "spiritual", "prompts"];

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 bg-amber-50/50">
        <p className="text-xs text-amber-900">
          📖 ここに表示される内容が、AI生成・分析・テンプレ抽出時にプロンプトへキャッシュ注入されます（読み取り専用）。
          編集したい場合は <code className="bg-white px-1 rounded">x_post_system/</code> 配下のmdファイルを直接編集してください。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* 左: ファイル一覧 */}
        <div className="max-h-[70vh] overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-sm text-gray-500">読み込み中...</div>
          ) : visibleFiles.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">教材ファイルが見つかりません</div>
          ) : (
            <div className="py-2">
              {orderedCategories.map((cat) =>
                grouped[cat].length === 0 ? null : (
                  <div key={cat} className="mb-2">
                    <div className="px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {CATEGORY_LABEL[cat]}
                    </div>
                    {grouped[cat].map((f) => (
                      <button
                        key={f.relativePath}
                        onClick={() => setSelected(f.relativePath)}
                        className={`w-full text-left px-3 py-2 text-sm border-l-2 transition ${
                          selected === f.relativePath
                            ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                            : "border-transparent text-gray-700 hover:bg-gray-50"
                        }`}
                        title={f.relativePath}
                      >
                        <div className="font-medium truncate">{f.label}</div>
                        <div className="text-xs text-gray-500 truncate">{f.filename}</div>
                      </button>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* 右: 中身 */}
        <div className="min-w-0">
          {loadingContent ? (
            <div className="p-6 text-sm text-gray-500">読み込み中...</div>
          ) : content ? (
            <div>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{content.label}</div>
                  <div className="text-xs text-gray-500 truncate">{content.file} · {(content.bytes / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(content.content)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 shrink-0"
                >
                  📋 コピー
                </button>
              </div>
              <pre className="p-4 text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-auto">
                {content.content || "(空)"}
              </pre>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-500">左のリストから教材を選んでください</div>
          )}
        </div>
      </div>
    </div>
  );
}
