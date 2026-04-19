"use client";

// キャラクター管理画面。
// - 一覧 + 新規作成 + 編集 + 削除
// - Lora 学習 / 参照画像アップロードは後フェーズ
// - プロフィールの細部（顔/髪型/胸/性器のBodyPart紐付け）も後フェーズ
//   Phase 1 は「ベースプロンプト＋身長＋服装デフォルト」で実用レベル

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "@/components/clsx";
import { heightCmToTags } from "@/lib/presets";

interface ReferenceImageRecord {
  id: string;
  path: string;
  purpose: string;
  memo: string | null;
  createdAt: string;
  caption: string | null;
  captionSource: string | null;
}

interface CharacterRecord {
  id: string;
  name: string;
  gender: "female" | "male" | "other" | string;
  heightCm: number;
  memo: string | null;
  extraPrompt: string | null;
  triggerWord: string | null;
  defaultOutfitId: string | null;
  pubicHair: string | null;
  loraUrl: string | null;
  trainingStatus: string;
  createdAt: string;
  referenceImages?: ReferenceImageRecord[];
}

interface ClothingPreset {
  id: string;
  label: string;
  tags: string;
}

type Gender = "female" | "male" | "other";
type PubicHair = "" | "none" | "light" | "normal" | "thick";

interface FormState {
  name: string;
  gender: Gender;
  heightCm: string; // 入力中は文字列で保持
  memo: string;
  extraPrompt: string;
  triggerWord: string;
  defaultOutfitId: string;
  pubicHair: PubicHair;
}

