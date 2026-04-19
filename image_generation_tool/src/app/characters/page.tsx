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
