"use client";

// 6W1H ボタン UI のメイン画面。
// プリセットは /api/presets で一括ロードし、クライアント側で選択 → プロンプト自動合成。

import { useEffect, useMemo, useState } from "react";
import PresetChipGroup, { type ChipItem } from "@/components/PresetChipGroup";
import SelectorCard from "@/components/SelectorCard";
import { clsx } from "@/components/clsx";
import { buildPrompt, type CharacterLite } from "@/lib/prompt-builder";
import {
  CONDOM_OPTIONS,
  type CondomState,
  ASPECT_RATIO_PRESETS,
  DEFAULT_ASPECT_RATIO_KEY,
  QUALITY_PRESETS,
  DEFAULT_QUALITY_KEY,
} from "@/lib/presets";

interface PresetItem {
  id: string;
  label: string;
  tags: string;
  category?: string;
  order?: number;
  isNude?: boolean;
}

interface ActionCategoryItem {
  id: string;
  key: string;
  label: string;
  isNSFW: boolean;
  actions: Array<{ id: string; label: string; tags: string; defaultCondom: string | null }>;
}

interface ExpressionCategoryItem {
  id: string;
  key: string;
  label: string;
  isNSFW: boolean;
  expressions: Array<{ id: string; label: string; tags: string }>;
}

interface LocationItem {
  id: string;
  name: string;
  tags: string;
}

interface ArtStyleItem {
  id: string;
  name: string;
  styleTags: string | null;
  loraUrl: string | null;
}

interface PresetsResponse {
  timePresets: PresetItem[];
  viewAnglePresets: PresetItem[];
  clothingPresets: PresetItem[];
  hairstylePresets: PresetItem[];
  actionCategories: ActionCategoryItem[];
  expressionCategories: ExpressionCategoryItem[];
  characters: CharacterLite[];
  locations: LocationItem[];
  artStyles: ArtStyleItem[];
}

interface GenerateResult {
  id: string;
  imageUrl: string;
  imageBase64: string;
  delayTimeMs?: number;
  executionTimeMs?: number;
  seed: string;
}

interface SelectionState {
  timeId: string | null;
  characterIds: string[];
  locationId: string | null;
  outfitId: string | null;
  angleId: string | null;
  actionId: string | null;
  expressionIds: string[];
  condom: CondomState;
  artStyleIds: string[];
  aspectRatioKey: string;
  qualityKey: string;
}

const initialSelection: SelectionState = {
  timeId: null,
  characterIds: [],
  locationId: null,
  outfitId: null,
  angleId: null,
  actionId: null,
  expressionIds: [],
  condom: "none",
  artStyleIds: [],
  aspectRatioKey: DEFAULT_ASPECT_RATIO_KEY,
  qualityKey: DEFAULT_QUALITY_KEY,
};

