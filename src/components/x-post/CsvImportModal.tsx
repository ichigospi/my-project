// X analytics CSV を取り込むモーダル（手動マッピング対応）
"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { XCompetitor } from "@/lib/x-post-types";
import { parseCsv, type CsvParseResult, type CsvFieldKey, type CsvParsedPost } from "@/lib/x-csv-parser";

interface Props {
  competitor: XCompetitor;
  onClose: () => void;
  onImported: () => void;
}

interface FieldDef {
  key: CsvFieldKey;
  label: string;
  required?: boolean;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: "content", label: "本文", required: true, hint: "ポスト本文" },
  { key: "impressions", label: "インプレッション", hint: "表示回数 / Impressions / Views" },
  { key: "likes", label: "いいね", hint: "Likes / Favorites" },
  { key: "retweets", label: "RT", hint: "Retweets / Reposts" },
  { key: "replies", label: "返信", hint: "Replies" },
  { key: "postedAt", label: "投稿日時", hint: "time / Date" },
  { key: "postId", label: "ポストID", hint: "Tweet id（重複検出用）" },
  { key: "postUrl", label: "ポストURL", hint: "Tweet permalink" },
];

export default function CsvImportModal({ competitor, onClose, onImported }: Props) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<CsvFieldKey, number | null>>>({});
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [upsertMode, setUpsertMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // CSV読み込み
  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setOverrides({});
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

  // パース実行（CSV変更 or overrides変更で再計算）
  const result: CsvParseResult | null = useMemo(() => {
    if (!csvText) return null;
    return parseCsv(csvText, { overrides });
  }, [csvText, overrides]);

  // 自動検出が外れた重要フィールドがあれば自動でマッピングUIを開く
  useEffect(() => {
    if (!result) return;
    const missingImportant =
      result.effectiveColumns.impressions === undefined ||
      result.effectiveColumns.likes === undefined;
    if (missingImportant) setShowMapping(true);
  }, [result]);

  const setOverride = (key: CsvFieldKey, value: number | null | undefined) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const doImport = async () => {
    if (!result || result.posts.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/x-post/posts/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorId: competitor.id,
          posts: result.posts,
          upsert: upsertMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg(`エラー: ${data.error || res.statusText}`);
        return;
      }
      const msg = upsertMode
        ? `✓ ${data.saved}件保存（うち${data.updated ?? 0}件は既存を更新）`
        : `✓ ${data.saved}件保存（${data.skipped}件は重複/空でスキップ）`;
      setImportMsg(msg);
      onImported();
    } finally {
      setImporting(false);
    }
  };

  const totalParsed = result?.posts.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
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
              <li>「ツイート」タブ → 期間選択 → 「データをエクスポート」→ 「ツイート別」→ CSV保存</li>
              <li>そのCSVを下のエリアにドラッグ＆ドロップ</li>
              <li>列の自動マッピングが外れていたら「🔧 列の割り当てを調整」で手動指定</li>
            </ol>
          </div>

          {/* ドロップゾーン */}
          {!csvText && (
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
          )}

          {/* パース結果 */}
          {result && (
            <div className="space-y-3">
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
                  {result.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                </div>
              )}

              {/* マッピング状況サマリ */}
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">
                    読み込み: <strong>{totalParsed}</strong> / {result.totalRows} 行
                  </div>
                  <button
                    onClick={() => setCsvText(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    別ファイルを選び直す
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                  {FIELDS.map((f) => {
                    const idx = result.effectiveColumns[f.key];
                    const ok = idx !== undefined;
                    return (
                      <div key={f.key} className="flex items-center gap-1">
                        <span className={ok ? "text-emerald-600" : "text-gray-400"}>
                          {ok ? "✓" : "−"}
                        </span>
                        <span className={f.required && !ok ? "text-red-700 font-medium" : "text-gray-700"}>
                          {f.label}
                        </span>
                        {ok && (
                          <span className="text-gray-400 truncate" title={result.headers[idx!]}>
                            : {result.headers[idx!]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 手動マッピング */}
              <div>
                <button
                  onClick={() => setShowMapping((v) => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  🔧 列の割り当てを{showMapping ? "閉じる" : "調整"}
                </button>
                {showMapping && (
                  <div className="mt-2 border border-gray-200 rounded p-3 space-y-2 bg-white">
                    <p className="text-xs text-gray-600">
                      自動検出が外れた場合や別の列を使いたい場合は、ここで手動指定できます。
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {FIELDS.map((f) => {
                        const currentIdx = result.effectiveColumns[f.key] ?? "";
                        const sample = currentIdx !== "" ? result.columns[currentIdx as number]?.sampleValue : "";
                        return (
                          <div key={f.key} className="grid grid-cols-[120px_1fr_2fr] items-center gap-2 text-xs">
                            <label className="text-gray-700">
                              {f.label}{f.required && <span className="text-red-500">*</span>}
                            </label>
                            <select
                              value={String(currentIdx)}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") setOverride(f.key, null);
                                else setOverride(f.key, Number(v));
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">— 使わない —</option>
                              {result.columns.map((c) => (
                                <option key={c.index} value={c.index}>
                                  {c.header}
                                </option>
                              ))}
                            </select>
                            <span className="text-gray-500 truncate" title={sample}>
                              {sample ? `例: ${sample}` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setOverrides({})}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        自動検出に戻す
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* プレビュー */}
              {result.posts.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">プレビュー（最初の3件）</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {result.posts.slice(0, 3).map((p, i) => (
                      <PreviewCard key={i} post={p} />
                    ))}
                  </div>
                </div>
              )}

              {/* インポートオプション */}
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  checked={upsertMode}
                  onChange={(e) => setUpsertMode(e.target.checked)}
                />
                <span>
                  既存ポスト（同じpostId）の指標を最新CSVで上書き更新する
                  <span className="text-gray-400 ml-1">（OFFなら重複スキップ）</span>
                </span>
              </label>
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
          {post.replies > 0 && <span>💬 {post.replies}</span>}
          <span>📊 {post.impressions.toLocaleString()}</span>
        </span>
      </div>
      <p className="text-xs text-gray-800 line-clamp-2 whitespace-pre-wrap">{post.content}</p>
    </div>
  );
}
