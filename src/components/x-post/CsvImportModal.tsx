// X analytics CSV を取り込むモーダル
"use client";

import { useState, useRef, useCallback } from "react";
import type { XCompetitor } from "@/lib/x-post-types";
import { parseCsv, type CsvParsedPost, type CsvParseResult } from "@/lib/x-csv-parser";

interface Props {
  competitor: XCompetitor;
  onClose: () => void;
  onImported: () => void;
}

export default function CsvImportModal({ competitor, onClose, onImported }: Props) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const result = parseCsv(text);
    setParseResult(result);
    setImportMsg(null);
  }, []);

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const doImport = async () => {
    if (!parseResult || parseResult.posts.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/x-post/posts/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: competitor.id,
          posts: parseResult.posts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg(`エラー: ${data.error || res.statusText}`);
        return;
      }
      setImportMsg(`✓ ${data.saved}件保存（${data.skipped}件は重複/空でスキップ）`);
      onImported();
    } finally {
      setImporting(false);
    }
  };

  const totalParsed = parseResult?.posts.length ?? 0;
  const expectedKeys = ["postId", "postUrl", "content", "likes", "retweets", "replies", "impressions", "postedAt"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">📁 CSVインポート</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              対象: 🪞 @{competitor.handle}{competitor.name && `（${competitor.name}）`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 案内 */}
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
            <p><strong>取り込み手順:</strong></p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li><a href="https://analytics.twitter.com" target="_blank" rel="noopener noreferrer" className="underline">https://analytics.twitter.com</a> を開く（X Premium加入者のみ）</li>
              <li>「ツイート」タブ → 期間を選択 → 「データをエクスポート」→ 「ツイート別」→ CSV保存</li>
              <li>そのCSVを下のエリアにドラッグ＆ドロップ または ファイル選択</li>
            </ol>
            <p>postId が一致するポストは自動でスキップされます（再インポートしても重複しません）。</p>
          </div>

          {/* ドロップゾーン */}
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
              dragOver
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
            }`}
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm font-medium text-gray-700">クリックでファイル選択 or ドラッグ＆ドロップ</p>
            <p className="text-xs text-gray-500 mt-1">.csv / .tsv / .txt 対応</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={onPick}
            />
          </div>

          {/* パース結果プレビュー */}
          {parseResult && (
            <div className="space-y-3">
              {parseResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
                  {parseResult.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  読み込み結果: <strong>{totalParsed}</strong> / {parseResult.totalRows} 行
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <strong>検出されたカラム:</strong>
                    <ul className="ml-3 mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {expectedKeys.map((k) => (
                        <li key={k} className="flex items-center gap-1">
                          <span className={parseResult.detectedColumns[k] ? "text-emerald-600" : "text-gray-400"}>
                            {parseResult.detectedColumns[k] ? "✓" : "−"}
                          </span>
                          <span className="text-gray-700">{k}:</span>
                          <span className="text-gray-500 truncate">
                            {parseResult.detectedColumns[k] ?? "（未マッピング）"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {parseResult.unmappedHeaders.length > 0 && (
                    <div className="mt-2 text-gray-500">
                      <strong>無視するカラム:</strong> {parseResult.unmappedHeaders.slice(0, 8).join(", ")}
                      {parseResult.unmappedHeaders.length > 8 && ` 他${parseResult.unmappedHeaders.length - 8}個`}
                    </div>
                  )}
                </div>
              </div>

              {/* プレビュー（上位3件） */}
              {parseResult.posts.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">プレビュー（最初の3件）</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parseResult.posts.slice(0, 3).map((p, i) => (
                      <PreviewCard key={i} post={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {importMsg && (
            <div className={`text-sm rounded px-3 py-2 ${
              importMsg.startsWith("✓")
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {importMsg}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">
            キャンセル
          </button>
          <button
            onClick={doImport}
            disabled={importing || totalParsed === 0}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-1.5 rounded"
          >
            {importing ? "インポート中..." : `${totalParsed}件をインポート`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ post }: { post: CsvParsedPost }) {
  return (
    <div className="border border-gray-200 rounded p-2 bg-white">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{post.postedAt ? new Date(post.postedAt).toLocaleDateString() : "(日付なし)"}</span>
        <span className="flex gap-2">
          <span>👍 {post.likes}</span>
          <span>🔁 {post.retweets}</span>
          {post.impressions > 0 && <span>📊 {post.impressions.toLocaleString()}</span>}
        </span>
      </div>
      <p className="text-xs text-gray-800 line-clamp-2 whitespace-pre-wrap">{post.content}</p>
    </div>
  );
}