export default function HomePage() {
  const [presets, setPresets] = useState<PresetsResponse | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  const [sel, setSel] = useState<SelectionState>(initialSelection);
  const [actionTab, setActionTab] = useState<"sfw" | "nsfw">("sfw");
  const [expressionTab, setExpressionTab] = useState<"sfw" | "nsfw">("sfw");
  const [extraPromptTokens, setExtraPromptTokens] = useState("");

  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch("/api/presets");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PresetsResponse;
        if (!aborted) setPresets(data);
      } catch (e) {
        if (!aborted) setPresetsError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  // 参照用マップ
  const byId = useMemo(() => {
    if (!presets) return null;
    const map = {
      time: new Map(presets.timePresets.map((p) => [p.id, p])),
      angle: new Map(presets.viewAnglePresets.map((p) => [p.id, p])),
      outfit: new Map(presets.clothingPresets.map((p) => [p.id, p])),
      location: new Map(presets.locations.map((p) => [p.id, p])),
      character: new Map(presets.characters.map((c) => [c.id, c])),
      action: new Map<string, { id: string; label: string; tags: string; isNSFW: boolean }>(),
      expression: new Map<string, { id: string; label: string; tags: string; isNSFW: boolean }>(),
      artStyle: new Map(presets.artStyles.map((s) => [s.id, s])),
    };
    for (const cat of presets.actionCategories) {
      for (const a of cat.actions) {
        map.action.set(a.id, { ...a, isNSFW: cat.isNSFW });
      }
    }
    for (const cat of presets.expressionCategories) {
      for (const e of cat.expressions) {
        map.expression.set(e.id, { ...e, isNSFW: cat.isNSFW });
      }
    }
    return map;
  }, [presets]);

  // 選択肢から現在のプロンプトを合成
  const built = useMemo(() => {
    if (!byId || !presets) return null;
    const chars = sel.characterIds
      .map((id) => byId.character.get(id))
      .filter((c): c is CharacterLite => !!c);
    const outfit = sel.outfitId ? byId.outfit.get(sel.outfitId) : undefined;
    const action = sel.actionId ? byId.action.get(sel.actionId) : undefined;
    const styleTags = sel.artStyleIds
      .map((id) => byId.artStyle.get(id)?.styleTags)
      .filter((t): t is string => !!t && t.length > 0)
      .join(", ");

    const expressionTags = sel.expressionIds
      .map((id) => byId.expression.get(id)?.tags)
      .filter((t): t is string => !!t && t.length > 0);

    return buildPrompt({
      timeTags: sel.timeId ? byId.time.get(sel.timeId)?.tags : undefined,
      characters: chars,
      location: sel.locationId
        ? { tags: byId.location.get(sel.locationId)?.tags ?? "", name: byId.location.get(sel.locationId)?.name }
        : undefined,
      outfit: outfit ? { tags: outfit.tags, isNude: outfit.isNude } : undefined,
      angle: sel.angleId ? { tags: byId.angle.get(sel.angleId)?.tags ?? "" } : undefined,
      action: action ? { tags: action.tags, isNSFW: action.isNSFW } : undefined,
      expressionTags: expressionTags.length > 0 ? expressionTags : undefined,
      condom: sel.condom,
      artStyleTags: styleTags.length > 0 ? styleTags : undefined,
      extraPromptTokens: extraPromptTokens.trim().length > 0 ? extraPromptTokens : undefined,
    });
  }, [byId, presets, sel, extraPromptTokens]);

  function toggleSingle(key: keyof SelectionState, id: string) {
    setSel((prev) => {
      const current = prev[key];
      return { ...prev, [key]: current === id ? null : id };
    });
  }
  function toggleMulti(key: "characterIds" | "artStyleIds" | "expressionIds", id: string) {
    setSel((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  }
  function resetAll() {
    setSel(initialSelection);
    setExtraPromptTokens("");
  }

  const aspect =
    ASPECT_RATIO_PRESETS.find((a) => a.key === sel.aspectRatioKey) ?? ASPECT_RATIO_PRESETS[0];
  const quality =
    QUALITY_PRESETS.find((q) => q.key === sel.qualityKey) ?? QUALITY_PRESETS[1];

  async function handleGenerate() {
    if (!built) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(0);

    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          width: aspect.width,
          height: aspect.height,
          steps: quality.steps,
          cfg: quality.cfg,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
          error?: string;
        };
        throw new Error(errJson.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as GenerateResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  if (presetsError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          プリセット取得に失敗しました: {presetsError}
        </div>
      </main>
    );
  }

  if (!presets) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-sm text-gray-400">読み込み中…</main>
    );
  }

  const timeItems: ChipItem[] = presets.timePresets.map((p) => ({ id: p.id, label: p.label }));
  const angleItems: ChipItem[] = presets.viewAnglePresets.map((p) => ({ id: p.id, label: p.label }));
  const outfitItems: ChipItem[] = presets.clothingPresets.map((p) => ({ id: p.id, label: p.label }));
  const charItems: ChipItem[] = presets.characters.map((c) => ({
    id: c.id,
    label: c.name,
    subLabel: c.gender === "female" ? "♀" : c.gender === "male" ? "♂" : undefined,
  }));
  const locItems: ChipItem[] = presets.locations.map((l) => ({ id: l.id, label: l.name }));
  const styleItems: ChipItem[] = presets.artStyles.map((s) => ({ id: s.id, label: s.name }));

  const filteredCategories = presets.actionCategories.filter((c) =>
    actionTab === "sfw" ? !c.isNSFW : c.isNSFW,
  );
  const filteredExpressions = presets.expressionCategories.filter((c) =>
    expressionTab === "sfw" ? !c.isNSFW : c.isNSFW,
  );
  const expressionSummary = sel.expressionIds
    .map((id) => byId?.expression.get(id)?.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const expressionMore = sel.expressionIds.length > 3 ? ` +${sel.expressionIds.length - 3}` : "";

  const mainChar = sel.characterIds[0] ? byId?.character.get(sel.characterIds[0]) : null;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">🎨 画像生成ツール</h1>
        <nav className="flex items-center gap-3 text-xs">
          <a href="/characters" className="text-gray-400 hover:text-indigo-300">
            👥 キャラ管理
          </a>
          <button
            type="button"
            onClick={resetAll}
            className="text-gray-400 hover:text-gray-200"
          >
            すべてクリア
          </button>
        </nav>
      </header>

      <p className="mb-4 text-xs text-gray-400">
        カードを選んで下の「生成する」を押すだけ。詳細はプロンプトプレビューで確認できます。
      </p>

      {/* 絵柄（独立・最上段） */}
      <SelectorCard
        icon="🎨"
        title="絵柄"
        summary={sel.artStyleIds.map((id) => byId?.artStyle.get(id)?.name).join(" × ")}
        help="複数選択可。Civitai 取込/自作 Lora を管理画面（未実装）から追加予定。"
      >
        <PresetChipGroup
          items={styleItems}
          selectedIds={sel.artStyleIds}
          onToggle={(id) => toggleMulti("artStyleIds", id)}
          emptyHint="絵柄未登録（後で Civitai 取込 UI から追加）"
        />
      </SelectorCard>

      {/* 6W1H グリッド */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <SelectorCard
          icon="🕐"
          title="いつ"
          summary={sel.timeId ? byId?.time.get(sel.timeId)?.label : undefined}
        >
          <PresetChipGroup
            items={timeItems}
            selectedIds={sel.timeId ? [sel.timeId] : []}
            onToggle={(id) => toggleSingle("timeId", id)}
          />
        </SelectorCard>

        <SelectorCard
          icon="👤"
          title="誰が / 誰と"
          summary={
            sel.characterIds
              .map((id) => byId?.character.get(id)?.name)
              .filter(Boolean)
              .join(", ") || undefined
          }
          help="最初に選んだキャラが主体扱いになります。"
        >
          <PresetChipGroup
            items={charItems}
            selectedIds={sel.characterIds}
            onToggle={(id) => toggleMulti("characterIds", id)}
            emptyHint="キャラ未登録（キャラ管理画面は Phase 1 で実装予定）"
          />
        </SelectorCard>

        <SelectorCard
          icon="📍"
          title="どこで"
          summary={sel.locationId ? byId?.location.get(sel.locationId)?.name : undefined}
        >
          <PresetChipGroup
            items={locItems}
            selectedIds={sel.locationId ? [sel.locationId] : []}
            onToggle={(id) => toggleSingle("locationId", id)}
            emptyHint="場所未登録（後で場所ライブラリから追加）"
          />
        </SelectorCard>

        <SelectorCard
          icon="👗"
          title="格好"
          summary={sel.outfitId ? byId?.outfit.get(sel.outfitId)?.label : undefined}
          help={mainChar?.gender === "male" ? "男性キャラに適した服装を選んでください。" : undefined}
        >
          <PresetChipGroup
            items={outfitItems}
            selectedIds={sel.outfitId ? [sel.outfitId] : []}
            onToggle={(id) => toggleSingle("outfitId", id)}
          />
        </SelectorCard>

        <SelectorCard
          icon="📷"
          title="アングル"
          summary={sel.angleId ? byId?.angle.get(sel.angleId)?.label : undefined}
        >
          <PresetChipGroup
            items={angleItems}
            selectedIds={sel.angleId ? [sel.angleId] : []}
            onToggle={(id) => toggleSingle("angleId", id)}
          />
        </SelectorCard>

        <SelectorCard
          icon="😊"
          title="表情"
          summary={sel.expressionIds.length > 0 ? `${expressionSummary}${expressionMore}` : undefined}
          help="複数選択可。目+口+赤面など組み合わせるとアヘ顔に。"
        >
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => setExpressionTab("sfw")}
              className={clsx(
                "rounded-md px-2.5 py-0.5 text-[11px]",
                expressionTab === "sfw" ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-400",
              )}
            >
              SFW
            </button>
            <button
              type="button"
              onClick={() => setExpressionTab("nsfw")}
              className={clsx(
                "rounded-md px-2.5 py-0.5 text-[11px]",
                expressionTab === "nsfw" ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400",
              )}
            >
              NSFW
            </button>
            {sel.expressionIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setSel((p) => ({ ...p, expressionIds: [] }))}
                className="ml-auto rounded-md px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-300"
              >
                クリア
              </button>
            ) : null}
          </div>

          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {filteredExpressions.map((cat) => (
              <div key={cat.id}>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">
                  {cat.label}
                </p>
                <PresetChipGroup
                  items={cat.expressions.map((e) => ({ id: e.id, label: e.label }))}
                  selectedIds={sel.expressionIds}
                  onToggle={(id) => toggleMulti("expressionIds", id)}
                />
              </div>
            ))}
          </div>
        </SelectorCard>

        <SelectorCard
          icon="💫"
          title="何をしてる"
          summary={sel.actionId ? byId?.action.get(sel.actionId)?.label : undefined}
        >
          {/* SFW / NSFW タブ */}
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => setActionTab("sfw")}
              className={clsx(
                "rounded-md px-2.5 py-0.5 text-[11px]",
                actionTab === "sfw" ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-400",
              )}
            >
              SFW
            </button>
            <button
              type="button"
              onClick={() => setActionTab("nsfw")}
              className={clsx(
                "rounded-md px-2.5 py-0.5 text-[11px]",
                actionTab === "nsfw" ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400",
              )}
            >
              NSFW
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {filteredCategories.map((cat) => (
              <div key={cat.id}>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">{cat.label}</p>
                <PresetChipGroup
                  items={cat.actions.map((a) => ({ id: a.id, label: a.label }))}
                  selectedIds={sel.actionId ? [sel.actionId] : []}
                  onToggle={(id) => toggleSingle("actionId", id)}
                />
              </div>
            ))}
          </div>

          {/* ゴム有無トグル（NSFW 時のみ） */}
          {actionTab === "nsfw" ? (
            <div className="mt-3 flex items-center gap-1 rounded-md bg-gray-950/60 p-1.5">
              {CONDOM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSel((p) => ({ ...p, condom: opt.value }))}
                  className={clsx(
                    "flex-1 rounded px-2 py-1 text-[11px]",
                    sel.condom === opt.value
                      ? "bg-pink-600 text-white"
                      : "text-gray-400 hover:bg-gray-800",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </SelectorCard>
      </div>

      {/* 追加トークン（オプション） */}
      <section className="mt-4 flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">
          追加したいプロンプト（任意・英語タグ）
        </label>
        <input
          type="text"
          value={extraPromptTokens}
          onChange={(e) => setExtraPromptTokens(e.target.value)}
          placeholder="e.g. looking at viewer, detailed eyes"
          className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs"
        />
      </section>

      {/* プロンプトプレビュー（折りたたみ） */}
      <section className="mt-4 rounded-md border border-gray-800 bg-gray-950/60">
        <button
          type="button"
          onClick={() => setShowPromptPreview((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-gray-900"
        >
          <span>▶ プロンプトプレビュー</span>
          <span className="text-gray-500">{showPromptPreview ? "折りたたむ" : "開く"}</span>
        </button>
        {showPromptPreview && built ? (
          <div className="border-t border-gray-800 p-3 text-[11px] text-gray-400">
            <p className="mb-1 text-gray-500">positive</p>
            <p className="mb-3 whitespace-pre-wrap break-words font-mono text-gray-200">
              {built.prompt || "（未選択）"}
            </p>
            <p className="mb-1 text-gray-500">negative</p>
            <p className="whitespace-pre-wrap break-words font-mono text-gray-400">
              {built.negativePrompt}
            </p>
          </div>
        ) : null}
      </section>

      {/* サイズ・画質 */}
      <section className="mt-4 grid gap-3 rounded-md border border-gray-800 bg-gray-950/60 p-3 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
            📐 サイズ <span className="ml-1 text-gray-600">{aspect.width}×{aspect.height}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_RATIO_PRESETS.map((a) => {
              const active = sel.aspectRatioKey === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setSel((p) => ({ ...p, aspectRatioKey: a.key }))}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs transition",
                    active ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                  )}
                  title={`${a.width} × ${a.height}`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
            ⚙ 画質{" "}
            <span className="ml-1 text-gray-600">
              steps {quality.steps} / cfg {quality.cfg}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUALITY_PRESETS.map((q) => {
              const active = sel.qualityKey === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setSel((p) => ({ ...p, qualityKey: q.key }))}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs transition",
                    active ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                  )}
                  title={q.description}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-gray-600">{quality.description}</p>
        </div>
      </section>

      {/* 生成ボタン */}
      <section className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !built || built.prompt.trim().length === 0}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-700"
        >
          {loading ? `生成中… ${elapsed}s` : "🎨 生成する"}
        </button>
        <span className="text-[11px] text-gray-500">
          Cold Start 含め 30〜60 秒（画質「最高品質」は +20〜30 秒）
        </span>
      </section>

      {error ? (
        <div className="mt-5 rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          <strong>エラー:</strong> {error}
        </div>
      ) : null}

      {result ? (
        <section className="mt-6 grid gap-3">
          <div className="rounded-md border border-gray-800 bg-gray-900 p-3 text-xs text-gray-400">
            <div>ID: {result.id}</div>
            <div>Seed: {result.seed}</div>
            <div>
              Delay: {result.delayTimeMs ?? "-"}ms / Execution: {result.executionTimeMs ?? "-"}ms
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.imageUrl}
            alt="generated"
            className="max-w-full rounded-md border border-gray-800"
          />
          <a
            href={result.imageUrl}
            download
            className="inline-block w-fit rounded-md bg-gray-800 px-4 py-2 text-sm"
          >
            画像をダウンロード
          </a>
        </section>
      ) : null}
    </main>
  );
}
