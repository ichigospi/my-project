"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, fmtDate, getAiKey, getThreadsModel } from "@/lib/threads-client";

interface Competitor {
  id: string;
  handle: string;
  name: string;
  note: string;
  priority: number;
  _count?: { posts: number };
  posts?: { collectedAt: string }[];
}

const emptyForm = { handle: "", name: "", note: "", priority: 0 };

export default function ThreadsCompetitorsPage() {
  const [accountId] = useThreadsAccountId();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [importTarget, setImportTarget] = useState<Competitor | null>(null);
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setCompetitors(await api<Competitor[]>(`/api/threads/competitors?accountId=${accountId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (c: Competitor | null) => {
    setError("");
    if (!c) {
      setForm({ ...emptyForm });
      setEditing("new");
    } else {
      setForm({ handle: c.handle, name: c.name, note: c.note, priority: c.priority });
      setEditing(c.id);
    }
  };

  const save = async () => {
    if (!form.handle.trim()) {
      setError("ハンドルは必須です");
      return;
    }
    setError("");
    try {
      if (editing === "new") {
        await api("/api/threads/competitors", { method: "POST", body: JSON.stringify({ ...form, accountId }) });
      } else {
        await api(`/api/threads/competitors/${editing}`, { method: "PATCH", body: JSON.stringify(form) });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (c: Competitor) => {
    if (!confirm(`@${c.handle} を削除しますか？収集済み投稿（${c._count?.posts ?? 0}件）も削除されます。`)) return;
    await api(`/api/threads/competitors/${c.id}`, { method: "DELETE" });
    await load();
  };

  const runImport = async () => {
    if (!importTarget || !raw.trim()) return;
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setImportResult("エラー: AI APIキーが未設定です。設定ページで登録してください。");
      return;
    }
    setImporting(true);
    setImportResult("");
    try {
      const res = await api<{ createdCount: number; classified: number }>("/api/threads/competitor-posts/parse", {
        method: "POST",
        body: JSON.stringify({ competitorId: importTarget.id, raw, aiApiKey, model: getThreadsModel() }),
      });
      setImportResult(`✅ ${res.createdCount}件を取り込み、${res.classified}件を自動分類しました`);
      setRaw("");
      await load();
    } catch (e) {
      setImportResult(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ベンチマーク（競合）</h2>
          <p className="text-sm text-gray-600 mt-1">
            競合を登録し、伸びている投稿をコピペで取り込みます。AIが本文と数値を自動で整理・分類します。
          </p>
        </div>
        <button onClick={() => startEdit(null)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 whitespace-nowrap">
          + 競合を追加
        </button>
      </div>

      {error && !editing && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

      <div className="space-y-3">
        {competitors.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">@{c.handle}</span>
                  {c.name && <span className="text-sm text-gray-500">{c.name}</span>}
                  {c.priority > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">重点</span>}
                </div>
                {c.note && <p className="text-xs text-gray-600 mt-1">{c.note}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  収集 {c._count?.posts ?? 0}件
                  {c.posts?.[0] && ` / 最終取込 ${fmtDate(c.posts[0].collectedAt)}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => {
                    setImportTarget(c);
                    setImportResult("");
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700"
                >
                  📥 投稿を取り込む
                </button>
                <Link href={`/threads/research?competitorId=${c.id}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  投稿を見る
                </Link>
                <button onClick={() => startEdit(c)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  編集
                </button>
                <button onClick={() => remove(c)} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
        {competitors.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            まだ競合が登録されていません。伸びているアカウントを登録しましょう。
          </div>
        )}
      </div>

      {/* 競合追加・編集モーダル */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{editing === "new" ? "競合を追加" : "競合を編集"}</h3>
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}
            <label className="block">
              <span className="text-xs font-medium text-gray-700">ハンドル *（@なし）</span>
              <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">名前</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">メモ（なぜベンチマークするか等）</span>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.priority > 0} onChange={(e) => setForm({ ...form, priority: e.target.checked ? 1 : 0 })} />
              重点ベンチマークにする（一覧の上位に表示）
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 貼り付け取り込みモーダル */}
      {importTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !importing && setImportTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">@{importTarget.handle} の投稿を取り込む</h3>
            <p className="text-xs text-gray-600">
              Threadsの画面から投稿をコピーして貼り付けてください（複数投稿まとめてOK）。
              いいね・コメント数などの数字が含まれていればAIが自動で拾います。投稿URLも一緒に貼ると後で追いやすくなります。
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder={"例:\n\n会社員のまま月10万稼ぐ人がやってる3つのこと\n①…\n②…\n③…\nいいね1,234 コメント56 再投稿78\nhttps://www.threads.net/@xxx/post/yyy\n\n---（複数投稿を続けて貼ってOK）"}
            />
            {importResult && (
              <div className={`rounded-lg p-3 text-sm ${importResult.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
                {importResult}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportTarget(null)} disabled={importing} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                閉じる
              </button>
              <button
                onClick={runImport}
                disabled={importing || !raw.trim()}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {importing ? "AIが整理中...（数十秒かかります）" : "取り込む"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
