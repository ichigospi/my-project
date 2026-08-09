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

interface TagCat {
  id: string;
  accountId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
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

  // 投稿読込（1投稿=1枠。複数枠で一括登録）
  type Slot = { format: "short" | "long" | "tree"; images: string[]; raw: string };
  const [slots, setSlots] = useState<Slot[]>([{ format: "short", images: [], raw: "" }]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagCats, setTagCats] = useState<TagCat[]>([]);

  useEffect(() => {
    if (!accountId) return;
    api<{ tags: { tag: string; count: number }[] }>(`/api/threads/tags?accountId=${accountId}`)
      .then((r) => setAllTags(r.tags.map((t) => t.tag)))
      .catch(() => {});
    api<{ categories: TagCat[] }>(`/api/threads/tag-categories?accountId=${accountId}`)
      .then((r) => setTagCats(r.categories))
      .catch(() => {});
  }, [accountId]);

  const childrenOf = (pid: string | null) => tagCats.filter((c) => (c.parentId ?? null) === pid);
  const toggleTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    setTags((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

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

  // 枠の操作
  const addSlot = () => setSlots((prev) => [...prev, { format: "short", images: [], raw: "" }]);
  const removeSlot = (i: number) =>
    setSlots((prev) => {
      const next = prev.filter((_, j) => j !== i);
      return next.length === 0 ? [{ format: "short", images: [], raw: "" }] : next;
    });
  const updateSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSlotImages = async (i: number, files: File[]) => {
    if (files.length === 0) return;
    const urls = await filesToDataUrls(files, 1600, 8);
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, images: [...s.images, ...urls].slice(0, 8) } : s)));
  };
  const removeSlotImage = (i: number, ii: number) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, images: s.images.filter((_, k) => k !== ii) } : s)));

  const submit = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setMsg("エラー: AI APIキーが未設定です（設定画面で登録）");
      return;
    }
    const filled = slots.filter((s) => s.images.length > 0 || s.raw.trim());
    if (filled.length === 0) {
      setMsg("投稿のスクショ、または貼り付けテキストを入れてください（枠に何も入っていません）");
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
      let totalCreated = 0;
      let totalClassified = 0;
      const errors: string[] = [];
      for (let i = 0; i < filled.length; i++) {
        setMsg(`登録中... (${i + 1}/${filled.length}枠)`);
        const s = filled[i];
        const r = await fetch("/api/threads/competitor-posts/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitorId: cid,
            raw: s.raw.trim() || undefined,
            images: s.images.length > 0 ? s.images : undefined,
            postFormat: s.format,
            tags,
            purpose: purpose.trim() || undefined,
            aiApiKey,
            model: getThreadsModel(),
          }),
        });
        const data = (await r.json().catch(() => ({}))) as { createdCount?: number; classified?: number; error?: string };
        if (!r.ok) {
          errors.push(`枠${i + 1}: ${data.error || `HTTP ${r.status}`}`);
          continue;
        }
        totalCreated += data.createdCount ?? 0;
        totalClassified += data.classified ?? 0;
      }
      if (totalCreated > 0) {
        setMsg(
          `✅ ${filled.length}枠から ${totalCreated}件を企画に追加（${totalClassified}件を自動分類）。タグ: ${tags.join(" / ") || "なし"}` +
            (errors.length ? `\n⚠️ 一部失敗: ${errors.join(" / ")}` : ""),
        );
        setSlots([{ format: "short", images: [], raw: "" }]);
      } else {
        setMsg(`エラー: 登録できませんでした。${errors.join(" / ")}`);
      }
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
        <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${msg.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border border-rose-500/30 text-rose-300"}`}>
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
                onClick={() => toggleTag(t)}
                className={`text-[11px] px-2 py-1 rounded-lg border ${tags.includes(t) ? "bg-white text-black border-white" : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-neutral-500"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* タグ分類（大/中/小）から選択 */}
        {childrenOf(null).length > 0 && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">カテゴリから選択（タップで追加）</span>
              <Link href="/threads/research" className="text-[10px] text-sky-400 hover:underline">分類を編集</Link>
            </div>
            <div className="space-y-1.5 mt-1 bg-neutral-950/50 border border-neutral-800 rounded-lg p-2">
              {childrenOf(null).map((big) => (
                <div key={big.id}>
                  <div className="text-[11px] font-bold text-neutral-300">📁 {big.name}</div>
                  {childrenOf(big.id).map((mid) => (
                    <div key={mid.id} className="flex items-center gap-1.5 flex-wrap pl-2 mt-0.5">
                      <span className="text-[10px] text-neutral-500">{mid.name}:</span>
                      {[mid, ...childrenOf(mid.id)].map((node) => (
                        <button
                          key={node.id}
                          onClick={() => toggleTag(node.name)}
                          className={`text-[11px] px-2 py-0.5 rounded-full ${tags.includes(node.name) ? "bg-indigo-500 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}
                        >
                          {node === mid ? `＝${node.name}` : node.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="text-xs text-neutral-400">タグ（目的・競合名・キーワードなど自由に）</span>
          <div className="flex gap-2 mt-1">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              list="importTagOptions"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              placeholder="入力してEnterで追加（既存タグは候補表示）"
              className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
            />
            <datalist id="importTagOptions">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
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

      {/* ③ 投稿を読み込む（1投稿=1枠・複数枠で一括） */}
      <section className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 space-y-3">
        <h3 className="text-sm font-bold text-neutral-100">③ 投稿を読み込む（1投稿＝1枠）</h3>
        {slots.map((slot, i) => (
          <div key={i} className="bg-neutral-950/60 border border-neutral-700 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200">📮 投稿{i + 1}</span>
              <button onClick={() => removeSlot(i)} className="text-[11px] text-neutral-500 hover:text-rose-400">枠を削除</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { v: "short", label: "短文" },
                { v: "long", label: "長文" },
                { v: "tree", label: "長文ツリー" },
              ] as const).map((f) => (
                <button
                  key={f.v}
                  onClick={() => updateSlot(i, { format: f.v })}
                  className={`text-xs px-3 py-1 rounded-lg border ${slot.format === f.v ? "bg-white text-black border-white font-bold" : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-neutral-500"}`}
                >
                  {f.label}
                </button>
              ))}
              <span className="text-[11px] text-neutral-500 self-center">
                {slot.format === "tree" ? "🌳 本文→続きの順で複数枚→1投稿に結合" : slot.format === "long" ? "📄 複数枚でも1投稿に結合" : "✏️ 別投稿として取込"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 cursor-pointer whitespace-nowrap">
                📷 スクショ追加
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    await addSlotImages(i, Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </label>
              {slot.images.map((src, ii) => (
                <div key={ii} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`p${i}-${ii}`} className="h-12 w-12 object-cover rounded border border-neutral-600" />
                  <button
                    onClick={() => removeSlotImage(i, ii)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-neutral-900 border border-neutral-600 text-neutral-300 text-[10px] leading-none flex items-center justify-center hover:bg-rose-600 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <textarea
              value={slot.raw}
              onChange={(e) => updateSlot(i, { raw: e.target.value })}
              rows={3}
              className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs font-mono"
              placeholder="（テキスト派）本文＋いいね数などを貼り付け"
            />
          </div>
        ))}
        <button
          onClick={addSlot}
          className="w-full py-2 rounded-lg border border-dashed border-neutral-600 text-xs text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800/50"
        >
          ＋ 投稿枠を追加（別の投稿はこちら）
        </button>
        <p className="text-[10px] text-neutral-600">目的・タグは全枠に共通で付きます。形式は枠ごとに選べます。</p>
      </section>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "追加中...（AIが整理中）" : `＋ 企画として一括追加${slots.filter((s) => s.images.length > 0 || s.raw.trim()).length > 0 ? `（${slots.filter((s) => s.images.length > 0 || s.raw.trim()).length}枠）` : ""}`}
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