const emptyForm: FormState = {
  name: "",
  gender: "female",
  heightCm: "160",
  memo: "",
  extraPrompt: "",
  triggerWord: "",
  defaultOutfitId: "",
  pubicHair: "",
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRecord[] | null>(null);
  const [outfits, setOutfits] = useState<ClothingPreset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"idle" | "create" | { edit: string }>("idle");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const [charRes, presetsRes] = await Promise.all([
          fetch("/api/characters"),
          fetch("/api/presets"),
        ]);
        if (!charRes.ok) throw new Error(`characters HTTP ${charRes.status}`);
        if (!presetsRes.ok) throw new Error(`presets HTTP ${presetsRes.status}`);
        const charJson = (await charRes.json()) as { characters: CharacterRecord[] };
        const presetsJson = (await presetsRes.json()) as { clothingPresets: ClothingPreset[] };
        if (aborted) return;
        setCharacters(charJson.characters);
        setOutfits(presetsJson.clothingPresets);
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
    () => (editingId ? characters?.find((c) => c.id === editingId) : null),
    [editingId, characters],
  );

  function startCreate() {
    setForm(emptyForm);
    setFormError(null);
    setMode("create");
  }

  function startEdit(c: CharacterRecord) {
    setForm({
      name: c.name,
      gender: (["female", "male", "other"].includes(c.gender) ? c.gender : "female") as Gender,
      heightCm: String(c.heightCm),
      memo: c.memo ?? "",
      extraPrompt: c.extraPrompt ?? "",
      triggerWord: c.triggerWord ?? "",
      defaultOutfitId: c.defaultOutfitId ?? "",
      pubicHair: (c.pubicHair as PubicHair) ?? "",
    });
    setFormError(null);
    setMode({ edit: c.id });
  }

  function cancel() {
    setMode("idle");
    setFormError(null);
  }

  async function handleSubmit() {
    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      setFormError("名前を入力してください");
      return;
    }
    const heightCm = Number(form.heightCm);
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 220) {
      setFormError("身長は 100〜220 cm の数値で入力してください");
      return;
    }
    if (heightCm < 150) {
      const ok = window.confirm(
        "身長 150cm 未満は未成年表現になり得ます。成人キャラとして生成してよろしいですか？",
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const body = {
        name,
        gender: form.gender,
        heightCm,
        memo: form.memo.trim() || null,
        extraPrompt: form.extraPrompt.trim() || null,
        triggerWord: form.triggerWord.trim() || null,
        defaultOutfitId: form.defaultOutfitId || null,
        pubicHair: form.pubicHair || null,
      };

      const url =
        mode === "create" || mode === "idle"
          ? "/api/characters"
          : `/api/characters/${editingId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
          error?: string;
        };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      // 一覧を取り直す
      const listRes = await fetch("/api/characters");
      const listJson = (await listRes.json()) as { characters: CharacterRecord[] };
      setCharacters(listJson.characters);
      setMode("idle");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c: CharacterRecord) {
    const ok = window.confirm(`キャラ「${c.name}」を削除します。よろしいですか？`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/characters/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCharacters((prev) => (prev ?? []).filter((x) => x.id !== c.id));
      if (editingId === c.id) setMode("idle");
    } catch (e) {
      alert(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          読み込み失敗: {loadError}
        </div>
      </main>
    );
  }

  if (!characters || !outfits) {
    return <main className="mx-auto max-w-5xl p-6 text-sm text-gray-400">読み込み中…</main>;
  }

  const isEditing = mode !== "idle";
  const formTitle = mode === "create" ? "新しいキャラを登録" : `「${editing?.name ?? ""}」を編集`;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-200">
            ← 生成画面へ
          </Link>
          <h1 className="text-xl font-bold">👥 キャラクター管理</h1>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            ＋ 新規作成
          </button>
        ) : null}
      </header>

      {isEditing ? (
        <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold">{formTitle}</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <LabeledField label="名前 *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input"
                placeholder="例: 花子"
              />
            </LabeledField>

            <LabeledField label="性別">
              <div className="flex gap-2">
                {(["female", "male", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, gender: g }))}
                    className={clsx(
                      "flex-1 rounded-md px-3 py-2 text-xs",
                      form.gender === g
                        ? "bg-indigo-500 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                    )}
                  >
                    {g === "female" ? "女性" : g === "male" ? "男性" : "その他"}
                  </button>
                ))}
              </div>
            </LabeledField>

            <LabeledField
              label={`身長 (cm) — 自動タグ: ${
                heightCmToTags(Number(form.heightCm) || 160) || "—"
              }`}
            >
              <input
                type="number"
                min={100}
                max={220}
                value={form.heightCm}
                onChange={(e) => setForm((p) => ({ ...p, heightCm: e.target.value }))}
                className="input"
              />
            </LabeledField>

            <LabeledField label="デフォルト服装（選んでおくと生成時に自動適用）">
              <select
                value={form.defaultOutfitId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultOutfitId: e.target.value }))
                }
                className="input"
              >
                <option value="">— 未設定 —</option>
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </LabeledField>

            {form.gender === "female" ? (
              <LabeledField label="陰毛">
                <select
                  value={form.pubicHair}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pubicHair: e.target.value as PubicHair }))
                  }
                  className="input"
                >
                  <option value="">指定なし</option>
                  <option value="none">なし（shaved）</option>
                  <option value="light">薄め</option>
                  <option value="normal">普通</option>
                  <option value="thick">濃い</option>
                </select>
              </LabeledField>
            ) : (
              <div />
            )}

            <LabeledField label="トリガーワード（Lora 学習後に使用）">
              <input
                type="text"
                value={form.triggerWord}
                onChange={(e) => setForm((p) => ({ ...p, triggerWord: e.target.value }))}
                className="input"
                placeholder="例: char_hanako_v1"
              />
            </LabeledField>

            <LabeledField
              label="キャラ固有の追加プロンプト（生成時に自動で追加）"
              span2
            >
              <textarea
                value={form.extraPrompt}
                onChange={(e) => setForm((p) => ({ ...p, extraPrompt: e.target.value }))}
                rows={2}
                className="input"
                placeholder="例: long black hair, brown eyes, school uniform"
              />
            </LabeledField>

            <LabeledField label="メモ（自分用メモ）" span2>
              <textarea
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                rows={2}
                className="input"
              />
            </LabeledField>
          </div>

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

          {/* 参照画像アップロード（編集モード限定・新規作成時は先にキャラ登録が必要） */}
          {mode !== "create" && editing ? (
            <ReferenceImageSection
              character={editing}
              images={editing.referenceImages ?? []}
              onChange={async () => {
                const listRes = await fetch("/api/characters");
                const listJson = (await listRes.json()) as { characters: CharacterRecord[] };
                setCharacters(listJson.characters);
              }}
            />
          ) : mode === "create" ? (
            <p className="mt-4 rounded-md border border-dashed border-gray-700 p-3 text-[11px] text-gray-500">
              💡 参照画像のアップロードはキャラ登録後に表示されます。
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 一覧 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">登録済みキャラ ({characters.length})</h2>

        {characters.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-700 p-6 text-center text-xs text-gray-500">
            まだ誰も登録されていません。「＋ 新規作成」から始めてください。
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {characters.map((c) => {
              const outfit = outfits.find((o) => o.id === c.defaultOutfitId);
              return (
                <li
                  key={c.id}
                  className="flex items-start justify-between rounded-md border border-gray-800 bg-gray-900/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      <span
                        className={clsx(
                          "mr-1.5 text-xs",
                          c.gender === "female"
                            ? "text-pink-400"
                            : c.gender === "male"
                            ? "text-sky-400"
                            : "text-gray-400",
                        )}
                      >
                        {c.gender === "female" ? "♀" : c.gender === "male" ? "♂" : "・"}
                      </span>
                      {c.name}
                      <span className="ml-2 text-[11px] font-normal text-gray-500">
                        {c.heightCm}cm
                      </span>
                    </p>
                    {outfit ? (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        デフォルト服装: {outfit.label}
                      </p>
                    ) : null}
                    {c.extraPrompt ? (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {c.extraPrompt}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-gray-600">
                      Lora: {c.trainingStatus === "ready" ? "学習済" : "未学習"}
                      {c.referenceImages && c.referenceImages.length > 0
                        ? ` / 参照画像 ${c.referenceImages.length}`
                        : ""}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded bg-gray-800 px-2 py-1 text-[11px] hover:bg-gray-700"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="rounded bg-red-900/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/70"
                    >
                      削除
                    </button>
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

function ReferenceImageSection({
  character,
  images,
  onChange,
}: {
  character: CharacterRecord;
  images: ReferenceImageRecord[];
  onChange: () => Promise<void> | void;
}) {
  const characterId = character.id;
  const [uploading, setUploading] = useState(false);
  const [purpose, setPurpose] = useState<"general" | "training" | "face" | "boost_source">(
    "training",
  );
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<ReferenceImageRecord | null>(null);

  const captionedCount = images.filter((i) => !!i.caption?.trim()).length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("purpose", purpose);
        const res = await fetch(`/api/characters/${characterId}/images`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
            error?: string;
          };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
      }
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(img: ReferenceImageRecord) {
    if (!window.confirm("この画像を削除しますか？")) return;
    const res = await fetch(`/api/characters/${characterId}/images/${img.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onChange();
    } else {
      alert("削除に失敗しました");
    }
  }

  const purposeLabels: Record<string, string> = {
    general: "一般（参考）",
    training: "Lora 学習用",
    face: "顔参照（IP-Adapter）",
    boost_source: "差分ブースト元",
  };

  return (
    <section className="mt-5 border-t border-gray-800 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">📷 参照画像 ({images.length})</h3>
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-900 px-2 py-0.5 text-[10px] text-gray-400">
            Lora 学習準備: {captionedCount}/{images.length} キャプション済
          </span>
        </div>
      </div>

      <p className="mb-3 text-[10px] text-gray-500">
        画像をクリックしてキャプションを編集できます。Lora 学習時は
        「髪・服装・表情」をタグ化（可変）、「顔の特徴」は書かない（固定）が鉄則。
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-gray-400">用途:</label>
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as typeof purpose)}
          className="input max-w-xs"
        >
          <option value="general">一般（参考）</option>
          <option value="training">Lora 学習用</option>
          <option value="face">顔参照（IP-Adapter）</option>
          <option value="boost_source">差分ブースト元</option>
        </select>

        <label
          className={clsx(
            "cursor-pointer rounded-md px-4 py-2 text-xs",
            uploading
              ? "bg-gray-700 text-gray-400"
              : "bg-indigo-600 text-white hover:bg-indigo-500",
          )}
        >
          {uploading ? "アップロード中…" : "＋ 画像を追加"}
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = ""; // 同じファイルを再選択できるようにリセット
            }}
          />
        </label>

        <span className="text-[10px] text-gray-600">JPG / PNG / WebP・20MB まで</span>
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-700 bg-red-950 p-2 text-[11px] text-red-200">
          {error}
        </div>
      ) : null}

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-700 p-6 text-center text-[11px] text-gray-500">
          画像はまだありません。登録しておくと、後で Lora 学習や差分ブーストで使えます。
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative overflow-hidden rounded-md border border-gray-800 bg-gray-900"
            >
              <button
                type="button"
                onClick={() => setEditingImage(img)}
                className="block w-full text-left"
                aria-label="画像を編集"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/characters/${characterId}/images/${img.id}`}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <span className="truncate text-[10px] text-gray-300">
                    {purposeLabels[img.purpose] ?? img.purpose}
                  </span>
                  {img.caption ? (
                    <span
                      className="shrink-0 rounded bg-emerald-900/40 px-1 text-[9px] text-emerald-200"
                      title={img.caption}
                    >
                      🏷
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-gray-800 px-1 text-[9px] text-gray-500">
                      —
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(img)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-red-300 opacity-0 transition group-hover:opacity-100"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingImage ? (
        <CaptionEditorModal
          character={character}
          image={editingImage}
          onClose={() => setEditingImage(null)}
          onSaved={async () => {
            setEditingImage(null);
            await onChange();
          }}
        />
      ) : null}
    </section>
  );
}

// 「これは残す（可変）」「これは消す（固定 = 顔特徴）」のガイド
const KEEP_HINT_TAGS = [
  { group: "髪", tags: ["long hair", "short hair", "ponytail", "twintails", "bob cut", "brown hair", "black hair", "blonde hair", "red hair", "silver hair"] },
  { group: "服", tags: ["school uniform", "casual clothes", "dress", "swimsuit", "bikini", "underwear", "naked", "topless", "suit"] },
  { group: "表情", tags: ["smile", "blush", "open mouth", "closed eyes", "serious", "tongue out"] },
  { group: "ポーズ / 背景", tags: ["standing", "sitting", "lying", "from side", "from behind", "outdoors", "indoors", "bedroom", "classroom"] },
];
const REMOVE_HINT_TAGS = [
  "pretty", "cute", "beautiful", "detailed face", "face focus",
  "good anatomy", "masterpiece", "best quality",
];

function CaptionEditorModal({
  character,
  image,
  onClose,
  onSaved,
}: {
  character: CharacterRecord;
  image: ReferenceImageRecord;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [caption, setCaption] = useState(image.caption ?? "");
  const [source, setSource] = useState<string | null>(image.captionSource);
  const [saving, setSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function insertTemplate() {
    const parts: string[] = [];
    if (character.triggerWord) parts.push(character.triggerWord);
    parts.push(character.gender === "male" ? "1boy" : character.gender === "female" ? "1girl" : "1person");
    // プレースホルダ風に書く（ユーザーが埋める）
    parts.push("[hair color] [hair style]");
    parts.push("[outfit]");
    parts.push("[expression]");
    parts.push("[pose / background]");
    setCaption((prev) => {
      const base = prev.trim();
      const template = parts.join(", ");
      return base ? `${template}, ${base}` : template;
    });
    setSource("manual");
  }

  function appendTag(tag: string) {
    setCaption((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.split(",").map((t) => t.trim()).includes(tag)) return prev;
      return `${trimmed}, ${tag}`;
    });
    setSource("manual");
  }

  async function handleAutoCaption() {
    setAutoError(null);
    setAutoLoading(true);
    try {
      const res = await fetch(
        `/api/characters/${character.id}/images/${image.id}/auto-caption`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        caption?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (data.caption) {
        setCaption(data.caption);
        setSource("auto_wd14");
      }
    } catch (e) {
      setAutoError(e instanceof Error ? e.message : String(e));
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/characters/${character.id}/images/${image.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: caption.trim() || null,
            captionSource: caption.trim() ? source ?? "manual" : null,
          }),
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="relative mt-6 w-full max-w-5xl rounded-lg border border-gray-800 bg-gray-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-200"
        >
          閉じる ✕
        </button>

        <h3 className="mb-3 text-sm font-semibold">
          📝 キャプション編集 —{" "}
          <span className="text-gray-400">{character.name}</span>
        </h3>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          {/* 左: 画像 */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/characters/${character.id}/images/${image.id}`}
              alt=""
              className="max-h-[60vh] w-full rounded-md border border-gray-800 object-contain"
            />
          </div>

          {/* 右: 編集 */}
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-[10px] text-amber-200">
              💡 <strong>タグ化の鉄則</strong>: 可変にしたい要素（髪・服・表情・背景）は書く。
              固定したい顔の特徴は <strong>書かない</strong>。
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={insertTemplate}
                className="rounded-md bg-indigo-700 px-2.5 py-1 text-[11px] text-white hover:bg-indigo-600"
              >
                🪄 テンプレを挿入
              </button>
              <button
                type="button"
                onClick={() => void handleAutoCaption()}
                disabled={autoLoading}
                className="rounded-md bg-pink-700 px-2.5 py-1 text-[11px] text-white hover:bg-pink-600 disabled:bg-gray-700"
              >
                {autoLoading ? "解析中…" : "🤖 AI キャプション"}
              </button>
              <span className="text-[10px] text-gray-500">
                (AI は Phase 2 で実装。今はテンプレ + 手動編集)
              </span>
            </div>

            {autoError ? (
              <div className="rounded-md border border-red-700 bg-red-950 p-2 text-[11px] text-red-200">
                {autoError}
              </div>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-gray-400">
                キャプション（英語タグ, カンマ区切り）
              </span>
              <textarea
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setSource("manual");
                }}
                rows={6}
                className="input"
                placeholder="例: char_hanako_v1, 1girl, brown hair, ponytail, school uniform, blazer, smile, classroom"
              />
            </label>

            <details className="rounded-md border border-gray-800 bg-gray-900/50 p-2 text-[11px]">
              <summary className="cursor-pointer text-gray-400">
                ▶ タグ候補（クリックで追加）
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {KEEP_HINT_TAGS.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1 text-[10px] text-emerald-300">
                      ✅ 可変 — {g.group}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {g.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => appendTag(t)}
                          className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-900/60"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <p className="mb-1 text-[10px] text-red-300">
                    ❌ 使わない推奨（顔を固定したいのでタグ化しない）
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {REMOVE_HINT_TAGS.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-red-900/30 px-2 py-0.5 text-[10px] text-red-200 line-through"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {error ? (
              <div className="rounded-md border border-red-700 bg-red-950 p-2 text-[11px] text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:bg-gray-700"
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
              >
                キャンセル
              </button>
              {source ? (
                <span className="ml-auto text-[10px] text-gray-500">
                  source: {source === "manual" ? "手動" : source === "auto_wd14" ? "AI (WD14)" : source}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
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
