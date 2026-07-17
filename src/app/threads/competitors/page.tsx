"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, filesToDataUrls, fmtDate, getAiKey, getThreadsModel } from "@/lib/threads-client";

interface Competitor {
  id: string;
  handle: string;
  name: string;
  note: string;
  priority: number;
  collectLimit: number | null;
  _count?: { posts: number };
  posts?: { collectedAt: string }[];
}

const emptyForm = { handle: "", name: "", note: "", priority: 0, collectLimit: "" as number | "" };

export default function ThreadsCompetitorsPage() {
  const [accountId] = useThreadsAccountId();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [importTarget, setImportTarget] = useState<Competitor | null>(null);
  const [raw, setRaw] = useState("");
  const [importImages, setImportImages] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [error, setError] = useState("");
  // スクレイパー収集（競合ごと）
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectMsg, setCollectMsg] = useState<{ id: string; text: string; log?: string[] } | null>(null);
  const [showLog, setShowLog] = useState(false);
  // 競合追加のURL/スクショ自動入力
  const [compUrl, setCompUrl] = useState("");
  const [compImages, setCompImages] = useState<string[]>([]);
  const [compPrefilling, setCompPrefilling] = useState(false);
  const [compPrefillMsg, setCompPrefillMsg] = useState("");

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

  const runCompPrefill = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setCompPrefillMsg("エラー: AI APIキーが未設定です");
      return;
    }
    if (compImages.length === 0 && !compUrl.trim()) {
      setCompPrefillMsg("URLを入れるか、プロフィールのスクショを選択してください");
      return;
    }
    setCompPrefilling(true);
    setCompPrefillMsg("");
    try {
      const res = await api<{ prefill: { handle: string; name: string; note: string }; handle: string | null }>(
        "/api/threads/accounts/prefill",
        {
          method: "POST",
          body: JSON.stringify({
            target: "competitor",
            url: compUrl.trim() || undefined,
            images: compImages.length > 0 ? compImages : undefined,
            aiApiKey,
            model: getThreadsModel(),
          }),
        },
      );
      setForm((f) => ({
        ...f,
        handle: res.handle || f.handle,
        name: res.prefill.name || f.name,
        note: res.prefill.note || f.note,
      }));
      setCompPrefillMsg("✅ スクショから自動入力しました。確認して保存してください");
    } catch (e) {
      setCompPrefillMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCompPrefilling(false);
    }
  };

  const startEdit = (c: Competitor | null) => {
    setError("");
    setCompUrl("");
    setCompImages([]);
    setCompPrefillMsg("");
    if (!c) {
      setForm({ ...emptyForm });
      setEditing("new");
    } else {
      setForm({ handle: c.handle, name: c.name, note: c.note, priority: c.priority, collectLimit: c.collectLimit ?? "" });
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
    if (!importTarget || (!raw.trim() && importImages.length === 0)) return;
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
        body: JSON.stringify({
          competitorId: importTarget.id,
          raw: raw.trim() || undefined,
          images: importImages.length > 0 ? importImages : undefined,
          aiApiKey,
          model: getThreadsModel(),
        }),
      });
      setImportResult(`✅ ${res.createdCount}件を取り込み、${res.classified}件を自動分類しました`);
      setRaw("");
      setImportImages([]);
      await load();
    } catch (e) {
      setImportResult(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  };

  const collectOne = async (c: Competitor) => {
    setCollectingId(c.id);
    setCollectMsg({ id: c.id, text: "スクレイパーで収集中...（1〜3分かかります）" });
    try {
      const res = await api<{ itemsReturned: number; created: number; classified: number; errors: string[]; log?: string[] }>(
        "/api/threads/scraper/collect",
        { method: "POST", body: JSON.stringify({ competitorId: c.id }) },
      );
      setShowLog(false);
      setCollectMsg({
        id: c.id,
        text:
          res.errors.length > 0
            ? `⚠️ ${res.errors.join(" / ")}`
            : `✅ ${res.itemsReturned}件取得 → 新規${res.created}件を登録、${res.classified}件を自動分類`,
        log: res.log,
      });
      await load();
    } catch (e) {
      setCollectMsg({ id: c.id, text: `エラー: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setCollectingId(null);
    }
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">ベンチマーク（競合）</h2>
          <p className="text-sm text-neutral-400 mt-1">
            競合ごとに「🔄自動収集」でスクレイパーが投稿を取得します（件数は⚙️設定で調整）。スクショ/貼り付けの「📥手動取込」も併用可。
          </p>
        </div>
        <button onClick={() => startEdit(null)} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 whitespace-nowrap">
          + 競合を追加
        </button>
      </div>

      {error && !editing && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>}

      <div className="space-y-3">
        {competitors.map((c) => (
          <div key={c.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {/* ハンドル頭文字のアバター */}
                <div className="w-9 h-9 shrink-0 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-bold text-neutral-200 uppercase">
                  {(c.name || c.handle).charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-neutral-100 truncate">{c.name || `@${c.handle}`}</span>
                    {c.priority > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">重点</span>}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    @{c.handle}
                    <span className="text-neutral-600"> ・ 収集{c._count?.posts ?? 0}件</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => collectOne(c)}
                  disabled={collectingId !== null}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 disabled:opacity-50"
                >
                  {collectingId === c.id ? "収集中..." : "🔄 自動収集"}
                </button>
                <button
                  onClick={() => {
                    setImportTarget(c);
                    setImportResult("");
                    setImportImages([]);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  📥 手動取込
                </button>
                <Link href={`/threads/research?competitorId=${c.id}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  投稿を見る
                </Link>
                <button onClick={() => startEdit(c)} className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  編集
                </button>
                <button onClick={() => remove(c)} className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10">
                  削除
                </button>
              </div>
            </div>
            {collectMsg?.id === c.id && (
              <div className="mt-2">
                <p className={`text-[11px] ${collectMsg.text.startsWith("✅") ? "text-emerald-300" : collectMsg.text.startsWith("⚠️") ? "text-amber-300" : collectMsg.text.startsWith("エラー") ? "text-rose-300" : "text-neutral-400"}`}>
                  {collectMsg.text}
                </p>
                {collectMsg.log && collectMsg.log.length > 0 && (
                  <>
                    <button onClick={() => setShowLog(!showLog)} className="text-[10px] text-neutral-500 hover:text-neutral-300 underline mt-1">
                      {showLog ? "詳細を閉じる" : "詳細ログを見る"}
                    </button>
                    {showLog && (
                      <pre className="mt-1 text-[10px] text-neutral-400 whitespace-pre-wrap bg-neutral-950 rounded-lg p-2 border border-neutral-800 overflow-x-auto">
                        {collectMsg.log.join("\n")}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {competitors.length === 0 && (
          <div className="bg-neutral-900 rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
            まだ競合が登録されていません。伸びているアカウントを登録しましょう。
          </div>
        )}
      </div>

      {/* 競合追加・編集モーダル */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-lg p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100">{editing === "new" ? "競合を追加" : "競合を編集"}</h3>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">{error}</div>}

            {/* URL/スクショ自動入力 */}
            <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3 space-y-2">
              <span className="text-xs font-bold text-neutral-200">🔮 自動入力（URL or スクショ）</span>
              <input
                value={compUrl}
                onChange={(e) => setCompUrl(e.target.value)}
                className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
                placeholder="https://www.threads.net/@競合のアカウント"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 cursor-pointer whitespace-nowrap">
                  📷 プロフのスクショを選択
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length === 0) return;
                      setCompPrefillMsg("");
                      const urls = await filesToDataUrls(files);
                      setCompImages((prev) => [...prev, ...urls].slice(0, 5));
                      e.target.value = "";
                    }}
                  />
                </label>
                {compImages.length > 0 && (
                  <div className="flex gap-1.5">
                    {compImages.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`スクショ${i + 1}`} className="h-10 w-10 object-cover rounded border border-neutral-600" />
                    ))}
                  </div>
                )}
                <button
                  onClick={runCompPrefill}
                  disabled={compPrefilling || (compImages.length === 0 && !compUrl.trim())}
                  className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 whitespace-nowrap"
                >
                  {compPrefilling ? "解析中...（URLの場合1〜2分）" : "自動入力"}
                </button>
              </div>
              {compPrefillMsg && (
                <p className={`text-[11px] ${compPrefillMsg.startsWith("✅") ? "text-emerald-300" : "text-rose-300"}`}>{compPrefillMsg}</p>
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-neutral-300">ハンドル *（@なし）</span>
              <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-300">名前</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-300">メモ（なぜベンチマークするか等）</span>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-300">取得件数（この競合を自動収集するときの件数）</span>
              <input
                type="number"
                min={1}
                max={200}
                value={form.collectLimit}
                onChange={(e) => setForm({ ...form, collectLimit: e.target.value === "" ? "" : Number(e.target.value) })}
                className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
                placeholder="空欄 = 設定の既定値を使う"
              />
              <span className="text-[10px] text-neutral-600">多いほど過去に遡れます。伸びてる大手は多め、投稿頻度の低いアカは少なめ、のように使い分けできます。</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={form.priority > 0} onChange={(e) => setForm({ ...form, priority: e.target.checked ? 1 : 0 })} />
              重点ベンチマークにする（一覧の上位に表示）
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800">キャンセル</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 貼り付け取り込みモーダル */}
      {importTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !importing && setImportTarget(null)}>
          <div className="bg-neutral-900 rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100">@{importTarget.handle} の投稿を取り込む</h3>
            <p className="text-xs text-neutral-400">
              <span className="font-bold text-neutral-200">スクショ推奨:</span> Threads画面のスクショを選ぶだけで、AIが投稿本文といいね・コメント数を読み取ります（最大5枚）。
              テキストのコピペでもOK。両方入れると両方読みます。
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 cursor-pointer whitespace-nowrap">
                📷 スクショを選択
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    const urls = await filesToDataUrls(files);
                    setImportImages((prev) => [...prev, ...urls].slice(0, 5));
                    e.target.value = "";
                  }}
                />
              </label>
              {importImages.length > 0 && (
                <>
                  <div className="flex gap-1.5">
                    {importImages.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`スクショ${i + 1}`} className="h-12 w-12 object-cover rounded border border-neutral-600" />
                    ))}
                  </div>
                  <button onClick={() => setImportImages([])} className="text-[11px] text-neutral-500 hover:text-neutral-300 underline">
                    クリア
                  </button>
                </>
              )}
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder={"（テキスト派はこちら）\n\n会社員のまま月10万稼ぐ人がやってる3つのこと\n①…\n②…\n③…\nいいね1,234 コメント56 再投稿78\nhttps://www.threads.net/@xxx/post/yyy\n\n---（複数投稿を続けて貼ってOK）"}
            />
            {importResult && (
              <div className={`rounded-lg p-3 text-sm ${importResult.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
                {importResult}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportTarget(null)} disabled={importing} className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
                閉じる
              </button>
              <button
                onClick={runImport}
                disabled={importing || (!raw.trim() && importImages.length === 0)}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
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
