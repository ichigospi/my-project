"use client";

// 絵柄管理画面。
// 4 形式に対応:
//   - tag_only: styleTags のみ。即使える。
//   - civitai:  Civitai から取込（メタデータ + サムネ）。
//               ※Lora ファイル本体の RunPod 同期は別途必要（要手動）
//   - uploaded: 自前 .safetensors。今は記録のみ。
//   - trained:  Lora 学習。Phase 2 実装予定。

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "@/components/clsx";

type Source = "tag_only" | "civitai" | "uploaded" | "trained";
type BaseModel = "illustrious" | "pony" | "sdxl";

interface ArtStyleRecord {
  id: string;
  createdAt: string;
  name: string;
  source: string;
  baseModel: string;
  loraUrl: string | null;
  loraScale: number;
  triggerWords: string | null;
  styleTags: string | null;
  civitaiModelId: number | null;
  civitaiVersionId: number | null;
  thumbnailsJson: string | null;
  memo: string | null;
}

interface CivitaiPreview {
  model: { id: number; name: string; type: string; nsfw: boolean };
  version: {
    id: number;
    name: string;
    baseModel: string | null;
    normalizedBaseModel: string;
    trainedWords: string[];
    thumbnails: string[];
    primaryFile: { name: string; sizeMB: number; downloadUrl: string } | null;
  };
}

interface FormState {
  name: string;
  source: Source;
  baseModel: BaseModel;
  styleTags: string;
  triggerWords: string;
  loraUrl: string;
  loraScale: string;
  memo: string;
  civitaiModelId: number | null;
  civitaiVersionId: number | null;
  thumbnails: string[];
}

const emptyForm: FormState = {
  name: "",
  source: "tag_only",
  baseModel: "illustrious",
  styleTags: "",
  triggerWords: "",
  loraUrl: "",
  loraScale: "0.8",
  memo: "",
  civitaiModelId: null,
  civitaiVersionId: null,
  thumbnails: [],
};

