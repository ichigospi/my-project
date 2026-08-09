// 競合投稿の読み込みページ: プロフスクショで競合追加 → 投稿読込 → 企画として追加（目的/教育/タグ）
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, filesToDataUrls, getAiKey, getThreadsModel } from "@/lib/threads-client";

interface Competitor {
  id: string;
  handle: string;
  name: string;
}

// 教育型のクイックタグ（タップで追加）
const EDU_TAGS = [
  "問題提起",
  "常識破壊",
  "口コミ・信頼",
  "過去ストーリー",
  "選ばれたあなた",
  "権威性",
  "感謝",
  "投資・変化",
  "GIVE循環",
  "囲い込み",
  "タイムライン遡り",
];

function ImportContent() {
  const [accountId] = useThreadsAccountId();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  // 競合の選択 or 追加
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [competitorId, setCompetitorId] = useState("");
  const [profImages, setProfImages] = useState<string[]>([]);
  const [prefilling, setPrefilling] = useState(false);
  const [newComp, setNewComp] = useState({ handle: "", name: "", note: "" });

  // 企画のタグ付け
  const [purpose, setPurpose] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // 投稿読込
  const [postFormat, setPostFormat] = useState<"short" | "long" | "tree">("short");
  const [images, setImages] = useState<string[]>([]);
  const [raw, setRaw] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadCompetitors = useCallback(async () => {
    if (!accountId) return;
    try {
      const list = await api<Competitor[]>(`/api/threads/competitors?accountId=${accountId}`);
      setCompetitors(list);
      if (list.length > 0 && !competitorId) setCompetitorId(list[0].id);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    loadCompetitors();
  }, [loadCompetitors]);

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    setTags((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // プロフスクショから競合情報を推定
  const runProfPrefill = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setMsg("エラー: AI APIキーが未設定です（設定画面で登録）");
      return;
    }
    if (profImages.length === 0) {
      setMsg("プロフィールのスクショを入れてください");
      return;
    }
    setPrefilling(true);
    setMsg("");
    try {
      const res = await api<{ prefill: { name: string; note: string }; handle: string | null }>(
        "/api/threads/accounts/prefill",
        {
          method: "POST",
          body: JSON.stringify({ target: "competitor", images: profImages, aiApiKey, model: getThreadsModel() }),
        },
      );
      setNewComp({
        handle: res.handle ?? "",
        name: res.prefill.name ?? "",
        note: res.prefill.note ?? "",
      });
      setMsg("✅ プロフから読み取りました。内容を確認して「企画として追加」で保存されます。");
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPrefilling(false);
    }
  };

  // 新規競合を作成 or 既存を返す
  const ensureCompetitorId = async (): Promise<string | null> => {
    if (mode === "existing") return competitorId || null;
    if (!newComp.handle.trim()) {
      setMsg("競合のハンドル（@なし）を入れてください");
      return null;
    }
    try {
      const created = await api<Competitor>("/api/threads/competitors", {
        method: "POST",
        body: JSON.stringify({ accountId, handle: newComp.handle, name: newComp.name, note: newComp.note }),
      });
      await loadCompetitors();
      return created.id;
    } catch (e) {
      // 既に登録済みなら既存を探して使う
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("既に登録")) {
        const list = await api<Competitor[]>(`/api/threads/competitors?accountId=${accountId}`);
        const found = list.find((c) => c.handle.replace(/^@/, "") === newComp.handle.replace(/^@/, ""));
        if (found) return found.id;
      }
      setMsg(`エラー: ${msg}`);
      return null;
    }
  };

  const submit = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setMsg("エラー: AI APIキーが未設定です（設定画面で登録）");
      return;
    }
    if (images.length === 0 && !raw.trim()) {
      setMsg("投稿のスクショ、または貼り付けテキストを入れてください");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const cid = await ensureCompetitorId();
      if (!cid) {
        setSaving(false);
        return;
      }
      const res = await api<{ createdCount: number; classified: number }>("/api/threads/competitor-posts/parse", {
        method: "POST",
        body: JSON.stringify({
          competitorId: cid,
          raw: raw.trim() || undefined,
          images: images.length > 0 ? images : undefined,
          postFormat,
          tags,
          purpose: purpose.trim() || undefined,
          aiApiKey,
          model: getThreadsModel(),
        }),
      });
      const fmt = postFormat === "tree" ? "長文ツリー" : postFormat === "long" ? "長文" : "短文";
      setMsg(`✅ ${fmt}として ${res.createdCount}件を企画に追加（${res.classified}件を自動分類）。タグ: ${tags.join(" / ") || "なし"}`);
      // 投稿系だけリセット（競合・タグは連続登録しやすいよう保持）
      setImages([]);
      setRaw("");
      await loadCompetitors();
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">競合投稿の読み込み</h2>
          <p className="text-sm text-neutral-400 mt-1">
            プロフのスクショで競合を追加し、投稿を「企画」として目的・教育・タグ付きで登録します。タグは
            <Link href="/threads/research" className="text-sky-400 underline mx-1">リサーチ</Link>
            で検索できます。
          </p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
          {msg}
        </div>
      )}

      {/* ① 競合アカウント */}
      <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <h3 className="text-sm font-bold text-neutral-100">① 競合アカウント</h3>
        <div className="inline-flex rounded-lg bg-neutral-800 p-0.5">
          {([
            ["existing", "登録済みから選ぶ"],
            ["new", "プロフスクショで追加"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === v ? "bg-neutral-950 text-white shadow" : "text-neutral-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          competitors.length > 0 ? (
            <select
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value)}
              className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            >
              {competitors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `@${c.handle}`}（@{c.handle}）
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-neutral-500">まだ競合がいません。「プロフスクショで追加」で登録してください。</p>
          )
        ) : (
          <div className="space-y-2">
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
                    const urls = await filesToDataUrls(files, 1600, 4);
                    setProfImages((prev) => [...prev, ...urls].slice(0, 4));
                    e.target.value = "";
                  }}
                />
              </label>
              {profImages.length > 0 && (
                <>
                  <div className="flex gap-1.5">
                    {profImages.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`prof${i}`} className="h-10 w-10 object-cover rounded border border-neutral-600" />
                    ))}
                  </div>
                  <button onClick={() => setProfImages([])} className="text-[11px] text-neutral-500 hover:text-neutral-300 underline">クリア</button>
                </>
              )}
              <button
                onClick={runProfPrefill}
                disabled={prefilling}
                className="px-3.5 py-2 rounded-lg bg-neutral-800 text-neutral-100 text-xs font-bold hover:bg-neutral-700 disabled:opacity-50 whitespace-nowrap"
              >
                {prefilling ? "読取中..." : "スクショから読み取り"}
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                value={newComp.handle}
                onChange={(e) => setNewComp({ ...newComp, handle: e.target.value })}
                placeholder="ハンドル（@なし）*"
                className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newComp.name}
                onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
                placeholder="表示名"
                className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newComp.note}
                onChange={(e) => setNewComp({ ...newComp, note: e.target.value })}
                placeholder="メモ（何者か）"
                className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <p className="text-[10px] text-neutral-600">「企画として追加」を押すと、この競合が未登録なら自動で登録されます。</p>
          </div>
        )}
      </section>

      {/* ② 企画のタグ付け */}
      <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <h3 className="text-sm font-bold text-neutral-100">② 企画として整理（目的・教育・タグ）</h3>
        <label className="block">
          <span className="text-xs text-neutral-400">目的（この投稿を参考にする狙い）</span>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="例: 無料鑑定への導線を強化 / 権威づけ"
            className="mt-1 w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <div>
          <span className="text-xs text-neutral-400">教育（タップで追加）</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {EDU_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className={`text-[11px] px-2 py-1 rounded-lg border ${tags.includes(t) ? "bg-white text-black border-white" : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-neutral-500"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-neutral-400">タグ（目的・競合名・キーワードなど自由に）</span>
          <div className="flex gap-2 mt-1">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              placeholder="入力してEnterで追加"
              className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                addTag(tagInput);
                setTagInput("");
              }}
              className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-800"
            >
              追加
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200">
                  #{t}
                  <button onClick={() => removeTag(t)} className="hover:text-white">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ③ 投稿を読み込む */}
      <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <h3 className="text-sm font-bold text-neutral-100">③ 投稿を読み込む</h3>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { v: "short", label: "短文" },
            { v: "long", label: "長文" },
            { v: "tree", label: "長文ツリー" },
          ] as const).map((f) => (
            <button
              key={f.v}
              onClick={() => setPostFormat(f.v)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${postFormat === f.v ? "bg-white text-black border-white font-bold" : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-neutral-500"}`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-[11px] text-neutral-500 self-center">
            {postFormat === "tree"
              ? "🌳 本文→続きの順で複数枚。1投稿に結合"
              : postFormat === "long"
                ? "📄 複数枚でも1投稿に結合"
                : "✏️ それぞれ別投稿として取込"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 cursor-pointer whitespace-nowrap">
            📷 投稿スクショを選択
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                const urls = await filesToDataUrls(files, 1600, 8);
                setImages((prev) => [...prev, ...urls].slice(0, 8));
                e.target.value = "";
              }}
            />
          </label>
          {images.length > 0 && (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`p${i}`} className="h-10 w-10 object-cover rounded border border-neutral-600" />
                ))}
              </div>
              <span className="text-[11px] text-neutral-500">{images.length}枚</span>
              <button onClick={() => setImages([])} className="text-[11px] text-neutral-500 hover:text-neutral-300 underline">クリア</button>
            </>
          )}
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs font-mono"
          placeholder="（テキスト派はこちら）本文＋いいね数などを貼り付け"
        />
      </section>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "追加中...（AIが整理中・数十秒）" : "＋ 企画として追加"}
      </button>
    </main>
  );
}

export default function ThreadsImportPage() {
  return (
    <Suspense fallback={<main className="px-6 py-6 text-sm text-neutral-500">読み込み中...</main>}>
      <ImportContent />
    </Suspense>
  );
}
