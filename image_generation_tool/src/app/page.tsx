"use client";

// 6W1H ボタン UI のメイン画面。
// プリセットは /api/presets で一括ロードし、クライアント側で選択 → プロンプト自動合成。

import { useEffect, useMemo, useState } from "react";
import PresetChipGroup, { type ChipItem } from "@/components/PresetChipGroup";
import SelectorCard from "@/components/SelectorCard";
import CharTabBar from "@/components/CharTabBar";
import { clsx } from "@/components/clsx";
import { buildPrompt, type CharacterLite } from "@/lib/prompt-builder";
import {
  CONDOM_OPTIONS,
  type CondomState,
  ASPECT_RATIO_PRESETS,
  DEFAULT_ASPECT_RATIO_KEY,
  QUALITY_PRESETS,
  DEFAULT_QUALITY_KEY,
  CFG_DEFAULT,
  CFG_MAX,
  CFG_MIN,
  CFG_PRESETS,
  BATCH_SIZE_OPTIONS,
  DEFAULT_BATCH_SIZE,
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
  triggerWords: string | null;
  loraUrl: string | null;
  loraScale: number;
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

interface GenerateResultImage {
  id: string;
  imageUrl: string;
  seed: string;
}

interface GenerateResult {
  images: GenerateResultImage[];
  delayTimeMs?: number;
  executionTimeMs?: number;
}

// キャラ未選択時に使うフォールバックのキー
const GLOBAL_SLOT = "__global__";

interface SelectionState {
  timeId: string | null;
  characterIds: string[];
  locationId: string | null;
  // 格好 / 表情 はキャラごと（キー = charId or GLOBAL_SLOT）
  outfitByChar: Record<string, string | null>;
  expressionIdsByChar: Record<string, string[]>;
  // 現在編集中のタブ（charId or GLOBAL_SLOT）
  activeCharTab: string;
  angleId: string | null;
  actionId: string | null;
  condom: CondomState;
  artStyleIds: string[];
  aspectRatioKey: string;
  qualityKey: string;
  /** プロンプト忠実度 (Classifier-Free Guidance)。1.0〜12.0 を想定、既定 5.0。 */
  cfg: number;
  batchSize: number;
  // 顔参照画像があるキャラが選ばれているとき、IP-Adapter を有効化するか
  useFaceRef: boolean;
  // IP-Adapter の強度（0.0〜1.5、0.6 推奨）
  faceRefStrength: number;
  // IP-Adapter を効かせる denoise の終端 (0..1、0.6 推奨)。
  // 早く切るほど絵柄 Lora と構図プロンプトが効く余地が残る。
  faceRefEndAt: number;
}

const initialSelection: SelectionState = {
  timeId: null,
  characterIds: [],
  locationId: null,
  outfitByChar: {},
  expressionIdsByChar: {},
  activeCharTab: GLOBAL_SLOT,
  angleId: null,
  actionId: null,
  condom: "none",
  artStyleIds: [],
  aspectRatioKey: DEFAULT_ASPECT_RATIO_KEY,
  qualityKey: DEFAULT_QUALITY_KEY,
  cfg: CFG_DEFAULT,
  batchSize: DEFAULT_BATCH_SIZE,
  useFaceRef: true,
  faceRefStrength: 0.6,
  faceRefEndAt: 0.6,
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

    const action = sel.actionId ? byId.action.get(sel.actionId) : undefined;
    // 絵柄: styleTags + triggerWords を両方注入
    const styleTagParts: string[] = [];
    for (const id of sel.artStyleIds) {
      const s = byId.artStyle.get(id);
      if (s?.styleTags) styleTagParts.push(s.styleTags);
      if (s?.triggerWords) styleTagParts.push(s.triggerWords);
    }
    const styleTags = styleTagParts.join(", ");

    // キャラごとの outfit / expression を組み立てる
    // HMR 等で古い state 形が残る可能性を考えて防御的に読み取る
    const outfitByChar = sel.outfitByChar ?? {};
    const expressionIdsByChar = sel.expressionIdsByChar ?? {};

    const perCharacter: Record<string, { outfit?: { tags: string; isNude?: boolean }; expressionTags?: string[] }> = {};
    for (const char of chars) {
      const outfitId = outfitByChar[char.id] ?? char.defaultOutfitId ?? null;
      const outfit = outfitId ? byId.outfit.get(outfitId) : undefined;
      const exprIds = expressionIdsByChar[char.id] ?? [];
      const expressionTags = exprIds
        .map((id) => byId.expression.get(id)?.tags)
        .filter((t): t is string => !!t && t.length > 0);
      perCharacter[char.id] = {
        outfit: outfit ? { tags: outfit.tags, isNude: outfit.isNude } : undefined,
        expressionTags: expressionTags.length > 0 ? expressionTags : undefined,
      };
    }

    // キャラ未選択時のグローバル
    const globalOutfitId = outfitByChar[GLOBAL_SLOT] ?? null;
    const globalOutfit = globalOutfitId ? byId.outfit.get(globalOutfitId) : undefined;
    const globalExprIds = expressionIdsByChar[GLOBAL_SLOT] ?? [];
    const globalExpressionTags = globalExprIds
      .map((id) => byId.expression.get(id)?.tags)
      .filter((t): t is string => !!t && t.length > 0);

    return buildPrompt({
      timeTags: sel.timeId ? byId.time.get(sel.timeId)?.tags : undefined,
      characters: chars,
      perCharacter,
      globalOutfit: globalOutfit ? { tags: globalOutfit.tags, isNude: globalOutfit.isNude } : undefined,
      globalExpressionTags: globalExpressionTags.length > 0 ? globalExpressionTags : undefined,
      location: sel.locationId
        ? { tags: byId.location.get(sel.locationId)?.tags ?? "", name: byId.location.get(sel.locationId)?.name }
        : undefined,
      angle: sel.angleId ? { tags: byId.angle.get(sel.angleId)?.tags ?? "" } : undefined,
      action: action ? { tags: action.tags, isNSFW: action.isNSFW } : undefined,
      condom: sel.condom,
      artStyleTags: styleTags.length > 0 ? styleTags : undefined,
      extraPromptTokens: extraPromptTokens.trim().length > 0 ? extraPromptTokens : undefined,
    });
  }, [byId, presets, sel, extraPromptTokens]);

  function toggleSingle(key: "timeId" | "locationId" | "angleId" | "actionId", id: string) {
    setSel((prev) => {
      const current = prev[key];
      return { ...prev, [key]: current === id ? null : id };
    });
  }
  function toggleMulti(key: "characterIds" | "artStyleIds", id: string) {
    setSel((prev) => {
      const list = prev[key];
      const newList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      // characterIds 変更時に activeCharTab を同期
      if (key === "characterIds") {
        const activeIsValid =
          newList.length === 0
            ? prev.activeCharTab === GLOBAL_SLOT
            : newList.includes(prev.activeCharTab);
        const nextActive = activeIsValid
          ? prev.activeCharTab
          : newList.length === 0
          ? GLOBAL_SLOT
          : newList[0];
        return { ...prev, characterIds: newList, activeCharTab: nextActive };
      }
      return { ...prev, [key]: newList };
    });
  }

  // 現在編集中のスロット（GLOBAL_SLOT or charId）
  const activeSlot =
    sel.characterIds.length === 0
      ? GLOBAL_SLOT
      : sel.characterIds.includes(sel.activeCharTab ?? "")
      ? sel.activeCharTab
      : sel.characterIds[0];

  const activeOutfitId = (sel.outfitByChar ?? {})[activeSlot] ?? null;
  const activeExpressionIds = (sel.expressionIdsByChar ?? {})[activeSlot] ?? [];

  function setActiveOutfit(id: string | null) {
    setSel((prev) => {
      const outfitByChar = prev.outfitByChar ?? {};
      const current = outfitByChar[activeSlot] ?? null;
      const next = current === id ? null : id;
      return { ...prev, outfitByChar: { ...outfitByChar, [activeSlot]: next } };
    });
  }
  function toggleActiveExpression(id: string) {
    setSel((prev) => {
      const expressionIdsByChar = prev.expressionIdsByChar ?? {};
      const current = expressionIdsByChar[activeSlot] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return {
        ...prev,
        expressionIdsByChar: { ...expressionIdsByChar, [activeSlot]: next },
      };
    });
  }
  function clearActiveExpressions() {
    setSel((prev) => {
      const expressionIdsByChar = prev.expressionIdsByChar ?? {};
      return {
        ...prev,
        expressionIdsByChar: { ...expressionIdsByChar, [activeSlot]: [] },
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
  // SDXL は 8px 単位。解像度プリセットで aspect ratio の基準サイズを拡縮して丸める。
  const roundTo8 = (n: number) => Math.max(8, Math.round(n / 8) * 8);
  const outWidth = roundTo8(aspect.width * quality.scale);
  const outHeight = roundTo8(aspect.height * quality.scale);
  const cfgValue = Number.isFinite(sel.cfg) ? sel.cfg : CFG_DEFAULT;

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

    // 選択中のキャラ＋絵柄から Lora を集める（loraUrl がある分だけ）
    // キャラ Lora → 絵柄 Lora の順で注入（キャラが主体）
    const characterLoras = sel.characterIds
      .map((id) => byId?.character.get(id))
      .filter((c): c is CharacterLite => !!c && !!c.loraUrl)
      .map((c) => ({ name: c.loraUrl as string, strength: c.loraScale ?? 1.0 }));
    const styleLoras = sel.artStyleIds
      .map((id) => byId?.artStyle.get(id))
      .filter((s): s is ArtStyleItem => !!s && !!s.loraUrl)
      .map((s) => ({ name: s.loraUrl as string, strength: s.loraScale ?? 0.8 }));
    const loras = [...characterLoras, ...styleLoras];

    // 顔参照画像を持つキャラが1人でも居れば IP-Adapter 対象。
    // ユーザーがトグルで OFF にしていればサーバー側で弾くので useFaceRef=false を送る。
    const hasAnyFaceRef = sel.characterIds.some((id) => {
      const c = byId?.character.get(id);
      return !!c && (c.faceRefCount ?? 0) > 0;
    });
    const effectiveUseFaceRef = hasAnyFaceRef && sel.useFaceRef;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          width: outWidth,
          height: outHeight,
          steps: quality.steps,
          cfg: cfgValue,
          batchSize: sel.batchSize ?? 1,
          loras,
          characterIds: sel.characterIds,
          useFaceRef: effectiveUseFaceRef,
          faceRefStrength: sel.faceRefStrength,
          faceRefEndAt: sel.faceRefEndAt,
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

  // キャラタブ表示用（2人以上で表示）
  const selectedChars = sel.characterIds
    .map((id) => byId?.character.get(id))
    .filter((c): c is CharacterLite => !!c);
  const showPerCharTabs = selectedChars.length >= 2;

  // アクティブスロットに紐づく表示用情報
  const activeChar = activeSlot === GLOBAL_SLOT ? null : byId?.character.get(activeSlot);
  const activeCharDefaultOutfitId = activeChar?.defaultOutfitId ?? null;
  const activeOutfitEffectiveId = activeOutfitId ?? activeCharDefaultOutfitId;
  const activeOutfitEffectiveLabel = activeOutfitEffectiveId
    ? byId?.outfit.get(activeOutfitEffectiveId)?.label
    : undefined;
  const outfitSummary =
    activeOutfitId != null
      ? activeOutfitEffectiveLabel
      : activeOutfitEffectiveLabel
      ? `${activeOutfitEffectiveLabel}（${activeChar?.name} のデフォ）`
      : undefined;

  const activeExpressionSummary = activeExpressionIds
    .map((id) => byId?.expression.get(id)?.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const activeExpressionMore =
    activeExpressionIds.length > 3 ? ` +${activeExpressionIds.length - 3}` : "";

  // 全キャラの合計カウント（複数キャラ時のサマリ用）
  const totalOutfitCount = Object.values(sel.outfitByChar ?? {}).filter(Boolean).length;
  const totalExpressionCount = Object.values(sel.expressionIdsByChar ?? {}).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">🎨 画像生成ツール</h1>
        <nav className="flex items-center gap-3 text-xs">
          <a href="/history" className="text-gray-400 hover:text-indigo-300">
            📸 履歴
          </a>
          <a href="/characters" className="text-gray-400 hover:text-indigo-300">
            👥 キャラ管理
          </a>
          <a href="/art-styles" className="text-gray-400 hover:text-indigo-300">
            🎨 絵柄管理
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
        summary={sel.artStyleIds
          .map((id) => {
            const s = byId?.artStyle.get(id);
            if (!s) return null;
            return s.loraUrl ? `${s.name} (Lora)` : s.name;
          })
          .filter(Boolean)
          .join(" × ")}
        help="複数選択可。Lora 付き絵柄は workflow に LoraLoader として注入されます（要 RunPod 同期）。"
      >
        <PresetChipGroup
          items={styleItems}
          selectedIds={sel.artStyleIds}
          onToggle={(id) => toggleMulti("artStyleIds", id)}
          emptyHint="絵柄未登録（🎨 絵柄管理から追加）"
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
          summary={
            showPerCharTabs && totalOutfitCount > 0
              ? `${selectedChars
                  .map((c) => {
                    const oid = (sel.outfitByChar ?? {})[c.id] ?? c.defaultOutfitId;
                    const lbl = oid ? byId?.outfit.get(oid)?.label : undefined;
                    return lbl ? `${c.name}:${lbl}` : null;
                  })
                  .filter(Boolean)
                  .join(" / ")}`
              : outfitSummary
          }
          help={
            activeChar?.gender === "male"
              ? "男性キャラに適した服装を選んでください。"
              : activeCharDefaultOutfitId && !activeOutfitId
              ? `未選択のため「${activeChar?.name}」のデフォルト服装が使われます。`
              : undefined
          }
        >
          {showPerCharTabs ? (
            <CharTabBar
              chars={selectedChars}
              activeSlot={activeSlot}
              onSelect={(slot) => setSel((p) => ({ ...p, activeCharTab: slot }))}
            />
          ) : null}
          <PresetChipGroup
            items={outfitItems}
            selectedIds={activeOutfitId ? [activeOutfitId] : []}
            onToggle={(id) => setActiveOutfit(id)}
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
          summary={
            showPerCharTabs && totalExpressionCount > 0
              ? `${selectedChars
                  .map((c) => {
                    const ids = (sel.expressionIdsByChar ?? {})[c.id] ?? [];
                    return ids.length > 0 ? `${c.name}:${ids.length}個` : null;
                  })
                  .filter(Boolean)
                  .join(" / ")}`
              : activeExpressionIds.length > 0
              ? `${activeExpressionSummary}${activeExpressionMore}`
              : undefined
          }
          help="複数選択可。目+口+赤面など組み合わせるとアヘ顔に。"
        >
          {showPerCharTabs ? (
            <CharTabBar
              chars={selectedChars}
              activeSlot={activeSlot}
              onSelect={(slot) => setSel((p) => ({ ...p, activeCharTab: slot }))}
            />
          ) : null}

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
            {activeExpressionIds.length > 0 ? (
              <button
                type="button"
                onClick={clearActiveExpressions}
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
                  selectedIds={activeExpressionIds}
                  onToggle={(id) => toggleActiveExpression(id)}
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

      {/* サイズ・画質・枚数 */}
      <section className="mt-4 grid gap-3 rounded-md border border-gray-800 bg-gray-950/60 p-3 md:grid-cols-3">
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
            🖼 解像度{" "}
            <span className="ml-1 text-gray-600">
              {outWidth} × {outHeight} / steps {quality.steps}
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

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
            🎯 CFG（プロンプト忠実度）{" "}
            <span className="ml-1 text-gray-600">{cfgValue.toFixed(1)}</span>
          </p>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {CFG_PRESETS.map((p) => {
              const active = Math.abs(cfgValue - p.value) < 0.05;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSel((prev) => ({ ...prev, cfg: p.value }))}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs transition",
                    active ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                  )}
                  title={p.description}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={CFG_MIN}
              max={CFG_MAX}
              step={0.1}
              value={cfgValue}
              onChange={(e) =>
                setSel((p) => ({ ...p, cfg: Number(e.target.value) }))
              }
              className="flex-1 accent-indigo-500"
            />
            <span className="w-12 text-right text-[10px] text-gray-300">
              {cfgValue.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-gray-600">
            低いほど崩れにくく自由。高いほどプロンプト厳守（上げすぎは焼き付き注意）。
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
            🔢 枚数 <span className="ml-1 text-gray-600">{sel.batchSize}枚同時</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BATCH_SIZE_OPTIONS.map((n) => {
              const active = sel.batchSize === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSel((p) => ({ ...p, batchSize: n }))}
                  className={clsx(
                    "w-9 rounded-full px-0 py-1 text-xs transition",
                    active
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-gray-600">
            複数枚にすると所要時間は枚数に比例して増えます
          </p>
        </div>
      </section>

      {/* 顔固定（IP-Adapter） */}
      {(() => {
        const faceRefChars = sel.characterIds
          .map((id) => byId?.character.get(id))
          .filter((c): c is CharacterLite => !!c && (c.faceRefCount ?? 0) > 0);
        if (faceRefChars.length === 0) return null;
        const totalFaceRefs = faceRefChars.reduce(
          (sum, c) => sum + (c.faceRefCount ?? 0),
          0,
        );
        return (
          <section className="mt-4 rounded-md border border-pink-900/40 bg-pink-950/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-pink-200">
                <input
                  type="checkbox"
                  checked={sel.useFaceRef}
                  onChange={(e) =>
                    setSel((p) => ({ ...p, useFaceRef: e.target.checked }))
                  }
                  className="h-4 w-4 accent-pink-500"
                />
                <span className="font-semibold">
                  👤 顔固定 (IP-Adapter)
                </span>
                <span className="text-[10px] text-pink-400">
                  — {faceRefChars.map((c) => `${c.name} (${c.faceRefCount ?? 0})`).join(", ")}
                </span>
              </label>
              <span className="text-[10px] text-pink-400">
                合計 {totalFaceRefs} 枚を使用
              </span>
            </div>
            {sel.useFaceRef ? (
              <>
                <div className="mb-1.5 flex items-center gap-2">
                  <label className="w-20 shrink-0 text-[10px] text-pink-300">強度</label>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={sel.faceRefStrength ?? 0.6}
                    onChange={(e) =>
                      setSel((p) => ({
                        ...p,
                        faceRefStrength: Number(e.target.value),
                      }))
                    }
                    className="flex-1 accent-pink-500"
                  />
                  <span className="w-12 text-right text-[10px] text-pink-200">
                    {(sel.faceRefStrength ?? 0.6).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-20 shrink-0 text-[10px] text-pink-300">
                    効く範囲
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={sel.faceRefEndAt ?? 0.6}
                    onChange={(e) =>
                      setSel((p) => ({
                        ...p,
                        faceRefEndAt: Number(e.target.value),
                      }))
                    }
                    className="flex-1 accent-pink-500"
                  />
                  <span className="w-12 text-right text-[10px] text-pink-200">
                    0→{(sel.faceRefEndAt ?? 0.6).toFixed(2)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[10px] text-pink-300/60">プリセット:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSel((p) => ({ ...p, faceRefStrength: 0.4, faceRefEndAt: 0.5 }))
                    }
                    className="rounded bg-pink-950/60 px-1.5 py-0.5 text-[10px] text-pink-200 hover:bg-pink-900/60"
                  >
                    弱（絵柄重視）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSel((p) => ({ ...p, faceRefStrength: 0.6, faceRefEndAt: 0.6 }))
                    }
                    className="rounded bg-pink-950/60 px-1.5 py-0.5 text-[10px] text-pink-200 hover:bg-pink-900/60"
                  >
                    標準
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSel((p) => ({ ...p, faceRefStrength: 0.85, faceRefEndAt: 0.8 }))
                    }
                    className="rounded bg-pink-950/60 px-1.5 py-0.5 text-[10px] text-pink-200 hover:bg-pink-900/60"
                  >
                    強（顔固定優先）
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-gray-500">
                OFF にすると通常の endpoint（Lora のみ）で生成します。
              </p>
            )}
            <p className="mt-1 text-[10px] text-pink-300/70">
              IP-Adapter Face は顔だけでなく絵柄・構図も引っ張ってきます。
              <strong className="text-pink-200">絵柄 Lora や行為プロンプトが効かない時は「効く範囲」を短くする</strong>
              （0.4〜0.6）と改善します。強度は 0.5〜0.8 が実用域。
            </p>
          </section>
        );
      })()}

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
          Warm: 30〜60 秒 / Cold Start 時: +2〜3 分 / 解像度「高」以上は +1〜3 分 / 顔固定 ON は +30〜60 秒
        </span>
      </section>

      {error ? (
        <div className="mt-5 rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          <strong>エラー:</strong> {error}
        </div>
      ) : null}

      {result ? (
        <section className="mt-6">
          <div className="mb-2 rounded-md border border-gray-800 bg-gray-900 p-3 text-xs text-gray-400">
            <div>生成枚数: {result.images.length} 枚</div>
            <div>
              Delay: {result.delayTimeMs ?? "-"}ms / Execution:{" "}
              {result.executionTimeMs ?? "-"}ms
            </div>
          </div>
          <div
            className={clsx(
              "grid gap-3",
              result.images.length === 1
                ? "grid-cols-1"
                : result.images.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {result.images.map((img) => (
              <div
                key={img.id}
                className="flex flex-col gap-1 rounded-md border border-gray-800 bg-gray-900 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt="generated"
                  className="aspect-auto w-full rounded border border-gray-800"
                />
                <div className="flex items-center justify-between">
                  <span className="truncate text-[10px] text-gray-500" title={img.seed}>
                    seed {img.seed}
                  </span>
                  <a
                    href={img.imageUrl}
                    download
                    className="rounded bg-gray-800 px-2 py-0.5 text-[10px] hover:bg-gray-700"
                  >
                    DL
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