export default function ArtStylesPage() {
  const [items, setItems] = useState<ArtStyleRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"idle" | "create" | { edit: string }>("idle");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Civitai ルックアップ
  const [civitaiInput, setCivitaiInput] = useState("");
  const [civitaiPreview, setCivitaiPreview] = useState<CivitaiPreview | null>(null);
  const [civitaiLoading, setCivitaiLoading] = useState(false);
  const [civitaiError, setCivitaiError] = useState<string | null>(null);

  // Lora 直 DL の状態（per-item）
  const [downloading, setDownloading] = useState<string | null>(null); // art style id
  const [downloadResult, setDownloadResult] = useState<{
    id: string;
    filename: string;
    sizeMB: number;
    podCommand: string;
    skipped?: boolean;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch("/api/art-styles");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: ArtStyleRecord[] };
        if (!aborted) setItems(data.items);
      } catch (e) {
        if (!aborted) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const editingId = typeof mode === "object" ? mode.edit : null;
  const editing = useMemo(
    () => (editingId ? items?.find((c) => c.id === editingId) : null),
    [editingId, items],
  );

  function startCreate(initial?: Partial<FormState>) {
    setForm({ ...emptyForm, ...initial });
    setFormError(null);
    setCivitaiPreview(null);
    setCivitaiInput("");
    setMode("create");
  }

  function startEdit(it: ArtStyleRecord) {
    let thumbs: string[] = [];
    try {
      thumbs = it.thumbnailsJson ? (JSON.parse(it.thumbnailsJson) as string[]) : [];
    } catch {
      /* ignore */
    }
    setForm({
      name: it.name,
      source: (["tag_only", "civitai", "uploaded", "trained"].includes(it.source)
        ? it.source
        : "tag_only") as Source,
      baseModel: (["illustrious", "pony", "sdxl"].includes(it.baseModel)
        ? it.baseModel
        : "illustrious") as BaseModel,
      styleTags: it.styleTags ?? "",
      triggerWords: it.triggerWords ?? "",
      loraUrl: it.loraUrl ?? "",
      loraScale: String(it.loraScale ?? 0.8),
      memo: it.memo ?? "",
      civitaiModelId: it.civitaiModelId,
      civitaiVersionId: it.civitaiVersionId,
      thumbnails: thumbs,
    });
    setFormError(null);
    setMode({ edit: it.id });
  }

  function cancel() {
    setMode("idle");
    setFormError(null);
    setCivitaiPreview(null);
  }

  async function handleCivitaiLookup() {
    setCivitaiError(null);
    setCivitaiPreview(null);
    if (!civitaiInput.trim()) return;
    setCivitaiLoading(true);
    try {
      const res = await fetch("/api/art-styles/civitai-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: civitaiInput }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setCivitaiPreview((await res.json()) as CivitaiPreview);
    } catch (e) {
      setCivitaiError(e instanceof Error ? e.message : String(e));
    } finally {
      setCivitaiLoading(false);
    }
  }

  function applyCivitaiPreview() {
    if (!civitaiPreview) return;
    setForm((p) => ({
      ...p,
      name: p.name || civitaiPreview.model.name,
      source: "civitai",
      baseModel: (["illustrious", "pony", "sdxl"].includes(
        civitaiPreview.version.normalizedBaseModel,
      )
        ? civitaiPreview.version.normalizedBaseModel
        : "sdxl") as BaseModel,
      triggerWords: civitaiPreview.version.trainedWords.join(", "),
      loraUrl: civitaiPreview.version.primaryFile?.name ?? "",
      civitaiModelId: civitaiPreview.model.id,
      civitaiVersionId: civitaiPreview.version.id,
      thumbnails: civitaiPreview.version.thumbnails,
    }));
  }

  async function handleSubmit() {
    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      setFormError("名前を入力してください");
      return;
    }
    const styleTags = form.styleTags.trim();
    const triggerWords = form.triggerWords.trim();
    if (form.source === "tag_only" && !styleTags) {
      setFormError("タグのみ形式の場合、絵師タグ等を入力してください（例: by wlop）");
      return;
    }
    const loraScale = Number(form.loraScale);
    if (!Number.isFinite(loraScale) || loraScale < 0 || loraScale > 2) {
      setFormError("再現度は 0.0〜2.0 の数値で入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        name,
        source: form.source,
        baseModel: form.baseModel,
        styleTags: styleTags || null,
        triggerWords: triggerWords || null,
        loraUrl: form.loraUrl.trim() || null,
        loraScale,
        memo: form.memo.trim() || null,
        civitaiModelId: form.civitaiModelId,
        civitaiVersionId: form.civitaiVersionId,
        thumbnailsJson:
          form.thumbnails.length > 0 ? JSON.stringify(form.thumbnails) : null,
      };

      const url =
        mode === "create" || mode === "idle"
          ? "/api/art-styles"
          : `/api/art-styles/${editingId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const listRes = await fetch("/api/art-styles");
      const listJson = (await listRes.json()) as { items: ArtStyleRecord[] };
      setItems(listJson.items);
      setMode("idle");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(it: ArtStyleRecord) {
    setDownloading(it.id);
    setDownloadError(null);
    setDownloadResult(null);
    try {
      const res = await fetch(`/api/art-styles/${it.id}/download`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        filename?: string;
        sizeMB?: number;
        podCommand?: string;
        skipped?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDownloadResult({
        id: it.id,
        filename: data.filename ?? "",
        sizeMB: data.sizeMB ?? 0,
        podCommand: data.podCommand ?? "",
        skipped: data.skipped,
      });
      // 一覧を更新（loraUrl が入る）
      const listRes = await fetch("/api/art-styles");
      const listJson = (await listRes.json()) as { items: ArtStyleRecord[] };
      setItems(listJson.items);
    } catch (e) {
      setDownloadError({
        id: it.id,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(it: ArtStyleRecord) {
    if (!window.confirm(`絵柄「${it.name}」を削除します。よろしいですか？`)) return;
    const res = await fetch(`/api/art-styles/${it.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => (prev ?? []).filter((x) => x.id !== it.id));
      if (editingId === it.id) setMode("idle");
    } else {
      alert("削除に失敗しました");
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          読み込み失敗: {loadError}
        </div>
      </main>
    );
  }

  if (!items) {
    return <main className="mx-auto max-w-6xl p-6 text-sm text-gray-400">読み込み中…</main>;
  }

  const isEditing = mode !== "idle";
  const formTitle =
    mode === "create" ? "新しい絵柄を登録" : `「${editing?.name ?? ""}」を編集`;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-200">
            ← 生成画面へ
          </Link>
          <h1 className="text-xl font-bold">🎨 絵柄管理</h1>
        </div>
        {!isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startCreate({ source: "tag_only" })}
              className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              ＋ タグのみで登録
            </button>
            <button
              type="button"
              onClick={() => startCreate({ source: "civitai" })}
              className="rounded-md bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-500"
            >
              ＋ Civitai から取込
            </button>
          </div>
        ) : null}
      </header>

      {isEditing ? (
        <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">{formTitle}</h2>

          {/* 形式タブ */}
          <div className="mb-3 flex gap-1">
            {(["tag_only", "civitai", "uploaded", "trained"] as Source[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((p) => ({ ...p, source: s }))}
                disabled={s === "trained"}
                className={clsx(
                  "rounded-md px-3 py-1 text-xs",
                  form.source === s
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50",
                )}
              >
                {s === "tag_only"
                  ? "タグのみ"
                  : s === "civitai"
                  ? "Civitai 取込"
                  : s === "uploaded"
                  ? "ファイルアップロード"
                  : "学習（Phase 2）"}
              </button>
            ))}
          </div>

          {/* Civitai ルックアップ（civitai 形式選択時のみ） */}
          {form.source === "civitai" ? (
            <div className="mb-4 rounded-md border border-pink-900/40 bg-pink-950/20 p-3">
              <p className="mb-2 text-[11px] text-pink-200">
                💡 Civitai のモデル URL or ID を入力 →「メタを取得」で内容をプレビュー →「フォームに反映」
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={civitaiInput}
                  onChange={(e) => setCivitaiInput(e.target.value)}
                  placeholder="https://civitai.com/models/XXXXX または 数値ID"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleCivitaiLookup()}
                  disabled={civitaiLoading}
                  className="rounded-md bg-pink-600 px-3 py-1 text-xs text-white hover:bg-pink-500 disabled:bg-gray-700"
                >
                  {civitaiLoading ? "取得中…" : "メタを取得"}
                </button>
              </div>
              {civitaiError ? (
                <p className="mt-2 text-[11px] text-red-300">{civitaiError}</p>
              ) : null}
              {civitaiPreview ? (
                <div className="mt-3 rounded-md border border-gray-800 bg-gray-950 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{civitaiPreview.model.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {civitaiPreview.model.type} / {civitaiPreview.version.name} /{" "}
                        baseModel: {civitaiPreview.version.baseModel ?? "?"}
                      </p>
                      {civitaiPreview.version.trainedWords.length > 0 ? (
                        <p className="mt-1 text-[11px] text-gray-300">
                          trigger: {civitaiPreview.version.trainedWords.join(", ")}
                        </p>
                      ) : null}
                      {civitaiPreview.version.primaryFile ? (
                        <p className="mt-1 text-[11px] text-gray-500">
                          ファイル: {civitaiPreview.version.primaryFile.name} (
                          {civitaiPreview.version.primaryFile.sizeMB} MB)
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={applyCivitaiPreview}
                      className="shrink-0 rounded-md bg-pink-600 px-3 py-1 text-xs text-white hover:bg-pink-500"
                    >
                      フォームに反映
                    </button>
                  </div>
                  {civitaiPreview.version.thumbnails.length > 0 ? (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto">
                      {civitaiPreview.version.thumbnails.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-24 rounded border border-gray-800"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 共通フィールド */}
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="表示名 *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input"
                placeholder="例: wlop風 / アニメ調"
              />
            </LabeledField>

            <LabeledField label="ベースモデル">
              <div className="flex gap-1">
                {(["illustrious", "pony", "sdxl"] as BaseModel[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, baseModel: b }))}
                    className={clsx(
                      "flex-1 rounded-md px-2 py-1.5 text-xs",
                      form.baseModel === b
                        ? "bg-indigo-500 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </LabeledField>

            <LabeledField
              label="絵師タグ / styleTags（プロンプトに直接注入）"
              span2
            >
              <input
                type="text"
                value={form.styleTags}
                onChange={(e) => setForm((p) => ({ ...p, styleTags: e.target.value }))}
                className="input"
                placeholder="例: by wlop, by kuvshinov_ilya"
              />
            </LabeledField>

            {form.source !== "tag_only" ? (
              <>
                <LabeledField label="トリガーワード（Lora 起動キーワード）" span2>
                  <input
                    type="text"
                    value={form.triggerWords}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, triggerWords: e.target.value }))
                    }
                    className="input"
                    placeholder="例: anime style, masterpiece"
                  />
                </LabeledField>

                <LabeledField label="Lora ファイル名（RunPod /models/loras/ 上のパス）">
                  <input
                    type="text"
                    value={form.loraUrl}
                    onChange={(e) => setForm((p) => ({ ...p, loraUrl: e.target.value }))}
                    className="input"
                    placeholder="例: my_style.safetensors"
                  />
                </LabeledField>

                <LabeledField label="再現度 / loraScale (0.0〜2.0、推奨 0.8)">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={form.loraScale}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, loraScale: e.target.value }))
                    }
                    className="input"
                  />
                </LabeledField>
              </>
            ) : null}

            <LabeledField label="メモ" span2>
              <textarea
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                rows={2}
                className="input"
              />
            </LabeledField>
          </div>

          {/* 適用済サムネ表示 */}
          {form.thumbnails.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-[11px] text-gray-400">サンプル画像（プレビュー）</p>
              <div className="flex gap-1.5 overflow-x-auto">
                {form.thumbnails.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-20 rounded border border-gray-800"
                  />
                ))}
              </div>
            </div>
          ) : null}

          {form.source === "uploaded" || form.source === "civitai" ? (
            <p className="mt-3 rounded-md border border-amber-900/40 bg-amber-950/30 p-2 text-[11px] text-amber-200">
              ⚠ Lora ファイル本体は RunPod の Network Volume にコピーする必要があります。
              現状は Pod 経由で /workspace/models/loras/ にアップロードしてください。
              （自動同期は Phase 2 で実装予定）
            </p>
          ) : null}

          {formError ? (
            <div className="mt-3 rounded-md border border-red-700 bg-red-950 p-3 text-xs text-red-200">
              {formError}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {submitting ? "保存中…" : mode === "create" ? "登録する" : "更新する"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              キャンセル
            </button>
          </div>
        </section>
      ) : null}

      {/* 一覧 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">登録済み絵柄 ({items.length})</h2>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-700 p-6 text-center text-xs text-gray-500">
            まだ絵柄がありません。「タグのみで登録」または「Civitai から取込」から始めてください。
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              let thumbs: string[] = [];
              try {
                thumbs = it.thumbnailsJson
                  ? (JSON.parse(it.thumbnailsJson) as string[])
                  : [];
              } catch {
                /* ignore */
              }
              const sourceLabel: Record<string, string> = {
                tag_only: "タグのみ",
                civitai: "Civitai",
                uploaded: "アップロード",
                trained: "学習済",
              };
              return (
                <li
                  key={it.id}
                  className="overflow-hidden rounded-md border border-gray-800 bg-gray-900/50"
                >
                  {thumbs[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbs[0]}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="p-3">
                    <p className="text-sm font-semibold">{it.name}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {sourceLabel[it.source] ?? it.source} / {it.baseModel}
                    </p>
                    {it.styleTags ? (
                      <p className="mt-1 truncate text-[11px] text-gray-400" title={it.styleTags}>
                        tags: {it.styleTags}
                      </p>
                    ) : null}
                    {it.triggerWords ? (
                      <p className="truncate text-[11px] text-gray-400" title={it.triggerWords}>
                        trigger: {it.triggerWords}
                      </p>
                    ) : null}
                    {it.source !== "tag_only" ? (
                      <p className="mt-1 text-[10px] text-gray-600">
                        Lora: {it.loraUrl || "未設定"} / scale {it.loraScale}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(it)}
                        className="rounded bg-gray-800 px-2 py-1 text-[11px] hover:bg-gray-700"
                      >
                        編集
                      </button>
                      {it.source === "civitai" && it.civitaiVersionId ? (
                        <button
                          type="button"
                          onClick={() => void handleDownload(it)}
                          disabled={downloading === it.id}
                          className={clsx(
                            "rounded px-2 py-1 text-[11px]",
                            downloading === it.id
                              ? "bg-gray-700 text-gray-400"
                              : it.loraUrl
                              ? "bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/70"
                              : "bg-pink-700 text-white hover:bg-pink-600",
                          )}
                        >
                          {downloading === it.id
                            ? "📥 DL中…"
                            : it.loraUrl
                            ? "📥 再DL"
                            : "📥 ローカルにDL"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(it)}
                        className="rounded bg-red-900/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/70"
                      >
                        削除
                      </button>
                    </div>

                    {downloadError && downloadError.id === it.id ? (
                      <p className="mt-2 rounded border border-red-700 bg-red-950 p-2 text-[11px] text-red-200">
                        {downloadError.message}
                      </p>
                    ) : null}

                    {downloadResult && downloadResult.id === it.id ? (
                      <div className="mt-2 rounded border border-emerald-900/40 bg-emerald-950/30 p-2 text-[11px] text-emerald-200">
                        <p>
                          ✅ {downloadResult.skipped ? "既に存在" : "DL完了"}:{" "}
                          {downloadResult.filename} ({downloadResult.sizeMB} MB)
                        </p>
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[10px] text-emerald-300/80 hover:text-emerald-200">
                            ▶ RunPod の Pod に配置するコマンド（Pod の Terminal で実行）
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-gray-200">
                            {downloadResult.podCommand}
                          </pre>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                downloadResult.podCommand,
                              );
                            }}
                            className="mt-1 rounded bg-gray-800 px-2 py-0.5 text-[10px] hover:bg-gray-700"
                          >
                            コマンドをコピー
                          </button>
                        </details>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function LabeledField({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={clsx("flex flex-col gap-1", span2 ? "md:col-span-2" : "")}>
      <span className="text-[11px] text-gray-400">{label}</span>
      {children}
    </label>
  );
}
