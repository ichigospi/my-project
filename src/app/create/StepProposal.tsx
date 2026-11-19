"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getApiKey } from "@/lib/channel-store";
import { getAiModel } from "@/lib/ai-model";
import { getAnalyses, deleteAnalysis, getProfileByChannel, saveAnalysis } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";
import { buildInjectedRules, formatRulesForPrompt } from "@/lib/rules-injector";
import { getPresetFor, getProjects, isCardPlanFilled } from "@/lib/project-store";
import { skeletonInsertInstruction, skeletonContentInstruction, skeletonContentBatchInstruction, type CardAddition, type ContentAddition } from "@/lib/card-additions";
import { extractDrawnCards, syncDrawSpecToCards, tarotCardImageUrl, CARD_NAMES } from "@/lib/tarot-draw";
import { migratePlanToNewFlow } from "@/lib/plan-migrate";
import { getPatterns, buildSelectedPatternsBlock, updatePattern, removePattern, PATTERN_CATEGORIES, type PatternItem } from "@/lib/pattern-store";
import { pushSharedSettings } from "@/lib/shared-sync";
import TarotCardGallery from "@/components/TarotCardGallery";
import type { ScriptProject, RuleProposal, SuggestionDraft, CardPlan, CardSlot } from "@/lib/project-store";
import type { ScriptAnalysis, ScriptEssence } from "@/lib/script-analysis-store";
import { essenceBlocksInOrder, mustKeepInOrder } from "@/lib/script-analysis-store";
import { parseDrawAssignments, areaForSectionTitle, techniqueLink, type DrawAssignment } from "@/lib/draw-assignments";
import type { Genre, Style, QualityCheckResult, QualityCheckCategory } from "@/lib/project-store";

export default function StepProposal({ project, onUpdate, onNavigate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void; onNavigate?: (stepId: string) => void }) {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [skeleton, setSkeleton] = useState(project.structureProposal?.concept || "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [viewTab, setViewTab] = useState<"skeleton" | "analyses">("skeleton");
  const [promptText, setPromptText] = useState("");
  const [checkingSkeleton, setCheckingSkeleton] = useState(false);
  const [skeletonCheck, setSkeletonCheck] = useState<QualityCheckResult | null>(null);
  // 文字数不足（1,000字以上）のときの「カードを1枚追加する」候補（骨組みチェックが返す／手動でも提案できる）
  const [cardAdditions, setCardAdditions] = useState<CardAddition[]>(project.cardAdditionProposals || []);
  const [suggestingCards, setSuggestingCards] = useState(false);
  const [addingCard, setAddingCard] = useState<number | null>(null);
  // カードは増やさずに足せる要素の候補（元ネタにあってこの骨組みに無い構成内容）
  const [contentAdditions, setContentAdditions] = useState<ContentAddition[]>(project.contentAdditionProposals || []);
  const [suggestingContent, setSuggestingContent] = useState(false);
  const [addingContent, setAddingContent] = useState<number | null>(null);
  const [selectedContent, setSelectedContent] = useState<Record<number, boolean>>({});
  const [addingBatch, setAddingBatch] = useState(false);
  const [applyingFix, setApplyingFix] = useState(false);
  const [fixNote, setFixNote] = useState("");
  const [fixSummary, setFixSummary] = useState("");
  // 構成差分チェック（元ネタがテンプレ構成と大きく違うか）
  const [diffChecking, setDiffChecking] = useState(false);
  const [diffModal, setDiffModal] = useState<NonNullable<ScriptProject["structureDiff"]> | null>(null);
  // タロットの抽象ロジック（編集用ローカル状態。プロジェクトに永続化され、画面遷移しても残る）
  const [abstractDraft, setAbstractDraft] = useState<string | null>(null);
  useEffect(() => { setAbstractDraft(project.abstractLogic ?? null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  // 保存済みの抽象ロジックが（同期等で）後から入ってきた場合、未編集なら取り込む
  useEffect(() => {
    if ((abstractDraft === null || abstractDraft === "") && project.abstractLogic) setAbstractDraft(project.abstractLogic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.abstractLogic]);
  // 画面遷移（アンマウント）時に未保存の編集を自動保存（blur前に移動しても消えないように）
  const abstractSaveRef = useRef<{ draft: string | null; project: ScriptProject; onUpdate: (p: ScriptProject) => void }>({ draft: null, project, onUpdate });
  abstractSaveRef.current = { draft: abstractDraft, project, onUpdate };
  useEffect(() => {
    return () => {
      const { draft, project: p, onUpdate: upd } = abstractSaveRef.current;
      if (draft !== null && draft.trim() !== "" && draft !== (p.abstractLogic || "")) {
        upd({ ...p, abstractLogic: draft });
      }
    };
  }, []);
  // 追加ルール提案（プロジェクトに永続化。送信しなくても残り続ける）
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([]);
  const [sugTab, setSugTab] = useState<"current" | "past">("current");
  const [sentToReview, setSentToReview] = useState(false);
  // プロジェクト切替時に保存済みの下書きを読み込む
  useEffect(() => {
    setSuggestions((project.suggestionDrafts || []).map((d) => ({ ...d })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  // パターンライブラリ
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [showPatterns, setShowPatterns] = useState(false);
  useEffect(() => { setPatterns(getPatterns()); }, []);
  // 台本テキストの拡大表示モーダル
  const [zoomView, setZoomView] = useState<ScriptAnalysis | null>(null);
  // 抽象ロジックのAI壁打ち
  const [abChat, setAbChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [abMsg, setAbMsg] = useState("");
  const [abSending, setAbSending] = useState(false);

  const sendAbstractChat = async () => {
    const current = abstractDraft ?? project.abstractLogic ?? "";
    const msg = abMsg.trim();
    if (!msg || !current.trim() || abSending) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setAbSending(true);
    setError("");
    setAbChat((prev) => [...prev, { role: "user", text: msg }]);
    setAbMsg("");
    try {
      // 元台本（メイン/サブの役割付き）も渡して、訴求の出典参照や「元台本ではどう言ってる？」の相談に答えられるようにする
      const refs = analyses.map((a) => ({
        videoTitle: a.videoTitle,
        views: a.views,
        role: analyses.length > 1 ? (a.id === effectivePrimaryId ? "main" as const : "sub" as const) : undefined,
        transcript: a.transcript ? a.transcript.slice(0, 5000) : "",
        analysisResult: a.analysisResult ? {
          summary: a.analysisResult.summary,
          overallPattern: a.analysisResult.overallPattern,
          hooks: a.analysisResult.hooks,
          ctas: a.analysisResult.ctas,
          appealPoints: a.analysisResult.appealPoints,
        } : null,
      }));
      const res = await fetch("/api/script/revise-abstract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abstractLogic: current, instruction: msg, history: abChat, topic: project.title, analyses: refs, aiApiKey, aiModel: getAiModel("generate") }),
      });
      const data = await res.json();
      if (data.error) {
        setAbChat((prev) => [...prev, { role: "ai", text: `⚠ ${data.error}` }]);
      } else {
        setAbChat((prev) => [...prev, { role: "ai", text: data.reply || "修正しました。" }]);
        if (data.abstractLogic && data.abstractLogic !== current) {
          setAbstractDraft(data.abstractLogic);
          onUpdate({ ...project, abstractLogic: data.abstractLogic });
        }
      }
    } catch {
      setAbChat((prev) => [...prev, { role: "ai", text: "⚠ 通信に失敗しました。もう一度お試しください" }]);
    } finally {
      setAbSending(false);
    }
  };

  // ミスった読み取り結果を個別に削除（ライブラリ＋このプロジェクトの参照から外す）
  const handleDeleteAnalysis = (a: ScriptAnalysis) => {
    if (!confirm(`「${a.videoTitle}」の読み取り結果を削除しますか？\n\n分析ライブラリからも削除され、元に戻せません。\n（読み取りをやり直す場合は、分析ステップで再度読み取ってください）`)) return;
    deleteAnalysis(a.id);
    setAnalyses((prev) => prev.filter((x) => x.id !== a.id));
    onUpdate({
      ...project,
      analyses: project.analyses.filter((id) => id !== a.id),
      ...(project.primaryAnalysisId === a.id ? { primaryAnalysisId: undefined } : {}),
    });
  };

  // 文字数不足のときの「カードを1枚追加する」候補を手動で取り直す
  const requestCardAdditions = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!skeleton.trim()) { setError("骨組みがありません"); return; }
    setSuggestingCards(true);
    setError("");
    try {
      const referenceTranscripts = analyses.filter((a) => a.transcript).map((a) => a.transcript || "").slice(0, 2);
      const targetChars = Number((skeleton.match(/目標文字数[:：]\s*約?\s*([0-9,，]+)\s*字/)?.[1] || "").replace(/[,，]/g, "")) || (project.style === "tarot" ? 7000 : 4750);
      const res = await fetch("/api/script/suggest-card-additions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: skeleton, kind: "skeleton", targetChars, referenceTranscripts, aiApiKey, aiModel: getAiModel("check") }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const adds = (data.additions || []) as CardAddition[];
      setCardAdditions(adds);
      onUpdate({ ...project, cardAdditionProposals: adds });
      if (adds.length === 0) setError("追加カードの候補が作れませんでした（元ネタの書き起こしがあると候補が出やすくなります）");
    } catch { setError("追加カードの提案に失敗しました"); }
    finally { setSuggestingCards(false); }
  };

  // 選んだ候補を反映: カード設計表に追加カードを足し、骨組みにもセクションを差し込む
  const applyCardAddition = async (idx: number) => {
    const a = cardAdditions[idx]; if (!a) return;
    setAddingCard(idx);
    try {
      if (project.cardPlan) {
        const slots = [...project.cardPlan.slots];
        if (slots.length >= 8) { setError("カードは最大8枚までです"); return; }
        const pos = a.afterIndex && a.afterIndex <= slots.length ? a.afterIndex : slots.length - 1;
        const newSlot: CardSlot = { role: "追加", kind: "extra", title: a.title.slice(0, 12), content: a.content, source: a.source || "元ネタ", reason: `文字数不足の補い。${a.after}の後`, card: { name: a.card.name, orientation: a.card.orientation }, message: a.content, highlight: "", flow: "" };
        slots.splice(Math.max(0, pos), 0, newSlot);
        onUpdate({ ...project, cardPlan: { ...project.cardPlan, slots, updatedAt: new Date().toISOString() }, cardAdditionProposals: [] });
      } else {
        onUpdate({ ...project, cardAdditionProposals: [] });
      }
      const newSkeleton = await applySkeletonFix(skeletonInsertInstruction(a));
      if (newSkeleton) {
        setCardAdditions([]);
        // 抽選ブロックのカード一覧を、追加後の骨組みのカードに合わせる（台本生成・品質チェックが同じカードを指すように）
        const synced = syncDrawSpecToCards(project.drawSpec, extractDrawnCards(newSkeleton));
        if (synced && synced !== project.drawSpec) onUpdate({ ...project, drawSpec: synced });
      }
    } finally { setAddingCard(null); }
  };

  // カードは増やさずに足せる要素の候補を手動で取り直す
  const requestContentAdditions = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!skeleton.trim()) { setError("骨組みがありません"); return; }
    setSuggestingContent(true);
    setError("");
    try {
      const referenceTranscripts = analyses.filter((a) => a.transcript).map((a) => a.transcript || "").slice(0, 2);
      const referenceStructure = analyses.map((a, i) => {
        const st = a.analysisResult?.structure;
        return st?.length ? `元ネタ${i + 1}「${a.videoTitle || "無題"}」: ${st.map((s) => `${s.name}(${s.timeRange})→${s.purpose || ""}`).join(" / ")}` : "";
      }).filter(Boolean).join("\n");
      const targetChars = Number((skeleton.match(/目標文字数[:：]\s*約?\s*([0-9,，]+)\s*字/)?.[1] || "").replace(/[,，]/g, "")) || (project.style === "tarot" ? 7000 : 4750);
      const res = await fetch("/api/script/suggest-card-additions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: skeleton, kind: "skeleton", mode: "content", targetChars, referenceTranscripts, referenceStructure, aiApiKey, aiModel: getAiModel("check") }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const adds = (data.contentAdditions || []) as ContentAddition[];
      setContentAdditions(adds);
      onUpdate({ ...project, contentAdditionProposals: adds });
      if (adds.length === 0) setError("足せる要素の候補が作れませんでした");
    } catch { setError("要素の提案に失敗しました"); }
    finally { setSuggestingContent(false); }
  };
  // 選んだ要素を骨組みのセクションに加筆（カードは増やさない）
  const applyContentAddition = async (idx: number) => {
    const a = contentAdditions[idx]; if (!a) return;
    setAddingContent(idx);
    try {
      const ok = await applySkeletonFix(skeletonContentInstruction(a));
      if (ok) {
        const rest = contentAdditions.filter((_, i) => i !== idx);
        setContentAdditions(rest);
        onUpdate({ ...project, contentAdditionProposals: rest });
      }
    } finally { setAddingContent(null); }
  };

  // チェックした要素をまとめて骨組みに加筆（1回の差分パッチで全部反映）
  const applySelectedContentAdditions = async () => {
    const picked = contentAdditions.filter((_, i) => selectedContent[i]);
    if (picked.length === 0) { setError("追加する要素にチェックを入れてください"); return; }
    setAddingBatch(true);
    try {
      const ok = await applySkeletonFix(skeletonContentBatchInstruction(picked));
      if (ok) {
        const rest = contentAdditions.filter((_, i) => !selectedContent[i]);
        setContentAdditions(rest);
        setSelectedContent({});
        onUpdate({ ...project, contentAdditionProposals: rest });
      }
    } finally { setAddingBatch(false); }
  };

  // ===== 設計表にカードを引き、「伝えること」を埋める（旧・抽象ロジックの役割を設計表に統合） =====
  const [drawingCards, setDrawingCards] = useState(false);
  const [fillingPlan, setFillingPlan] = useState<number | "all" | null>(null);
  const [fillInstruction, setFillInstruction] = useState("");
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [replaceName, setReplaceName] = useState("");
  const [replaceOrient, setReplaceOrient] = useState<"正位置" | "逆位置">("正位置");
  const [openImagery, setOpenImagery] = useState<Record<number, boolean>>({});
  const [migrateNotice, setMigrateNotice] = useState("");

  // 旧フロー（抽象ロジックの文章）の企画を、新フロー（設計表にカード＋伝えること）へ自動で取り込む。
  // 抽象ロジック／骨組みに書かれたカードと「伝えること」を設計表に流し込み、全部入ったら抽象ロジックは外す
  const migrateToNewFlow = (silent: boolean) => {
    if (project.style !== "tarot") return;
    if (isCardPlanFilled(project.cardPlan)) { if (!silent) setMigrateNotice("この企画はすでに新しい形です"); return; }
    const abstract = abstractDraft ?? project.abstractLogic ?? "";
    const r = migratePlanToNewFlow(project.cardPlan, abstract, project.structureProposal?.concept);
    if (!r) { if (!silent) setMigrateNotice("抽象ロジックにも骨組みにもカードが見つからず、取り込めませんでした。「カードを引く」から始めてください"); return; }
    if (!r.changed) {
      if (!silent) {
        const missingCard = r.plan.slots.map((sl, i) => (!sl.card ? `${i + 1}枚目` : null)).filter(Boolean);
        const missingMsg = r.plan.slots.map((sl, i) => (sl.card && !sl.message ? `${i + 1}枚目` : null)).filter(Boolean);
        setMigrateNotice(missingCard.length
          ? `取り込みは済んでいます。${missingCard.join("・")}にカードが無いので「カードが無い枠を引く」を押し、そのあと「伝えることをAIで埋める」を押してください`
          : missingMsg.length
            ? `取り込みは済んでいます。${missingMsg.join("・")}に「伝えること」が無いので「伝えることをAIで埋める」を押してください`
            : "取り込める内容はありませんでした");
      }
      return;
    }
    const cards = r.plan.slots.filter((sl) => sl.card).map((sl, i) => ({ name: sl.card!.name, orientation: sl.card!.orientation, slot: i + 1 }));
    const synced = cards.length === r.plan.slots.length ? syncDrawSpecToCards(project.drawSpec, cards) : project.drawSpec;
    onUpdate({ ...project, cardPlan: r.plan, ...(synced !== project.drawSpec ? { drawSpec: synced } : {}), ...(r.filled ? { abstractLogic: "" } : {}) });
    if (r.filled) setAbstractDraft("");
    pushSharedSettings();
    setMigrateNotice(r.filled
      ? "旧・抽象ロジックの内容を設計表に取り込みました（カード・伝えること・背骨）。抽象ロジックの段階は不要になりました"
      : "カードを設計表に取り込みました。「伝えること」が無いカードは「伝えることをAIで埋める」で作れます");
  };
  useEffect(() => {
    // 企画を開いたとき、旧フローのままなら自動で取り込む（AIは使わない）
    if (project.style === "tarot" && !isCardPlanFilled(project.cardPlan) && (project.abstractLogic || project.structureProposal?.concept)) migrateToNewFlow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // 設計表のカードに抽選ブロックを合わせて保存（設計表が唯一の正）
  const planCardsOf = (slots: CardSlot[]) => slots.filter((sl) => sl.card).map((sl, i) => ({ name: sl.card!.name, orientation: sl.card!.orientation, slot: i + 1 }));
  const savePlanCards = (next: CardPlan, extra?: Partial<ScriptProject>) => {
    const cards = planCardsOf(next.slots);
    const synced = cards.length >= 3 && cards.length === next.slots.length ? syncDrawSpecToCards(project.drawSpec, cards) : project.drawSpec;
    onUpdate({ ...project, cardPlan: { ...next, updatedAt: new Date().toISOString() }, ...(synced !== project.drawSpec ? { drawSpec: synced } : {}), ...(extra || {}) });
    pushSharedSettings();
  };

  // カードを引く（全スロット）。すでに引いてあるスロットは残し、無いスロットだけ補う
  const drawPlanCards = async (redrawAll = false) => {
    const plan = project.cardPlan; if (!plan) return;
    setDrawingCards(true); setPlanError("");
    try {
      const needAll = redrawAll || !plan.slots.some((sl) => sl.card);
      if (needAll) {
        const res = await fetch("/api/script/card-plan/draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draw", cardPlan: plan, genre: project.genre, topic: project.title }) });
        const data = await res.json().catch(() => ({ error: `サーバーエラー（HTTP ${res.status}）` }));
        if (data.error) { setPlanError(data.error); return; }
        const slots = (data.slots as CardSlot[]).map((sl) => ({ ...sl, highlight: "", message: "", flow: "" }));
        onUpdate({ ...project, cardPlan: { ...plan, slots, backbone: undefined, drawnAt: data.drawnAt, filledAt: undefined, updatedAt: new Date().toISOString() }, drawSpec: data.drawSpec, abstractLogic: "" });
        pushSharedSettings();
        return;
      }
      // 一部だけ無い: 使用中のカードを除いて1枚ずつ引く
      const slots = [...plan.slots];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].card) continue;
        const used = slots.filter((s) => s.card).map((s) => s.card!.name);
        const res = await fetch("/api/script/card-plan/draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redraw", usedNames: used, genre: project.genre, topic: project.title }) });
        const data = await res.json().catch(() => ({ error: `サーバーエラー（HTTP ${res.status}）` }));
        if (data.error || !data.card) { setPlanError(data.error || "カードを引けませんでした"); return; }
        slots[i] = { ...slots[i], card: data.card, meaning: data.meaning || "", imagery: data.imagery || "", highlight: "", message: "", flow: "" };
      }
      savePlanCards({ ...plan, slots });
    } catch { setPlanError("カードを引けませんでした"); }
    finally { setDrawingCards(false); }
  };

  // 1枚だけ引き直す／指定のカードに差し替える（そのスロットの「伝えること」は作り直し対象になる）
  const setSlotCard = (idx: number, card: { name: string; orientation: "正位置" | "逆位置" }, meaning: string, imagery: string) => {
    const plan = project.cardPlan; if (!plan) return;
    const slots = plan.slots.map((sl, i) => (i === idx ? { ...sl, card, meaning, imagery, highlight: "", message: "", flow: "" } : sl));
    savePlanCards({ ...plan, slots });
  };
  const redrawSlot = async (idx: number) => {
    const plan = project.cardPlan; if (!plan) return;
    setDrawingCards(true); setPlanError("");
    try {
      const used = plan.slots.filter((s, i) => s.card && i !== idx).map((s) => s.card!.name);
      const res = await fetch("/api/script/card-plan/draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redraw", usedNames: used, genre: project.genre, topic: project.title }) });
      const data = await res.json();
      if (data.error) { setPlanError(data.error); return; }
      setSlotCard(idx, data.card, data.meaning || "", data.imagery || "");
    } catch { setPlanError("引き直しに失敗しました"); }
    finally { setDrawingCards(false); }
  };
  const replaceSlotCard = async () => {
    if (replaceIdx === null || !replaceName) return;
    const plan = project.cardPlan; if (!plan) return;
    if (plan.slots.some((s, i) => i !== replaceIdx && s.card?.name === replaceName)) { setPlanError("そのカードは他のスロットで使っています"); return; }
    setDrawingCards(true); setPlanError("");
    try {
      // 意味・絵柄はサーバーの登録から取る
      const res = await fetch("/api/script/card-plan/draw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "info", name: replaceName, orientation: replaceOrient }) });
      const data = await res.json();
      if (data.error) { setPlanError(data.error); return; }
      setSlotCard(replaceIdx, { name: replaceName, orientation: replaceOrient }, data.meaning || "", data.imagery || "");
      setReplaceIdx(null); setReplaceName("");
    } catch { setPlanError("差し替えに失敗しました"); }
    finally { setDrawingCards(false); }
  };

  // 背骨と各カードの「伝えること」をAIで埋める（onlyIndex を渡すと1枚だけ作り直す）
  const fillPlan = async (onlyIndex?: number) => {
    const plan = project.cardPlan; if (!plan) return;
    if (!plan.slots.every((sl) => sl.card)) {
      // カードが無い枠があれば先に引いてから（引いた結果は保存されるので、もう一度押してもらう）
      await drawPlanCards(false);
      setPlanError("カードが無かった枠を引きました。もう一度「伝えることをAIで埋める」を押してください");
      return;
    }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setPlanError("AI APIキーを設定してください"); return; }
    setFillingPlan(onlyIndex ?? "all"); setPlanError("");
    try {
      const referenceAnalyses = analyses.map((a) => ({ videoTitle: a.videoTitle, essence: a.essence || null, analysisResult: a.analysisResult || null }));
      const profile = getProfileByChannel(project.channelId || "");
      const res = await fetch("/api/script/card-plan/draw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fill", cardPlan: plan, genre: project.genre, topic: project.title, referenceAnalyses, profileText: profile ? JSON.stringify(profile).slice(0, 1500) : "", instruction: fillInstruction, onlyIndex, aiApiKey, aiModel: getAiModel("generate") }),
      });
      const data = await res.json();
      if (data.error) { setPlanError(data.error); return; }
      savePlanCards({ ...plan, slots: data.slots as CardSlot[], backbone: data.backbone, filledAt: data.filledAt }, { abstractLogic: "" });
      setFillInstruction("");
    } catch { setPlanError("「伝えること」の作成に失敗しました"); }
    finally { setFillingPlan(null); }
  };
  const updateSlotField = (idx: number, field: "highlight" | "message" | "flow", value: string) => {
    const plan = project.cardPlan; if (!plan) return;
    const slots = plan.slots.map((sl, i) => (i === idx ? { ...sl, [field]: value } : sl));
    onUpdate({ ...project, cardPlan: { ...plan, slots, updatedAt: new Date().toISOString() } });
  };
  const updateBackbone = (field: "theme" | "metaphor" | "promise", value: string) => {
    const plan = project.cardPlan; if (!plan) return;
    const backbone = { theme: "", metaphor: "", promise: "", ...(plan.backbone || {}), [field]: value };
    onUpdate({ ...project, cardPlan: { ...plan, backbone, updatedAt: new Date().toISOString() } });
  };

  // 骨組みを差分パッチ（加筆／違反箇所の削除）で修正する。全文出力し直しはしない。
  // 成功時は修正後の骨組みテキストを返す（呼び出し側で抽選ブロックのカード同期に使う）。失敗は false
  const applySkeletonFix = async (revisionNote: string): Promise<string | false> => {
    if (!revisionNote.trim()) return false;
    if (!skeleton.trim()) { setError("骨組みがありません"); return false; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return false; }
    setApplyingFix(true);
    setError("");
    setFixSummary("");
    try {
      const res = await fetch("/api/script/revise-skeleton", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skeleton, revisionNote, aiApiKey, aiModel: getAiModel("generate") }),
      });
      const raw = await res.text();
      let data: Record<string, unknown> | null = null;
      try { data = JSON.parse(raw); } catch { setError(`修正に失敗しました（応答が不正）: ${raw.slice(0, 120)}`); return false; }
      if (data?.error) { setError(data.error as string); return false; }
      if (typeof data?.skeleton === "string") {
        setSkeleton(data.skeleton);
        if (project.structureProposal) {
          onUpdate({ ...project, structureProposal: { ...project.structureProposal, concept: data.skeleton } });
        }
        setFixSummary((data.summary as string) || "");
        // 内容が変わったので古いチェック結果は破棄（再チェックを促す）
        setSkeletonCheck(null);
        setFixNote("");
        return data.skeleton as string;
      }
      return false;
    } catch { setError("骨組みの修正に失敗しました"); return false; }
    finally { setApplyingFix(false); }
  };

  // チェック結果の指摘(非pass)を加筆／削除の修正指示に整形して反映
  const handleApplySkeletonFindings = () => {
    if (!skeletonCheck) return;
    const issues: string[] = [];
    for (const cat of skeletonCheck.categories) {
      for (const it of cat.items) {
        if (it.status !== "pass" && it.suggestion) {
          issues.push(`【${cat.name} - ${it.name}】\n  問題: ${it.comment}\n  対応（加筆 or 削除）: ${it.suggestion}`);
        }
      }
    }
    if (issues.length === 0) { setError("反映が必要な指摘はありません"); return; }
    const note = `以下の指摘箇所「だけ」を、加筆または違反箇所の削除でピンポイントに直してください。\n\n【絶対ルール】\n・全文を書き直さない\n・このリストに無い箇所は1文字も変えない\n・直し方は加筆（不足要素の追加）か削除（違反・重複の除去）のみ\n\n【対応すべき指摘】\n${issues.join("\n\n")}`;
    applySkeletonFix(note);
  };

  // 骨組みの品質チェック（構成ルール遵守・元台本ズレ）
  const handleSkeletonCheck = async () => {
    if (!skeleton.trim()) { setError("先に骨組みを生成してください"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setCheckingSkeleton(true);
    setError("");
    try {
      const rulesText = formatRulesForPrompt(buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId));
      const referenceAnalyses = analyses.map((a) => ({
        videoTitle: a.videoTitle, channelName: a.channelName, views: a.views, analysisResult: a.analysisResult,
        role: analyses.length > 1 ? (a.id === effectivePrimaryId ? "main" : "sub") : undefined,
      }));
      // 文字数が足りない骨組みへの増筆提案の材料: 元ネタの書き起こし（新しいリーディング内容の抜粋元）と、同チャンネルの合格台本（アドバイスの抜粋元）
      const referenceTranscripts = analyses.filter((a) => a.transcript).map((a) => a.transcript || "").slice(0, 2);
      const recentScripts = getProjects()
        .filter((p) => p.id !== project.id && p.channelId === project.channelId && p.scriptReviewStatus === "approved" && (p.reviewedScript || p.submittedScript || p.generatedScript))
        .sort((a, b) => (b.approvedAt || b.updatedAt || "").localeCompare(a.approvedAt || a.updatedAt || ""))
        .slice(0, 2)
        .map((p) => (p.reviewedScript || p.submittedScript || p.generatedScript || ""));
      const body = JSON.stringify({ skeleton, referenceAnalyses, referenceTranscripts, recentScripts, rulesText, style: project.style, structureMode: project.structureMode, aiApiKey, aiModel: getAiModel("check") });
      let data: Record<string, unknown> | null = null;
      let lastErr = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        let httpStatus = 0;
        let parseErr: string | null = null;
        try {
          const res = await fetch("/api/script/quality-check-skeleton", {
            method: "POST", headers: { "Content-Type": "application/json" }, body,
          });
          httpStatus = res.status;
          const raw = await res.text();
          try { data = JSON.parse(raw); } catch { parseErr = raw.slice(0, 120) || "(空レスポンス)"; }
        } catch (e) { parseErr = `通信エラー: ${String(e).slice(0, 100)}`; }
        // JSONとして読めない(=Railwayの"upstream error"プレーンテキスト等)場合のみ真のタイムアウトとしてリトライ。
        // JSON付きのエラー(500でも data.error あり)はそのまま下で表示し、原因を隠さない。
        if (parseErr && !data) {
          lastErr = parseErr || `HTTP ${httpStatus}`;
          if (attempt < 3) { setError(`骨組みチェック リトライ中... (${attempt + 1}/4)`); await new Promise((r) => setTimeout(r, 6000 * (attempt + 1))); continue; }
          setError(`骨組みチェックがタイムアウトしました: ${lastErr}`); return;
        }
        if (data && (data as { retryable?: boolean }).retryable) {
          if (attempt < 3) { setError(`AI混雑のためリトライ中... (${attempt + 1}/4)`); await new Promise((r) => setTimeout(r, 6000 * (attempt + 1))); continue; }
        }
        break;
      }
      if (!data) { setError(`骨組みチェックに失敗しました: ${lastErr}`); return; }
      if (data.error) { setError(data.error as string); return; }
      setError("");
      {
        const adds = Array.isArray((data as { cardAdditions?: CardAddition[] }).cardAdditions) ? ((data as { cardAdditions: CardAddition[] }).cardAdditions) : [];
        const cadds = Array.isArray((data as { contentAdditions?: ContentAddition[] }).contentAdditions) ? ((data as { contentAdditions: ContentAddition[] }).contentAdditions) : [];
        if (adds.length > 0 || cadds.length > 0) {
          if (adds.length > 0) setCardAdditions(adds);
          if (cadds.length > 0) setContentAdditions(cadds);
          onUpdate({ ...project, ...(adds.length > 0 ? { cardAdditionProposals: adds } : {}), ...(cadds.length > 0 ? { contentAdditionProposals: cadds } : {}) });
        }
      }
      setSkeletonCheck({
        categories: (data.categories as QualityCheckCategory[]) || [],
        overallScore: (data.overallScore as number) || 0,
        topPriority: (data.topPriority as string) || "",
        checkedAt: new Date().toISOString(),
      });
    } catch { setError("骨組みチェックに失敗しました"); }
    finally { setCheckingSkeleton(false); }
  };

  useEffect(() => {
    const all = getAnalyses();
    setAnalyses(all.filter((a) => project.analyses.includes(a.id)));
  }, [project.analyses]);

  // 主軸（メイン）にする参考動画。未指定時は最多再生をメインとする
  const effectivePrimaryId = (() => {
    if (analyses.length === 0) return "";
    if (project.primaryAnalysisId && analyses.some((a) => a.id === project.primaryAnalysisId)) return project.primaryAnalysisId;
    return analyses.reduce((m, a) => ((a.views || 0) > (m.views || 0) ? a : m), analyses[0]).id;
  })();

  // --- 元ネタの本質（骨組みに必ず反映する要素）の抽出 ---
  const [extractingEssence, setExtractingEssence] = useState(false);
  const [essenceError, setEssenceError] = useState("");
  const mainAnalysis = analyses.find((a) => a.id === effectivePrimaryId) || null;

  const extractEssence = async (target: ScriptAnalysis, force = false) => {
    if (!target.transcript || (target.essence && !force)) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) return;
    setExtractingEssence(true);
    setEssenceError("");
    try {
      const res = await fetch("/api/script/extract-essence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: target.transcript, videoTitle: target.videoTitle, aiApiKey, aiModel: getAiModel("check") }),
      });
      const d = await res.json();
      if (d.error) { setEssenceError(d.error); return; }
      const updated: ScriptAnalysis = { ...target, essence: d.essence as ScriptEssence };
      saveAnalysis(updated);
      setAnalyses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      setEssenceError(e instanceof Error ? e.message : "本質の抽出に失敗しました");
    } finally {
      setExtractingEssence(false);
    }
  };

  // --- カード設計表（コア5枚＋元ネタ固有の追加カード。枚数・順番・役割の基準） ---
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planInstruction, setPlanInstruction] = useState("");
  const [planInstructOpen, setPlanInstructOpen] = useState(false);
  const [newCardText, setNewCardText] = useState("");
  const [newCardOpen, setNewCardOpen] = useState(false);
  const savePlan = (slots: CardSlot[]) => {
    onUpdate({ ...project, cardPlan: { ...(project.cardPlan || {}), slots, updatedAt: new Date().toISOString() } });
    pushSharedSettings();
  };
  const generateCardPlan = async (instruction?: string) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setPlanError("AI APIキーを設定してください"); return; }
    setPlanBusy(true); setPlanError("");
    try {
      const res = await fetch("/api/script/card-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essence: mainAnalysis?.essence ?? null, topic: project.title, genre: project.genre, instruction: instruction || undefined,
          currentPlan: instruction ? project.cardPlan ?? null : null,
          // 元ネタで「カードで何を視ていたか」を拾うための材料（追加カードの候補提案に使う）
          transcript: mainAnalysis?.transcript ? mainAnalysis.transcript.slice(0, 7000) : undefined,
          structure: mainAnalysis?.analysisResult?.structure?.map((sc) => ({ name: sc.name, timeRange: sc.timeRange, description: sc.description, purpose: sc.purpose })) || undefined,
          aiApiKey, aiModel: getAiModel("check"),
        }),
      });
      const d = await res.json();
      if (d.error) { setPlanError(d.error); return; }
      const plan = d.plan as CardPlan;
      onUpdate({ ...project, cardPlan: plan });
      pushSharedSettings();
      setPlanInstruction(""); setPlanInstructOpen(false);
    } catch (e) { setPlanError(e instanceof Error ? e.message : "設計表の作成に失敗しました"); }
    finally { setPlanBusy(false); }
  };
  const movePlanSlot = (i: number, dir: -1 | 1) => {
    const slots = [...(project.cardPlan?.slots || [])];
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[i], slots[j]] = [slots[j], slots[i]];
    savePlan(slots);
  };
  const deletePlanSlot = (i: number) => {
    const slots = [...(project.cardPlan?.slots || [])];
    if (slots[i]?.kind === "core") return;
    if (!confirm(`「${slots[i]?.title}」のカードを設計表から外しますか？`)) return;
    slots.splice(i, 1);
    savePlan(slots);
  };
  // 元ネタ由来の追加カード候補を、指定の役割の直後に差し込む
  const addSuggestedSlot = (idx: number) => {
    const plan = project.cardPlan; if (!plan) return;
    const sg = (plan.suggestions || [])[idx]; if (!sg) return;
    const slots = [...plan.slots];
    if (slots.length >= 7) { setPlanError("カードは最大7枚までです"); return; }
    const anchor = slots.findIndex((sl) => sl.kind === "core" && sl.role === sg.afterRole);
    const newSlot: CardSlot = { role: "追加", kind: "extra", title: sg.title.slice(0, 12), content: sg.content, source: sg.source || "元ネタ", reason: sg.reason || `「${sg.afterRole}」の後` };
    if (anchor >= 0) slots.splice(anchor + 1, 0, newSlot); else slots.push(newSlot);
    const suggestions = (plan.suggestions || []).filter((_, i) => i !== idx);
    onUpdate({ ...project, cardPlan: { ...plan, slots, suggestions, updatedAt: new Date().toISOString() } });
    pushSharedSettings();
  };
  const [essenceOpen, setEssenceOpen] = useState(true);
  const [abstractEdit, setAbstractEdit] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const addPlanSlot = () => {
    const text = newCardText.trim();
    if (!text) return;
    const slots = [...(project.cardPlan?.slots || [])];
    if (slots.length >= 7) { setPlanError("カードは最大7枚までです"); return; }
    slots.push({ role: "追加", kind: "extra", title: text.slice(0, 12), content: text, source: "オーナー指定", reason: "手動追加（矢印で位置を調整）" });
    savePlan(slots);
    setNewCardText(""); setNewCardOpen(false);
  };

  // メイン元ネタに本質が未抽出なら自動で抽出（骨組みを作る前に必ず見える状態にする）
  useEffect(() => {
    if (!mainAnalysis || mainAnalysis.essence || !mainAnalysis.transcript || extractingEssence) return;
    extractEssence(mainAnalysis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainAnalysis?.id, mainAnalysis?.essence]);

  // 骨組み生成の実体（構成モード確定後に呼ぶ）
  // タロットは2段階: 抽象ロジック（カードリーディング設計）→ 確認・編集 → 具体展開
  const runGenerate = async (mode: "template" | "reference", diff?: ScriptProject["structureDiff"], opts?: { patternIds?: string[]; extraPrompt?: string; phase?: "abstract" | "concrete" }) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    // 設計表にカードと「伝えること」が揃っていれば（新フロー）抽象ロジックは作らず、設計表から直接「具体」へ
    const planFilledNow = isCardPlanFilled(project.cardPlan);
    const phase = opts?.phase ?? (project.style === "tarot" ? ((planFilledNow || (abstractDraft ?? project.abstractLogic)) ? "concrete" : "abstract") : undefined);

    setDiffModal(null);
    setGenerating(true);
    setError("");

    try {
      const rules = buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId);
      const rulesText = formatRulesForPrompt(rules) + buildSelectedPatternsBlock(opts?.patternIds ?? project.selectedPatternIds);
      const res = await fetch("/api/script/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses, style: project.style, topic: project.title, genre: project.genre,
          // 具体化・修正では抽象段階の抽選結果を使い回す（抽象の再生成は引き直し）
          drawSpec: phase === "abstract" ? undefined : project.drawSpec,
          cardPlan: project.cardPlan,
          primaryAnalysisId: effectivePrimaryId || undefined,
          structureMode: mode,
          phase,
          // 新フロー（設計表が揃っている）ではサーバー側で設計表から抽象ロジックを組み立てる。旧フローの文章がある場合だけ渡す
          abstractLogic: phase === "concrete" && !planFilledNow ? (abstractDraft ?? project.abstractLogic) : undefined,
          channelProfile: getProfileByChannel(project.channelId || ""), aiApiKey, aiModel: getAiModel("generate"),
          userPrompt: [promptText, opts?.extraPrompt].filter(Boolean).join("\n") || undefined,
          currentSkeleton: skeleton || undefined,
          rulesText,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.skeleton) {
        if (phase === "abstract") {
          // 抽象ロジックとして保存（骨組みはまだ作らない）
          setAbstractDraft(data.skeleton);
          onUpdate({
            ...project,
            structureMode: mode,
            ...(diff ? { structureDiff: diff } : {}),
            ...(opts?.patternIds ? { selectedPatternIds: opts.patternIds } : {}),
            abstractLogic: data.skeleton,
            ...(typeof data.drawSpec === "string" ? { drawSpec: data.drawSpec } : {}),
          });
          setPromptText("");
          setGenerating(false);
          return;
        }
        setSkeleton(data.skeleton);
        setPromptText("");
        // 骨組みテキスト＋構成モードをプロジェクトに保存（台本生成・品質チェックにも引き継ぐ）
        onUpdate({
          ...project,
          ...(typeof data.drawSpec === "string" ? { drawSpec: data.drawSpec } : {}),
          structureMode: mode,
          ...(diff ? { structureDiff: diff } : {}),
          ...(opts?.patternIds ? { selectedPatternIds: opts.patternIds } : {}),
          ...(abstractDraft !== null ? { abstractLogic: abstractDraft } : {}),
          structureProposal: {
            suggestedTitle: project.title,
            concept: data.skeleton,
            structure: [], keyElements: [],
            suggestedHooks: [], suggestedCtas: [],
            estimatedDuration: "", targetWordCount: 5000,
          },
        });
      }
    } catch { setError("構成提案に失敗"); }
    finally { setGenerating(false); }
  };

  // 追加ルール提案: 元ネタ台本＋骨組みをプロマーケター視点で分析し、再利用できるパターンを提案。
  // 既に提案がある場合は「再提案」となり、現在の提案は過去タブに格納される
  const handleSuggestRules = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (suggestions.length > 0 && !confirm("再提案しますか？（現在の提案は「過去の提案」タブに格納されます）")) return;
    setSuggesting(true); setError(""); setSentToReview(false);
    try {
      const rulesText = formatRulesForPrompt(buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId));
      const res = await fetch("/api/script/suggest-rules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses: analyses.map((a) => ({
            videoTitle: a.videoTitle, views: a.views, transcript: a.transcript,
            analysisResult: a.analysisResult ? { summary: a.analysisResult.summary, overallPattern: a.analysisResult.overallPattern } : null,
          })),
          skeleton, style: project.style, genre: project.genre, rulesText,
          aiApiKey, aiModel: getAiModel("check"),
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const now = new Date().toISOString();
      const newDrafts: SuggestionDraft[] = ((data.suggestions || []) as { category: string; title: string; content: string; reason: string }[])
        .map((s) => ({ ...s, include: true, createdAt: now }));
      // 現在の提案を過去タブへ格納し、新しい提案を保存（プロジェクトに永続化）
      const archive = suggestions.length > 0
        ? [{ archivedAt: now, items: suggestions }, ...(project.suggestionArchive || [])]
        : (project.suggestionArchive || []);
      setSuggestions(newDrafts);
      setSugTab("current");
      onUpdate({ ...project, suggestionDrafts: newDrafts, suggestionArchive: archive });
    } catch { setError("追加ルール提案に失敗しました"); }
    finally { setSuggesting(false); }
  };

  // 下書きの編集をプロジェクトに保存（textareaのblur・チェック切替時）
  const persistDrafts = (list: SuggestionDraft[]) => {
    setSuggestions(list);
    onUpdate({ ...project, suggestionDrafts: list });
  };

  // 確認・編集済みの提案を添削部屋へ送る（送った後も下書きは残る。既に登録済みの同内容はスキップして重複させない）
  const handleSendProposals = () => {
    const chosen = suggestions.filter((s) => s.include);
    if (chosen.length === 0) { setError("送る提案にチェックを入れてください"); return; }
    const existing = new Set((project.ruleProposals || []).map((p) => `${p.category}|${p.title}`));
    const fresh = chosen.filter((s) => !existing.has(`${s.category}|${s.title}`));
    if (fresh.length === 0) { setError("チェックした提案はすべて送信済みです（添削部屋に登録されています）"); return; }
    const items: RuleProposal[] = fresh.map((s) => ({
      id: `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: s.category, title: s.title, content: s.content, reason: s.reason,
      status: "proposed", createdAt: new Date().toISOString(),
    }));
    onUpdate({ ...project, ruleProposals: [...(project.ruleProposals || []), ...items], suggestionDrafts: suggestions });
    setError("");
    setSentToReview(true);
  };

  const togglePattern = (id: string) => {
    const cur = project.selectedPatternIds || [];
    onUpdate({ ...project, selectedPatternIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  // ===== パターン参照（骨組みのセクション単位/構成全体の差し替え） =====
  const [picker, setPicker] = useState<{ mode: "section" | "structure"; heading?: string } | null>(null);
  const [prevSkeleton, setPrevSkeleton] = useState<string | null>(null);

  // セクション見出しから対応カテゴリを推定（優先表示用）
  const recommendedCategories = (heading: string): string[] => {
    const hints: [RegExp, string[]][] = [
      [/選民|おめでとう|選ばれ|オープニング|冒頭|フック|掴み/, ["選民フック"]],
      [/離脱|予告|最後に|オープンループ|引き/, ["導入の離脱防止"]],
      [/問題提起|自分ごと|気づいて/, ["問題提起"]],
      [/悩み|深掘|共感|寄り添/, ["悩みの深掘りと共感"]],
      [/常識|仮想敵|批判|破壊|ひっくり返/, ["仮想敵批判と常識破壊"]],
      [/解決|ワーク|実践|アドバイス|ステップ|方法/, ["解決策アドバイス"]],
      [/理想|未来|祝福|欲求|叶っ/, ["理想の未来"]],
      [/LINE|鑑定|重CTA/, ["LINE登録CTA"]],
      [/終盤|クロージング|締め/, ["LINE登録CTA", "口コミ", "チャンネル登録・高評価・コメント訴求"]],
      [/登録|高評価|コメント|軽CTA|儀式/, ["チャンネル登録・高評価・コメント訴求"]],
      [/口コミ|実績|社会的証明|喜びの声|報告/, ["口コミ"]],
      [/構成|本編/, ["全体構成"]],
    ];
    const out = new Set<string>();
    for (const [re, cats] of hints) if (re.test(heading)) cats.forEach((c) => out.add(c));
    return [...out];
  };

  // 選んだパターンを適用（セクション: 差分パッチで文脈保持リライト / 構成全体: パターン必須で再生成）
  const handleApplyPattern = async (p: PatternItem) => {
    if (!picker) return;
    const target = picker;
    setPicker(null);
    const before = skeleton;

    if (target.mode === "structure") {
      if (!confirm(`構成全体をパターン「${p.title}」に沿って再生成しますか？（現在の骨組みは置き換わります）`)) return;
      setPrevSkeleton(before || null);
      const ids = [...new Set([...(project.selectedPatternIds || []), p.id])];
      await runGenerate(project.structureMode || "template", undefined, {
        patternIds: ids,
        extraPrompt: `構成は【選択パターン】の「${p.title}」を最優先の設計図として組み立ててください。`,
      });
      return;
    }

    const note = `以下の【対象セクション】を、【使用パターン】を核に書き換えてください。

【絶対ルール】
・書き換えてよいのは「${target.heading}」セクションの内部だけ。他のセクションは1文字も変えない
・動画のテーマ・タイトルの約束は維持する。パターン内の例・雛形は必ずこの動画のテーマに合わせて具体化する
・直前・直後のセクションとの接続が自然になるよう、受けの一文・次への振りはこのセクション内で調整する
・尺・文字数配分・このセクションの構成上の役割は変えない
・口調・語彙ルールは従来通り

【対象セクション】
${target.heading}

【使用パターン】[${p.category}] ${p.title}
${p.content}`;
    const ok = await applySkeletonFix(note);
    if (ok) setPrevSkeleton(before);
  };

  // 差し替えを1世代だけ元に戻せる
  const handleUndoPattern = () => {
    if (prevSkeleton === null) return;
    setSkeleton(prevSkeleton);
    if (project.structureProposal) {
      onUpdate({ ...project, structureProposal: { ...project.structureProposal, concept: prevSkeleton } });
    }
    setPrevSkeleton(null);
    setSkeletonCheck(null);
    setFixSummary("");
  };

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    // 構成モードが未確定なら、まず元ネタとテンプレ構成の差分をチェックする（結果はキャッシュ）
    let mode = project.structureMode;
    let diff = project.structureDiff;
    if (!mode) {
      const main = analyses.find((a) => a.id === effectivePrimaryId);
      const diffKey = [...(project.analyses || [])].sort().join(",") + "|" + effectivePrimaryId;
      if (main?.analysisResult) {
        if (!diff || diff.key !== diffKey) {
          setDiffChecking(true);
          setError("");
          try {
            const preset = getPresetFor(project.genre as Genre, project.style as Style, project.channelId);
            const res = await fetch("/api/script/structure-diff", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mainAnalysis: { videoTitle: main.videoTitle, analysisResult: main.analysisResult },
                categoryRules: preset?.rules || "",
                style: project.style, aiApiKey, aiModel: getAiModel("check"),
              }),
            });
            const d = await res.json();
            if (!d.error) diff = { key: diffKey, divergent: !!d.divergent, differences: (d.differences as string[]) || [], summary: (d.summary as string) || "" };
          } catch { /* チェック失敗時は従来通りテンプレ構成で続行 */ }
          finally { setDiffChecking(false); }
        }
        if (diff?.divergent) {
          // 乖離が大きい → ユーザーにどちらで作るかポップアップで確認（選択後にrunGenerateが走る）
          setDiffModal(diff);
          return;
        }
      }
      mode = "template";
    }
    await runGenerate(mode, diff);
  };

  return (
    <div className="w-full max-w-3xl">
      <h2 className="text-xl font-bold mb-2">⑤ 構成提案</h2>
      <p className="text-sm text-gray-500 mb-6">{analyses.length}本の分析を基に台本の骨組みを提案</p>

      {/* チャンネルプロフィール未設定の警告 */}
      <ProfileWarning channelId={project.channelId} />

      {/* 参考動画サマリー（複数あるときはメイン/サブの役割を指定できる） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
        {analyses.map((a) => {
          const isMain = a.id === effectivePrimaryId;
          return (
            <div key={a.id} className={`bg-card-bg rounded-lg p-4 shadow-sm border ${analyses.length > 1 && isMain ? "border-accent" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">{a.videoTitle}</p>
                {analyses.length > 1 && (isMain ? (
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-accent text-white font-semibold">★メイン</span>
                ) : (
                  <button onClick={() => onUpdate({ ...project, primaryAnalysisId: a.id })}
                    className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:border-accent hover:text-accent transition-colors">
                    サブ｜メインにする
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{a.channelName} · スコア {a.score?.overall || "?"}/10</p>
              {a.analysisResult?.overallPattern && <p className="text-xs text-accent mt-1">{a.analysisResult.overallPattern}</p>}
            </div>
          );
        })}
      </div>
      {analyses.length > 1 && (
        <p className="text-xs text-gray-500 mb-6">
          ★メイン＝構成・尺配分・文字数のトレース元 ／ サブ＝フック・体験談など要素の移植のみ（構成は混ぜません）。メインを変えたら骨組みを再生成してください。
        </p>
      )}
      {analyses.length <= 1 && <div className="mb-4" />}

      {/* メインタブ: 骨組み / 参考動画の分析 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setViewTab("skeleton")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${viewTab === "skeleton" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          骨組み
        </button>
        <button onClick={() => setViewTab("analyses")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${viewTab === "analyses" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          参考動画の分析を見る（{analyses.length}本）
        </button>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* 参考動画の分析タブ */}
      {viewTab === "analyses" && (
        <div className="space-y-4 mb-6">
          {analyses.map((a) => (
            <div key={a.id} className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 flex gap-4 items-start bg-gray-50/50">
                {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-28 h-16 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{a.videoTitle}</p>
                  <p className="text-xs text-gray-500">{a.channelName} · {formatNumber(a.views)}回再生 · スコア {a.score?.overall || "?"}/10</p>
                </div>
                <button onClick={() => handleDeleteAnalysis(a)}
                  title="ミスった読み取り結果など、この分析を削除します（分析ライブラリからも削除）"
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  🗑 削除
                </button>
              </div>

              {!a.analysisResult && (
                <div className="p-4 bg-amber-50 border-t border-amber-100">
                  <p className="text-xs text-amber-700">
                    ⚠️ この動画はAI分析がまだ実行されていません（書き起こしのみ）。
                    「戻る」ボタンで分析ステップに戻り、もう一度実行してください。
                  </p>
                </div>
              )}

              {a.analysisResult && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-700">{a.analysisResult.summary}</p>

                  {/* 構成 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">構成パターン</p>
                    <p className="text-sm text-accent">{a.analysisResult.overallPattern}</p>
                  </div>

                  {/* フック・CTA */}
                  <div className="grid grid-cols-2 gap-3">
                    {a.analysisResult.hooks?.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <p className="text-xs font-medium text-red-700 mb-1">フック</p>
                        <ul className="space-y-0.5">{a.analysisResult.hooks.map((h, i) => <li key={i} className="text-xs text-gray-700">· {h}</li>)}</ul>
                      </div>
                    )}
                    {a.analysisResult.ctas?.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 mb-1">CTA</p>
                        <ul className="space-y-0.5">{a.analysisResult.ctas.map((c, i) => <li key={i} className="text-xs text-gray-700">· {c}</li>)}</ul>
                      </div>
                    )}
                  </div>

                  {/* 伸び要因・訴求 */}
                  <div className="grid grid-cols-2 gap-3">
                    {a.analysisResult.growthFactors?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-medium text-green-700 mb-1">伸び要因</p>
                        <ul className="space-y-0.5">{a.analysisResult.growthFactors.map((g, i) => <li key={i} className="text-xs text-gray-700">· {g}</li>)}</ul>
                      </div>
                    )}
                    {a.analysisResult.appealPoints?.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs font-medium text-purple-700 mb-1">訴求ポイント</p>
                        <ul className="space-y-0.5">{a.analysisResult.appealPoints.map((ap, i) => <li key={i} className="text-xs text-gray-700">· {ap}</li>)}</ul>
                      </div>
                    )}
                  </div>

                  {/* 台本テキスト */}
                  {a.transcript && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-500">台本テキスト（{a.transcript.length}文字）</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setZoomView(a)} className="text-xs text-accent hover:underline">🔍 拡大表示</button>
                          <button onClick={() => navigator.clipboard.writeText(a.transcript)} className="text-xs text-accent hover:underline">コピー</button>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs leading-5 whitespace-pre-wrap font-sans text-gray-600">{a.transcript}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 台本テキスト拡大表示モーダル */}
      {zoomView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setZoomView(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 shrink-0">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{zoomView.videoTitle}</p>
                <p className="text-xs text-gray-500">台本テキスト（{zoomView.transcript?.length || 0}文字）</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigator.clipboard.writeText(zoomView.transcript || "")}
                  className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">
                  コピー
                </button>
                <button onClick={() => setZoomView(null)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-white hover:bg-gray-700">
                  ✕ 閉じる
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <pre className="text-base leading-8 whitespace-pre-wrap font-sans text-gray-800">{zoomView.transcript}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 骨組みタブ: Step 1 カード設計表 → Step 2 抽象ロジック → Step 3 台本の骨組み（具体ロジック） */}
      {viewTab === "skeleton" && (() => {
        const isTarot = project.style === "tarot";
        const abstractText = abstractDraft ?? project.abstractLogic ?? "";
        const step1Done = !!project.cardPlan?.slots?.length;
        // 新フロー: 設計表にカードと「伝えること」が揃っていれば、抽象ロジック（Step 2）は不要
        const planFilled = isTarot && isCardPlanFilled(project.cardPlan);
        const step2Done = planFilled || !!abstractText.trim();
        const step3Done = !!skeleton;
        // 新フロー（設計表が揃っている）では抽象ロジックの段階が無いので、骨組みは Step 2 として表示する
        const stepNo = (n: number) => (isTarot ? (planFilled && n === 3 ? 2 : n) : n - 2);
        const Status = ({ done, label }: { done: boolean; label?: string }) => (
          <span className={`text-sm px-3 py-1 rounded-full font-bold ${done ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
            {done ? `✓ ${label || "完了"}` : "未着手"}
          </span>
        );
        const StepHeader = ({ n, title, desc, done, doneLabel, right }: { n: number; title: string; desc: string; done: boolean; doneLabel?: string; right?: React.ReactNode }) => (
          <div className="flex items-start gap-4 mb-4">
            <div className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold ${done ? "bg-emerald-600 text-white" : "bg-gray-800 text-white"}`}>
              <span className="text-[10px] leading-none opacity-80">STEP</span>
              <span className="text-2xl leading-none">{n}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <Status done={done} label={doneLabel} />
              </div>
              <p className="text-base text-gray-600 mt-1">{desc}</p>
            </div>
            {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
          </div>
        );
        const Connector = () => <div className="ml-7 h-6 border-l-4 border-dashed border-gray-300" />;

        return (
        <>
          {/* 準備: 元ネタの本質（自動抽出。台本に出てくる順に表示） */}
          {mainAnalysis && (
            <div className="mb-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm">準備</div>
                  <div>
                    <h3 className="text-xl font-bold text-amber-900">元ネタの本質（自動で抽出）</h3>
                    <p className="text-base text-amber-800">元ネタ「{mainAnalysis.videoTitle}」が刺さった中身。台本に出てくる順に並んでいます。Step 1〜3の生成に自動で入ります。</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {extractingEssence && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />抽出中...</span>
                  )}
                  {mainAnalysis.transcript && (
                    <button onClick={() => extractEssence(mainAnalysis, true)} disabled={extractingEssence}
                      className="text-sm px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                      {mainAnalysis.essence ? "再抽出" : "本質を抽出"}
                    </button>
                  )}
                  {mainAnalysis.essence && (
                    <button onClick={() => setEssenceOpen((v) => !v)} className="text-sm px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100">
                      {essenceOpen ? "たたむ" : "開く"}
                    </button>
                  )}
                </div>
              </div>
              {essenceError && <p className="text-sm text-red-600 mb-3">{essenceError}</p>}
              {!mainAnalysis.transcript && <p className="text-base text-amber-700">この元ネタは書き起こしが無いため抽出できません。</p>}
              {mainAnalysis.essence && essenceOpen && <EssenceOrdered e={mainAnalysis.essence} />}
            </div>
          )}

          {isTarot && (
            <>
              <Connector />
              {/* Step 1: カード設計表 */}
              <div className={`rounded-2xl border-2 p-5 shadow-sm ${step1Done ? "border-sky-300 bg-sky-50" : "border-sky-400 bg-sky-50"}`}>
                <StepHeader n={1} title="カード設計表を作る" desc="何枚引くか・順番・各カードの役割を決めます。コア5枚は固定。元ネタにあって、いつものテンプレに無いものを追加カードの候補として提案します。"
                  done={step1Done} doneLabel={step1Done ? `${project.cardPlan!.slots.length}枚で確定` : undefined}
                  right={
                    <button onClick={() => generateCardPlan()} disabled={planBusy}
                      className="text-base px-4 py-2.5 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-50">
                      {planBusy ? "作成中..." : project.cardPlan ? "AIで作り直す" : "AIで設計表を作る"}
                    </button>
                  } />
                {planError && <p className="text-sm text-red-600 mb-2">{planError}</p>}
                {migrateNotice && (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-violet-100 border border-violet-200 px-3 py-2 text-sm text-violet-900">
                    <span>🔄 {migrateNotice}</span>
                    <button onClick={() => setMigrateNotice("")} className="text-violet-500 hover:text-violet-800">✕</button>
                  </div>
                )}
                {isTarot && !isCardPlanFilled(project.cardPlan) && (abstractText.trim() || skeleton.trim()) && (
                  <div className="mb-2">
                    <button onClick={() => migrateToNewFlow(false)} className="text-sm px-3 py-1.5 rounded-lg border border-violet-300 text-violet-800 bg-white hover:bg-violet-100">
                      🔄 抽象ロジック／骨組みのカードを設計表に取り込む（新しい形にする）
                    </button>
                  </div>
                )}
                {!project.cardPlan && !planBusy && (
                  <p className="text-base text-sky-900">まだ設計表がありません。右上の「AIで設計表を作る」を押してください{!mainAnalysis?.essence ? "（元ネタの本質を抽出してからの方が精度が上がります）" : ""}。</p>
                )}
                {/* カードを引く／伝えることを埋める（旧 Step 2 の役割） */}
                {project.cardPlan && (
                  <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!project.cardPlan.slots.some((sl) => sl.card) ? (
                        <button onClick={() => drawPlanCards(false)} disabled={drawingCards || planBusy}
                          className="text-base px-4 py-2 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50">
                          {drawingCards ? "引いています..." : "🃏 カードを引く"}
                        </button>
                      ) : (
                        <>
                          {project.cardPlan.slots.some((sl) => !sl.card) && (
                            <button onClick={() => drawPlanCards(false)} disabled={drawingCards || planBusy}
                              className="text-sm px-3 py-2 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50">
                              {drawingCards ? "引いています..." : "🃏 カードが無い枠を引く"}
                            </button>
                          )}
                          <button onClick={() => fillPlan()} disabled={fillingPlan !== null || drawingCards || !project.cardPlan.slots.every((sl) => sl.card)}
                            className="text-base px-4 py-2 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50">
                            {fillingPlan === "all" ? "作成中..." : isCardPlanFilled(project.cardPlan) ? "✨ 伝えることをAIで作り直す" : "✨ 伝えることをAIで埋める"}
                          </button>
                          <button onClick={() => { if (confirm("全部のカードを引き直しますか？（伝えることも消えます）")) drawPlanCards(true); }} disabled={drawingCards || fillingPlan !== null}
                            className="text-sm px-3 py-2 rounded-xl border border-violet-300 text-violet-800 bg-white hover:bg-violet-100 disabled:opacity-50">🔁 全部引き直す</button>
                        </>
                      )}
                      <span className="text-xs text-violet-800">シャッフルは最初の1回だけ。引いた後は1枚ずつ「引き直す」「差し替え」で調整できます</span>
                      {(drawingCards || fillingPlan !== null) && <span className="text-xs text-violet-700 flex items-center gap-1"><span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />{drawingCards ? "カードを引いています…" : "伝えることを作っています…"}</span>}
                      {planError && <span className="text-sm text-red-600 font-medium">⚠ {planError}</span>}
                      {project.cardPlan.slots.some((sl) => !sl.card) && !drawingCards && (
                        <span className="text-xs text-red-700">カードが無い枠: {project.cardPlan.slots.map((sl, i) => (!sl.card ? `${i + 1}枚目` : null)).filter(Boolean).join("・")}</span>
                      )}
                    </div>
                    {project.cardPlan.slots.some((sl) => sl.card) && (
                      <div className="mt-2">
                        <input value={fillInstruction} onChange={(e) => setFillInstruction(e.target.value)} placeholder="AIへの指示（任意。例: 3枚目の常識破壊は『我慢』を仮想敵に／中心メタファーは1枚目の絵柄から）"
                          className="w-full px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-sm" />
                      </div>
                    )}
                    {project.cardPlan.backbone && (
                      <div className="mt-3 grid gap-1.5">
                        <label className="text-xs text-gray-600">メインテーマと主張
                          <input value={project.cardPlan.backbone.theme} onChange={(e) => updateBackbone("theme", e.target.value)} onBlur={pushSharedSettings} className="mt-0.5 w-full px-2 py-1 rounded border border-violet-200 bg-white text-base font-medium text-gray-900" />
                        </label>
                        <label className="text-xs text-gray-600">中心メタファー（この台本で使う比喩は1つだけ）
                          <input value={project.cardPlan.backbone.metaphor} onChange={(e) => updateBackbone("metaphor", e.target.value)} onBlur={pushSharedSettings} className="mt-0.5 w-full px-2 py-1 rounded border border-violet-200 bg-white text-base font-medium text-gray-900" />
                        </label>
                        <label className="text-xs text-gray-600">冒頭の約束（終盤で同じ言葉で回収する）
                          <input value={project.cardPlan.backbone.promise} onChange={(e) => updateBackbone("promise", e.target.value)} onBlur={pushSharedSettings} className="mt-0.5 w-full px-2 py-1 rounded border border-violet-200 bg-white text-base font-medium text-gray-900" />
                        </label>
                      </div>
                    )}
                  </div>
                )}
                {project.cardPlan && (
                  <ol className="space-y-2">
                    {project.cardPlan.slots.map((sl, i) => (
                      <li key={i} className={`rounded-xl p-3 border bg-white flex items-start gap-3 ${sl.kind === "extra" ? "border-amber-300" : "border-sky-200"}`}>
                        <div className="shrink-0 w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center text-lg font-bold">{i + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sl.kind === "extra" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{sl.kind === "extra" ? "追加" : "コア"}・{sl.role}</span>
                            <span className="text-lg font-bold text-gray-900">{sl.title}</span>
                          </div>
                          <p className="text-base leading-7 text-gray-800 mt-1">{sl.content}</p>
                          <p className="text-sm text-gray-500 mt-1">出どころ：{sl.source || "—"}　／　理由：{sl.reason || "—"}</p>
                          {/* 引いたカードと「伝えること」（旧・抽象ロジックの中身） */}
                          {sl.card && (
                            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                              <div className="flex items-start gap-3">
                                {tarotCardImageUrl(sl.card.name) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={tarotCardImageUrl(sl.card.name)!} alt={sl.card.name} loading="lazy"
                                    className={`w-14 h-[95px] rounded border border-gray-200 bg-white object-contain shrink-0 ${sl.card.orientation === "逆位置" ? "rotate-180" : ""}`} />
                                ) : <div className="w-14 h-[95px] rounded border border-gray-200 bg-white shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base font-bold text-violet-900">{sl.card.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sl.card.orientation === "逆位置" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{sl.card.orientation}</span>
                                    <button onClick={() => redrawSlot(i)} disabled={drawingCards || fillingPlan !== null} className="text-xs px-2 py-1 rounded border border-violet-300 text-violet-800 bg-white hover:bg-violet-100 disabled:opacity-50">🔁 引き直す</button>
                                    <button onClick={() => { setReplaceIdx(replaceIdx === i ? null : i); setReplaceName(""); setReplaceOrient("正位置"); }} disabled={drawingCards || fillingPlan !== null} className="text-xs px-2 py-1 rounded border border-violet-300 text-violet-800 bg-white hover:bg-violet-100 disabled:opacity-50">🃏 差し替え</button>
                                    {sl.message && <button onClick={() => fillPlan(i)} disabled={drawingCards || fillingPlan !== null} className="text-xs px-2 py-1 rounded border border-violet-300 text-violet-800 bg-white hover:bg-violet-100 disabled:opacity-50">{fillingPlan === i ? "作成中..." : "✨ この1枚の伝えることを作り直す"}</button>}
                                  </div>
                                  <p className="text-sm text-gray-800 mt-1"><span className="text-gray-500">正統な意味：</span>{sl.meaning || "—"}</p>
                                  <button onClick={() => setOpenImagery({ ...openImagery, [i]: !openImagery[i] })} className="text-xs text-violet-700 hover:underline mt-0.5">{openImagery[i] ? "絵柄を閉じる" : "絵柄を見る"}</button>
                                  {openImagery[i] && <p className="text-xs text-gray-600 mt-0.5">{sl.imagery || "—"}</p>}
                                  {replaceIdx === i && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 bg-white rounded-lg border border-violet-200 p-2">
                                      <select value={replaceName} onChange={(e) => setReplaceName(e.target.value)} className="px-2 py-1 rounded border border-gray-200 text-sm">
                                        <option value="">カードを選ぶ</option>
                                        {CARD_NAMES.map((n) => <option key={n} value={n} disabled={project.cardPlan!.slots.some((s, si) => si !== i && s.card?.name === n)}>{n}</option>)}
                                      </select>
                                      <select value={replaceOrient} onChange={(e) => setReplaceOrient(e.target.value as "正位置" | "逆位置")} className="px-2 py-1 rounded border border-gray-200 text-sm">
                                        <option value="正位置">正位置</option><option value="逆位置">逆位置</option>
                                      </select>
                                      <button onClick={replaceSlotCard} disabled={!replaceName || drawingCards} className="text-sm px-3 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">このカードにする</button>
                                      <button onClick={() => setReplaceIdx(null)} className="text-sm text-gray-500 hover:underline">やめる</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {(sl.message || sl.highlight || sl.flow) ? (
                                <div className="mt-2 space-y-1.5">
                                  <label className="block text-xs text-gray-500">絵柄の見せ場
                                    <input value={sl.highlight || ""} onChange={(e) => updateSlotField(i, "highlight", e.target.value)} onBlur={pushSharedSettings}
                                      className="mt-0.5 w-full px-2 py-1 rounded border border-violet-200 bg-white text-sm text-gray-800" />
                                  </label>
                                  <label className="block text-xs text-gray-500">伝えること（この台本固有の主張。末尾に出典）
                                    <textarea value={sl.message || ""} onChange={(e) => updateSlotField(i, "message", e.target.value)} onBlur={pushSharedSettings} rows={2}
                                      className="mt-0.5 w-full px-2 py-1 rounded border border-violet-300 bg-white text-base font-medium text-gray-900 leading-6" />
                                  </label>
                                  <label className="block text-xs text-gray-500">流れ（何をどの順で言うか）
                                    <textarea value={sl.flow || ""} onChange={(e) => updateSlotField(i, "flow", e.target.value)} onBlur={pushSharedSettings} rows={2}
                                      className="mt-0.5 w-full px-2 py-1 rounded border border-violet-200 bg-white text-sm text-gray-800 leading-6" />
                                  </label>
                                </div>
                              ) : (
                                <p className="text-xs text-violet-700 mt-2">このカードの「伝えること」はまだありません。下の「伝えることをAIで埋める」で作ります</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col gap-1">
                          <button onClick={() => movePlanSlot(i, -1)} disabled={i === 0} className="w-9 h-9 rounded-lg border border-gray-200 text-base hover:bg-gray-50 disabled:opacity-30" title="上へ">↑</button>
                          <button onClick={() => movePlanSlot(i, 1)} disabled={i === project.cardPlan!.slots.length - 1} className="w-9 h-9 rounded-lg border border-gray-200 text-base hover:bg-gray-50 disabled:opacity-30" title="下へ">↓</button>
                          {sl.kind === "extra" ? (
                            <button onClick={() => deletePlanSlot(i)} className="w-9 h-9 rounded-lg border border-red-200 text-red-500 text-base hover:bg-red-50" title="このカードを外す">🗑</button>
                          ) : (
                            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-300 text-base" title="コアは外せません">🔒</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {/* 追加カードの候補（元ネタで占っていた内容のうち、テンプレに無いもの） */}
                {project.cardPlan && (project.cardPlan.suggestions?.length || 0) > 0 && (
                  <div className="mt-4 rounded-xl p-4 border-2 border-dashed border-amber-300 bg-amber-50/60">
                    <p className="text-base font-bold text-amber-900 mb-1">➕ 元ネタから追加できるカードの候補</p>
                    <p className="text-sm text-amber-800 mb-3">元ネタで占っていた内容のうち、いつものテンプレに無いものです。入れたいものの「追加」を押すだけで、適切な位置に入ります（最大7枚）。</p>
                    <ul className="space-y-2">
                      {project.cardPlan.suggestions!.map((sg, i) => (
                        <li key={i} className="rounded-lg bg-white border border-amber-200 p-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-gray-900">{sg.title}<span className="ml-2 text-xs font-normal text-gray-500">「{sg.afterRole}」の後に入ります</span></p>
                            <p className="text-base text-gray-800 mt-0.5">{sg.content}</p>
                            <p className="text-sm text-gray-500 mt-0.5">元ネタで効いていた理由：{sg.reason || "—"}{sg.source ? `　／　出どころ：${sg.source}` : ""}</p>
                          </div>
                          <button onClick={() => addSuggestedSlot(i)} disabled={(project.cardPlan?.slots.length || 0) >= 7}
                            className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-base font-bold hover:bg-amber-700 disabled:opacity-40">追加</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {project.cardPlan && (project.cardPlan.outside?.length || 0) > 0 && (
                  <div className="mt-3 rounded-xl p-3 border border-gray-200 bg-white">
                    <p className="text-sm font-medium text-gray-700 mb-1">カードにしない要素（カードで視る内容ではないので、設計表の枚数には入れません）</p>
                    <ul className="text-sm text-gray-600 space-y-0.5">
                      {project.cardPlan.outside!.map((o, i) => (<li key={i}>・{o.title} → {o.where}{o.note ? `（${o.note}）` : ""}</li>))}
                    </ul>
                  </div>
                )}
                {project.cardPlan && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => { setNewCardOpen((v) => !v); setPlanInstructOpen(false); }}
                      className="text-sm px-3 py-2 rounded-lg border border-sky-300 text-sky-800 bg-white hover:bg-sky-100">✍️ 自分で書いてカードを追加</button>
                    <button onClick={() => { setPlanInstructOpen((v) => !v); setNewCardOpen(false); }}
                      className="text-sm px-3 py-2 rounded-lg border border-sky-300 text-sky-800 bg-white hover:bg-sky-100">✏️ AIに指示して作り直す</button>
                  </div>
                )}
                {newCardOpen && (
                  <div className="mt-3 bg-white rounded-xl p-3 border border-sky-200">
                    <p className="text-sm text-gray-600 mb-1">追加するカードで視ること（1〜2文）</p>
                    <input value={newCardText} onChange={(e) => setNewCardText(e.target.value)} placeholder="例: 運命の人がよく行く場所と、二人が近づくきっかけ"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:border-accent" />
                    <div className="flex justify-end mt-2">
                      <button onClick={addPlanSlot} disabled={!newCardText.trim()} className="text-sm px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">末尾に追加（矢印で移動）</button>
                    </div>
                  </div>
                )}
                {planInstructOpen && (
                  <div className="mt-3 bg-white rounded-xl p-3 border border-sky-200">
                    <p className="text-sm text-gray-600 mb-1">AIへの指示（例:「相手の特徴は1枚目に統合して」「場所ときっかけを解決の後に1枚追加」）</p>
                    <textarea value={planInstruction} onChange={(e) => setPlanInstruction(e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:border-accent" />
                    <div className="flex justify-end mt-2">
                      <button onClick={() => generateCardPlan(planInstruction)} disabled={planBusy || !planInstruction.trim()} className="text-sm px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                        {planBusy ? "作成中..." : "この指示で作り直す"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <Connector />

              {/* Step 2: 抽象ロジック（旧フロー。設計表にカードと「伝えること」が揃っていれば表示しない） */}
              {!planFilled && (<>
              <div className={`rounded-2xl border-2 p-5 shadow-sm ${step2Done ? "border-violet-300 bg-violet-50" : step1Done ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-gray-50"}`}>
                <StepHeader n={2} title="抽象ロジックを作る" desc="カードを引き、各カードで「何を伝えるか」の骨子を決めます。ここで流れと訴求を確認・修正してから、Step 3で具体化します。"
                  done={step2Done}
                  right={!step2Done ? (
                    <button onClick={handleGenerate} disabled={generating || diffChecking || !step1Done}
                      className="text-base px-4 py-2.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-40">
                      {diffChecking ? "元ネタの構成をチェック中..." : generating ? "生成中..." : "抽象ロジックを生成"}
                    </button>
                  ) : (
                    <button onClick={() => { if (confirm("抽象ロジックを作り直しますか？（カードも引き直されます）")) runGenerate(project.structureMode || "template", undefined, { phase: "abstract" }); }} disabled={generating}
                      className="text-sm px-3 py-2 rounded-xl border border-violet-300 text-violet-800 bg-white hover:bg-violet-100 disabled:opacity-50">🔁 抽象からやり直す</button>
                  )} />
                {!step1Done && !step2Done && (
                  <p className="text-base text-gray-600">先に Step 1 でカード設計表を作ってください。
                    <button onClick={handleGenerate} disabled={generating || diffChecking} className="ml-2 text-sm text-gray-500 underline hover:text-gray-700">設計表なしで進む</button>
                  </p>
                )}
                {project.structureMode && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm text-gray-500">構成:</span>
                    {(["template", "reference"] as const).map((m) => (
                      <button key={m} onClick={() => onUpdate({ ...project, structureMode: m })}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${project.structureMode === m ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {m === "template" ? "いつものテンプレ" : "元ネタ準拠"}
                      </button>
                    ))}
                    <span className="text-sm text-gray-400">変更したら作り直してください</span>
                  </div>
                )}
                {step2Done && (
                  <>
                    <div className="flex items-center justify-end gap-2 mb-2">
                      <button onClick={() => setAbstractEdit(false)} className={`px-3 py-1.5 rounded-lg text-sm ${!abstractEdit ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>見やすく表示</button>
                      <button onClick={() => setAbstractEdit(true)} className={`px-3 py-1.5 rounded-lg text-sm ${abstractEdit ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>テキストで編集</button>
                    </div>
                    {!abstractEdit ? (
                      <AbstractLogicView text={abstractText} assignments={parseDrawAssignments(project.drawSpec)} />
                    ) : (
                      <textarea value={abstractDraft ?? ""} onChange={(e) => setAbstractDraft(e.target.value)}
                        onBlur={() => { if (abstractDraft !== null && abstractDraft.trim() !== "" && abstractDraft !== project.abstractLogic) onUpdate({ ...project, abstractLogic: abstractDraft }); }}
                        className="w-full h-96 p-4 rounded-xl border border-violet-200 bg-white text-base leading-7 focus:outline-none focus:border-accent font-sans" />
                    )}
                    {/* AI壁打ち */}
                    <div className="mt-4 pt-4 border-t border-violet-200">
                      <p className="text-base font-bold text-violet-900 mb-2">💬 AIに相談して直す（元台本を参照して回答。カードと正統な意味は固定のまま調整します）</p>
                      {abChat.length > 0 && (
                        <div className="space-y-1.5 mb-2 max-h-56 overflow-y-auto">
                          {abChat.map((m, i) => (
                            <div key={i} className={`text-base rounded-lg px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "bg-white border border-violet-200 ml-8" : "bg-violet-100/70 mr-8"}`}>
                              <span className="font-semibold">{m.role === "user" ? "あなた: " : "AI: "}</span>{m.text}
                            </div>
                          ))}
                          {abSending && <div className="text-sm text-violet-700 px-3 py-1.5 mr-8 flex items-center gap-2"><div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />修正中...</div>}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input type="text" value={abMsg} onChange={(e) => setAbMsg(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendAbstractChat(); } }}
                          placeholder="例: 3枚目の常識破壊をもっと刺さる言い回しにして / 5枚目の未来をもっと具体的に"
                          disabled={abSending}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-violet-200 bg-white text-base focus:outline-none focus:border-accent disabled:opacity-50" />
                        <button onClick={sendAbstractChat} disabled={abSending || !abMsg.trim()}
                          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-base font-medium hover:bg-violet-700 disabled:opacity-50 shrink-0">
                          {abSending ? "送信中..." : "送信"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <TarotCardGallery text={`${abstractText}\n${skeleton}`} />
                    </div>
                  </>
                )}
              </div>
              <Connector />
              </>)}
            </>
          )}

          {/* Step 3（タロット以外は Step 1）: 台本の骨組み */}
          <div className={`rounded-2xl border-2 p-5 shadow-sm ${step3Done ? "border-emerald-300 bg-emerald-50/60" : (isTarot ? step2Done : true) ? "border-emerald-400 bg-emerald-50/60" : "border-gray-200 bg-gray-50"}`}>
            <StepHeader n={stepNo(3)} title={isTarot ? "台本の骨組みを作る（具体ロジック）" : "台本の骨組みを作る"}
              desc={isTarot ? (planFilled ? "カード設計表（カード・伝えること・背骨）を、セクションごとの具体的な骨組みに展開します。ここを確認して、次の「台本出力」に進みます。" : "抽象ロジックを、セクションごとの具体的な骨組みに展開します。ここを確認して、次の「台本出力」に進みます。") : "参考動画の分析を基に、セクションごとの骨組みを作ります。"}
              done={step3Done}
              right={isTarot ? (
                <button onClick={() => runGenerate(project.structureMode || "template", undefined, { phase: "concrete" })} disabled={generating || !step2Done}
                  className="text-base px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40">
                  {generating ? "生成中..." : step3Done ? (planFilled ? "▶ 設計表から作り直す" : "▶ 抽象ロジックから作り直す") : "▶ 具体ロジックに展開"}
                </button>
              ) : (
                <button onClick={handleGenerate} disabled={generating || diffChecking}
                  className="text-base px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40">
                  {diffChecking ? "元ネタの構成をチェック中..." : generating ? "生成中..." : step3Done ? "再生成" : "骨組みを生成"}
                </button>
              )} />
            {isTarot && !step2Done && <p className="text-base text-gray-600">先に Step 1 でカードを引き、「伝えることをAIで埋める」を済ませてください（設計表がそのまま具体ロジックの元になります）。</p>}
            {applyingFix && (
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                骨組みを修正中...（対象セクション以外は変更されません）
              </div>
            )}
            {skeleton && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className={`px-3 py-1.5 rounded-lg text-sm ${!editing ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>見やすく表示</button>
                    <button onClick={() => setEditing(true)} className={`px-3 py-1.5 rounded-lg text-sm ${editing ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>テキストで編集</button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {prevSkeleton !== null && (
                      <button onClick={handleUndoPattern} className="px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 text-sm hover:bg-purple-50 bg-white" title="直前のパターン差し替え/再生成を取り消して元の骨組みに戻します">↩ 差し替え前に戻す</button>
                    )}
                    {patterns.some((p) => p.category === "全体構成") && (
                      <button onClick={() => setPicker({ mode: "structure" })} disabled={generating} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 bg-white disabled:opacity-50" title="全体構成カテゴリのパターンを選んで骨組み全体を再生成します">🏗 構成全体をパターン参照</button>
                    )}
                    <button onClick={() => navigator.clipboard.writeText(skeleton)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 bg-white">コピー</button>
                  </div>
                </div>
                {!editing ? (
                  <SkeletonView md={skeleton} canPick={patterns.length > 0} onPick={(heading) => setPicker({ mode: "section", heading })} />
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <textarea value={skeleton}
                      onChange={(e) => {
                        setSkeleton(e.target.value);
                        if (project.structureProposal) onUpdate({ ...project, structureProposal: { ...project.structureProposal, concept: e.target.value } });
                      }}
                      rows={28} className="w-full px-5 py-4 text-base leading-7 outline-none resize-y font-sans rounded-xl" />
                  </div>
                )}

                {/* AIへの指示（修正依頼・追加指示） */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <label className="text-sm font-bold text-gray-700 mb-2 block">AIへの指示（修正依頼・追加指示）</label>
                  <div className="flex gap-2">
                    <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                      placeholder="例: フックをもっと強くして / オープニングを短くして / 4枚目のワークをもっと簡単に"
                      rows={2} className="flex-1 px-3 py-2 text-base border border-gray-200 rounded-lg outline-none focus:border-accent resize-none" />
                    <button onClick={handleGenerate} disabled={generating || !promptText.trim()}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-base font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0 self-end">
                      {generating ? "生成中..." : "反映"}
                    </button>
                  </div>
                </div>

                {/* 骨組みの品質チェック */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={handleSkeletonCheck} disabled={checkingSkeleton}
                      className="px-4 py-2 rounded-lg bg-purple-600 text-white text-base font-medium hover:bg-purple-700 disabled:opacity-50">
                      {checkingSkeleton ? "骨組みをチェック中..." : "🔍 骨組みの品質チェック"}
                    </button>
                    <span className="text-sm text-gray-500">構成ルール遵守・元台本からのズレを確認</span>
                  </div>
                  {/* 文字数不足（1,000字以上）のときの「カードを1枚追加する」候補。選ぶと設計表と骨組みの両方に反映する */}
                  {(cardAdditions.length > 0 || suggestingCards) && (
                    <div className="rounded-xl p-4 border-2 border-dashed border-rose-300 bg-rose-50/60">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-base font-bold text-rose-900">➕ 追加カードの提案（文字数不足の補い）</p>
                          <p className="text-sm text-rose-800">元ネタで占っていたのに、この骨組みに無い内容を、カードを1枚増やして足します。入れたい候補の「このカードを追加」を押すと、カード設計表と骨組みの両方に入ります。</p>
                        </div>
                        <button onClick={requestCardAdditions} disabled={suggestingCards || addingCard !== null}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-rose-300 text-rose-800 bg-white hover:bg-rose-100 disabled:opacity-50">
                          {suggestingCards ? "提案中..." : "候補を出し直す"}
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {cardAdditions.map((a, i) => (
                          <li key={i} className="rounded-lg bg-white border border-rose-200 p-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-gray-900">
                                {a.title}
                                <span className="ml-2 text-xs font-normal text-gray-500">「{a.after}」の後に入ります　／　約{a.chars}字</span>
                              </p>
                              <p className="text-sm text-rose-800 mt-0.5">カード: <b>{a.card.name}（{a.card.orientation}）</b>　{a.cardReason}</p>
                              <p className="text-base text-gray-800 mt-1">{a.content}</p>
                              <p className="text-sm text-gray-500 mt-0.5">出どころ：{a.source || "元ネタ"}</p>
                            </div>
                            <button onClick={() => applyCardAddition(i)} disabled={addingCard !== null || applyingFix}
                              className="shrink-0 px-4 py-2 rounded-lg bg-rose-600 text-white text-base font-bold hover:bg-rose-700 disabled:opacity-40">
                              {addingCard === i ? "反映中..." : "このカードを追加"}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-rose-700/70 mt-2">※ 既存のカードは減らしません。追加後は骨組みのチェックをもう一度回してください</p>
                    </div>
                  )}
                  {/* カードは増やさずに足せる要素（元ネタにあってこの骨組みに無い構成内容）。選ぶと該当セクションに加筆する */}
                  {(contentAdditions.length > 0 || suggestingContent) && (
                    <div className="rounded-xl p-4 border-2 border-dashed border-sky-300 bg-sky-50/60">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-base font-bold text-sky-900">📝 追加できる要素の提案（カードは増やさない）</p>
                          <p className="text-sm text-sky-800">元ネタにあって、この骨組みに無い構成内容です。内容は「こういう内容を追記する」という要点で、元ネタの文は写しません。入れたい要素にチェックを入れて「チェックした要素をまとめて追加」を押すと、該当するセクションに加筆します。</p>
                        </div>
                        <button onClick={requestContentAdditions} disabled={suggestingContent || addingContent !== null || addingBatch}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-sky-300 text-sky-800 bg-white hover:bg-sky-100 disabled:opacity-50">
                          {suggestingContent ? "提案中..." : "候補を出し直す"}
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {contentAdditions.map((a, i) => (
                          <li key={i} className={`rounded-lg bg-white border p-3 flex items-start gap-3 ${selectedContent[i] ? "border-sky-500 ring-1 ring-sky-300" : "border-sky-200"}`}>
                            <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={!!selectedContent[i]} onChange={(e) => setSelectedContent({ ...selectedContent, [i]: e.target.checked })}
                                className="mt-1.5 w-4 h-4 accent-sky-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-gray-900">
                                  {a.title}
                                  <span className="ml-2 text-xs font-normal text-gray-500">「{a.into}」の{a.position}に入ります　／　約{a.chars}字</span>
                                </p>
                                <p className="text-base text-gray-800 mt-1">{a.content}</p>
                                <p className="text-sm text-gray-500 mt-0.5">出どころ：{a.source || "元ネタ"}</p>
                              </div>
                            </label>
                            <button onClick={() => applyContentAddition(i)} disabled={addingContent !== null || applyingFix || addingBatch}
                              className="shrink-0 px-3 py-2 rounded-lg border border-sky-300 text-sky-800 bg-white text-sm hover:bg-sky-100 disabled:opacity-40">
                              {addingContent === i ? "反映中..." : "これだけ追加"}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <button onClick={applySelectedContentAdditions} disabled={addingBatch || applyingFix || addingContent !== null || !Object.values(selectedContent).some(Boolean)}
                          className="px-4 py-2 rounded-lg bg-sky-600 text-white text-base font-bold hover:bg-sky-700 disabled:opacity-40">
                          {addingBatch ? "まとめて反映中..." : `チェックした要素をまとめて追加（${Object.values(selectedContent).filter(Boolean).length}件）`}
                        </button>
                        <button onClick={() => setSelectedContent(Object.fromEntries(contentAdditions.map((_, i) => [i, true])))} className="text-sm text-sky-700 hover:underline">すべて選択</button>
                        <button onClick={() => setSelectedContent({})} className="text-sm text-sky-700 hover:underline">選択解除</button>
                      </div>
                      <p className="text-xs text-sky-700/70 mt-2">※ 追加後は骨組みのチェックをもう一度回してください</p>
                    </div>
                  )}
                  {skeletonCheck && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-lg">骨組み品質チェック <span className="text-accent">{skeletonCheck.overallScore} / 10</span></p>
                        <button onClick={() => setSkeletonCheck(null)} className="text-sm text-gray-400 hover:text-gray-600">閉じる</button>
                      </div>
                      {skeletonCheck.topPriority && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-sm font-medium text-amber-800 mb-1">最優先で直すべき</p>
                          <p className="text-base text-amber-900">{skeletonCheck.topPriority}</p>
                        </div>
                      )}
                      <div className="space-y-3">
                        {skeletonCheck.categories.map((cat, ci) => (
                          <div key={ci} className="border border-gray-100 rounded-lg p-3">
                            <p className="text-base font-semibold mb-2">{cat.name}</p>
                            <div className="space-y-1.5">
                              {cat.items.map((it, ii) => (
                                <div key={ii} className="flex gap-2 text-base">
                                  <span>{it.status === "pass" ? "🟢" : it.status === "warn" ? "🟡" : "🔴"}</span>
                                  <div className="flex-1">
                                    <span className="text-gray-700">{it.name}</span>
                                    {it.comment && <p className="text-sm text-gray-500 mt-0.5">{it.comment}</p>}
                                    {it.status !== "pass" && it.suggestion && <p className="text-sm text-purple-700 mt-0.5 whitespace-pre-line">→ {it.suggestion}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                        <button onClick={handleApplySkeletonFindings} disabled={applyingFix}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-base font-medium hover:bg-emerald-700 disabled:opacity-50">
                          {applyingFix ? "反映中..." : "🔧 指摘を骨組みに反映（加筆・違反箇所の削除）"}
                        </button>
                        <span className="text-sm text-gray-400">全文出力し直しではなく、指摘箇所だけを差分修正します</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <label className="text-sm font-bold text-gray-700 mb-2 block">加筆・削除で修正（差分／全文は作り直しません）</label>
                    <div className="flex gap-2">
                      <textarea value={fixNote} onChange={(e) => setFixNote(e.target.value)}
                        placeholder="例: ❷のコメントCTAを削除して社会的証明だけ残す / 終盤に放置リスクのブロックを加筆 / ❹に時間軸予言を一文追加"
                        rows={2} className="flex-1 px-3 py-2 text-base border border-gray-200 rounded-lg outline-none focus:border-accent resize-none" />
                      <button onClick={() => applySkeletonFix(fixNote)} disabled={applyingFix || !fixNote.trim()}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-base font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0 self-end">
                        {applyingFix ? "反映中..." : "加筆・削除"}
                      </button>
                    </div>
                    {fixSummary && (
                      <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-sm font-medium text-emerald-800 mb-1">適用した修正</p>
                        <pre className="text-sm text-emerald-900 whitespace-pre-wrap font-sans">{fixSummary}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 上級者向け（任意）: パターンライブラリ・追加ルール提案 */}
          <div className="mt-6 mb-6">
            <button onClick={() => setShowAdvanced((v) => !v)} className="w-full flex items-center justify-between text-base font-bold text-gray-700 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
              <span>⚙️ 上級者向け（任意）: パターンライブラリ・追加ルール提案</span>
              <span className="text-gray-400">{showAdvanced ? "▲ たたむ" : "▼ 開く"}</span>
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-4">
                {patterns.length > 0 && (
                  <div className="bg-card-bg rounded-xl border border-gray-100 p-3">
                    <button onClick={() => setShowPatterns(!showPatterns)} className="w-full flex items-center justify-between text-sm font-medium">
                      <span>📚 パターンを選択（{(project.selectedPatternIds || []).filter((id) => patterns.some((p) => p.id === id)).length}件選択中 / 全{patterns.length}件）</span>
                      <span className="text-gray-400">{showPatterns ? "▲" : "▼"}</span>
                    </button>
                    {showPatterns && (
                      <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                        {PATTERN_CATEGORIES.filter((cat) => patterns.some((p) => p.category === cat)).map((cat) => (
                          <div key={cat}>
                            <p className="text-[11px] font-bold text-gray-500 mt-2 mb-1">{cat}</p>
                            {patterns.filter((p) => p.category === cat).map((p) => (
                              <div key={p.id} className="flex items-start gap-2 text-xs hover:bg-gray-50 rounded p-1.5">
                                <input type="checkbox" checked={(project.selectedPatternIds || []).includes(p.id)} onChange={() => togglePattern(p.id)} className="mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold">{p.title}</span>
                                  <span className="block text-gray-500 mt-0.5 line-clamp-2">{p.content}</span>
                                </div>
                                <select value={p.category}
                                  onChange={(e) => { updatePattern(p.id, { category: e.target.value }); setPatterns(getPatterns()); setTimeout(() => { pushSharedSettings(); }, 300); }}
                                  className="shrink-0 text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 max-w-[110px]" title="カテゴリを変更（後から自由に再割り振りできます）">
                                  {PATTERN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => {
                                    if (!confirm(`パターン「${p.title}」を取り消しますか？（全端末のライブラリから削除されます）`)) return;
                                    removePattern(p.id); setPatterns(getPatterns()); setTimeout(() => { pushSharedSettings(); }, 300);
                                  }} className="shrink-0 text-gray-300 hover:text-red-500 text-sm leading-none mt-0.5" title="ライブラリから取り消し">✕</button>
                              </div>
                            ))}
                          </div>
                        ))}
                        <p className="text-[11px] text-gray-400">選択したパターンは骨組み生成・台本生成の両方に「必ず取り入れる」ルールとして注入されます。変更したら骨組みを再生成してください</p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <button onClick={handleSuggestRules} disabled={suggesting || analyses.length === 0}
                    className="px-4 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-40"
                    title="元ネタ台本から、今後使えそうな勝ちパターンをプロマーケター視点で提案します">
                    {suggesting ? "元ネタを分析中..." : suggestions.length > 0 ? "🔄 再提案（現在の提案は過去タブへ）" : "💡 追加ルール提案"}
                  </button>
                  {sentToReview && <span className="ml-3 text-xs text-green-600 font-medium">✓ 添削部屋に送りました（オーナーが確認します）</span>}
                </div>
                {(suggestions.length > 0 || (project.suggestionArchive || []).length > 0) && (
                  <div className="bg-card-bg rounded-xl border border-accent/30 p-4">
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => setSugTab("current")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sugTab === "current" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>最新の提案（{suggestions.length}）</button>
                      <button onClick={() => setSugTab("past")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sugTab === "past" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>過去の提案（{(project.suggestionArchive || []).reduce((n, b) => n + b.items.length, 0)}）</button>
                    </div>
                    {sugTab === "current" && suggestions.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 mb-3">内容を確認・編集し、チェックを入れて「添削部屋に送る」を押してください（提案は送信しなくても保存されます）</p>
                        <div className="space-y-3">
                          {suggestions.map((sg, i) => (
                            <div key={i} className={`rounded-lg border p-3 ${sg.include ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                              <label className="flex items-center gap-2 mb-1 cursor-pointer">
                                <input type="checkbox" checked={sg.include} onChange={() => persistDrafts(suggestions.map((x, xi) => (xi === i ? { ...x, include: !x.include } : x)))} />
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{sg.category}</span>
                                <span className="text-sm font-semibold">{sg.title}</span>
                              </label>
                              <textarea value={sg.content}
                                onChange={(e) => setSuggestions(suggestions.map((x, xi) => (xi === i ? { ...x, content: e.target.value } : x)))}
                                onBlur={() => persistDrafts(suggestions)}
                                className="w-full h-20 p-2 rounded border border-gray-200 text-xs leading-5 focus:outline-none focus:border-accent" />
                              <p className="text-[11px] text-gray-500 mt-1">理由: {sg.reason}</p>
                            </div>
                          ))}
                        </div>
                        <button onClick={handleSendProposals} className="mt-3 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">チェックした提案を添削部屋に送る</button>
                      </>
                    )}
                    {sugTab === "current" && suggestions.length === 0 && <p className="text-xs text-gray-400">最新の提案はありません。「追加ルール提案」を押すと生成されます</p>}
                    {sugTab === "past" && (
                      <div className="space-y-4">
                        {(project.suggestionArchive || []).length === 0 && <p className="text-xs text-gray-400">過去の提案はありません（再提案すると、その時点の提案がここに格納されます）</p>}
                        {(project.suggestionArchive || []).map((batch, bi) => (
                          <div key={bi}>
                            <p className="text-[11px] font-medium text-gray-500 mb-1.5">📁 {new Date(batch.archivedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} の提案（{batch.items.length}件）</p>
                            <div className="space-y-2">
                              {batch.items.map((sg, si) => (
                                <div key={si} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">{sg.category}</span>
                                    <span className="text-sm font-semibold text-gray-700">{sg.title}</span>
                                    <button onClick={() => navigator.clipboard.writeText(`[${sg.category}] ${sg.title}\n${sg.content}`)} className="ml-auto text-[11px] text-accent hover:underline shrink-0">コピー</button>
                                  </div>
                                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-5">{sg.content}</p>
                                  <p className="text-[11px] text-gray-400 mt-1">理由: {sg.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* パターン参照モーダル */}
          {picker && (() => {
            const pool = picker.mode === "structure" ? patterns.filter((p) => p.category === "全体構成") : patterns;
            const recs = picker.mode === "section" ? recommendedCategories(picker.heading || "") : [];
            const sorted = [...pool].sort((a, b) => (recs.includes(b.category) ? 1 : 0) - (recs.includes(a.category) ? 1 : 0));
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicker(null)}>
                <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold text-base mb-1">{picker.mode === "structure" ? "構成パターンを選択" : "パターンを選択"}</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {picker.mode === "structure" ? "選んだパターンを最優先の設計図として骨組みを再生成します（テーマ・元ネタ設定はそのまま）" : `「${picker.heading}」を選んだパターンで差し替えます。テーマ・前後の繋がり・尺は自動で維持されます`}
                  </p>
                  {sorted.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">該当するパターンがありません。<br />添削部屋で提案を「ライブラリに追加」すると、ここから使えるようになります</p>}
                  <div className="space-y-2">
                    {sorted.map((p) => (
                      <div key={p.id} className={`rounded-lg border p-3 ${recs.includes(p.category) ? "border-accent/40 bg-accent/5" : "border-gray-200"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{p.category}</span>
                          {recs.includes(p.category) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">おすすめ</span>}
                          <span className="text-sm font-semibold">{p.title}</span>
                          <button onClick={() => handleApplyPattern(p)} className="ml-auto shrink-0 px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90">{picker.mode === "structure" ? "この構成で再生成" : "差し替え"}</button>
                        </div>
                        <p className="text-xs text-gray-600 leading-5 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setPicker(null)} className="mt-3 px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 w-full">閉じる</button>
                </div>
              </div>
            );
          })()}

          {/* 構成乖離ポップアップ */}
          {diffModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                <h3 className="font-bold text-base mb-2">元ネタの構成がいつものテンプレと大きく違います</h3>
                {diffModal.differences.length > 0 && (
                  <ul className="mb-3 space-y-1">{diffModal.differences.map((d, i) => (<li key={i} className="text-sm text-gray-700">・{d}</li>))}</ul>
                )}
                {diffModal.summary && <p className="text-xs text-gray-500 mb-4">{diffModal.summary}</p>}
                <p className="text-xs text-gray-500 mb-4">どちらを選んでも、文字数（6,000〜8,000字）・口調・語彙・重複禁止・CTA導線などの必須ルールはそのまま守られます。</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => runGenerate("reference", diffModal)} className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">元ネタ準拠で作る（構成被りを避ける）</button>
                  <button onClick={() => runGenerate("template", diffModal)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">いつもの構成で作る</button>
                </div>
              </div>
            </div>
          )}
        </>
        );
      })()}

      {/* ナビゲーション */}
      {/* 進捗ステータスは「初めて進む時」だけ更新し、部屋の移動は onNavigate（表示遷移）で行う。
          既に台本出力まで進んだプロジェクトで戻ってきた場合もボタンが効くように */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => { if (onNavigate) onNavigate("analyzing"); else onUpdate({ ...project, status: "analyzing" }); }}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {skeleton ? (
          <button onClick={() => {
            if (project.status === "proposal") onUpdate({ ...project, status: "script" });
            onNavigate?.("script");
          }}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90">
            この骨組みで台本を作成 →
          </button>
        ) : (
          <button onClick={() => {
            if (!skeleton) setError("骨組みが生成されていません。生成するか、スキップしてください。");
          }}
            className="px-6 py-3 rounded-lg bg-gray-200 text-gray-500 font-medium cursor-not-allowed">
            この骨組みで台本を作成 →
          </button>
        )}
        {!skeleton && (
          <button onClick={() => {
            if (project.status === "proposal") onUpdate({ ...project, status: "script" });
            onNavigate?.("script");
          }}
            className="px-6 py-3 rounded-lg border border-accent text-accent font-medium hover:bg-accent/5">
            スキップして台本作成へ →
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileWarning({ channelId }: { channelId?: string }) {
  const [warn, setWarn] = useState<string | null>(null);
  const [narratorName, setNarratorName] = useState("");
  useEffect(() => {
    const profile = getProfileByChannel(channelId || "");
    setNarratorName(profile.channelName || "");
    const missing: string[] = [];
    if (!profile.channelName) missing.push("チャンネル名");
    if (!profile.concept) missing.push("コンセプト");
    if (!profile.tone) missing.push("口調");
    if (missing.length > 0) {
      setWarn(`未設定: ${missing.join(" / ")}。AIが参考動画の人物像（アリサ等）に乗っ取られる原因になります。`);
    } else {
      setWarn(null);
    }
  }, [channelId]);
  if (!warn) {
    // 問題がなくても「どの語り手で生成されるか」を常時表示（別チャンネルのプロフィール混入を一目で検知）
    return (
      <p className="mb-6 text-xs text-gray-500">
        語り手プロフィール: <span className="font-semibold text-gray-700">{narratorName || "（未設定）"}</span>
        <span className="text-gray-400 ml-1">— この設計で骨組み・台本を生成します。名前が違う場合はチャンネル選択かチャンネル設計を確認してください。</span>
      </p>
    );
  }
  return (
    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
      <span className="text-xl">⚠️</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">自チャンネルプロフィールが未設定です</p>
        <p className="text-xs text-amber-700 mt-1">{warn}</p>
        <Link href="/analysis?tab=profile" className="inline-block mt-2 text-xs text-amber-700 underline hover:text-amber-900">
          → 自チャンネル設計を開く
        </Link>
      </div>
    </div>
  );
}

// ===== 表示用コンポーネント（外注向けに大きく・順番どおりに） =====

// 元ネタの本質: 台本に出てくる順（冒頭→1〜2枚目→3枚目→4枚目→5枚目→締め→CTA参考）
function EssenceOrdered({ e }: { e: ScriptEssence }) {
  const mk = mustKeepInOrder(e);
  const blocks = essenceBlocksInOrder(e);
  const stageColor = (stage: string) =>
    stage.startsWith("冒頭") ? "bg-rose-100 text-rose-800" :
    stage.startsWith("1") ? "bg-sky-100 text-sky-800" :
    stage.startsWith("3") ? "bg-violet-100 text-violet-800" :
    stage.startsWith("4") ? "bg-emerald-100 text-emerald-800" :
    stage.startsWith("5") ? "bg-amber-100 text-amber-800" :
    stage.startsWith("締め") ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-600";
  return (
    <div className="space-y-3">
      {mk.length > 0 && (
        <div className="rounded-xl p-4 bg-amber-100 border border-amber-300">
          <p className="text-base font-bold text-amber-900 mb-2">★ 必ず反映する要素（元ネタに出てくる順）</p>
          <ol className="space-y-1.5">
            {mk.map((m, i) => (
              <li key={i} className="flex items-start gap-3 text-lg leading-8 text-gray-900">
                <span className="shrink-0 w-8 h-8 rounded-full bg-amber-600 text-white text-base font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="flex-1">
                  {m.position && <span className="mr-2 text-sm px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800 align-middle">{m.position}{m.card ? `・${m.card}枚目` : ""}</span>}
                  {m.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <ol className="space-y-2">
        {blocks.map((b, i) => (
          <li key={i} className="bg-white/90 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
            <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg ${stageColor(b.stage)}`}>{b.stage}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900 mb-1">{b.title}</p>
              {b.items ? (
                <ul className="space-y-1 text-base leading-7 text-gray-800">{b.items.map((x, j) => <li key={j}>・{x}</li>)}</ul>
              ) : (
                <p className="text-base leading-7 text-gray-800">{b.text}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// 抽象ロジック: 「メインテーマ／中心メタファー／一本線」＋カードごとの「正統な意味／絵柄の見せ場／伝えること／流れ」を、設計表と同じ見た目で
function parseAbstractLogic(md: string): { pre: { k: string; v: string }[]; sections: { title: string; fields: { k: string; v: string }[]; notes: string[] }[] } {
  const pre: { k: string; v: string }[] = [];
  const sections: { title: string; fields: { k: string; v: string }[]; notes: string[] }[] = [];
  let cur: { title: string; fields: { k: string; v: string }[]; notes: string[] } | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) { cur = { title: line.slice(3).trim(), fields: [], notes: [] }; sections.push(cur); continue; }
    if (line.startsWith("# ")) continue;
    const kv = line.replace(/^[-・]\s*/, "").match(/^([^:：]{1,14})[:：]\s*(.+)$/);
    if (!cur) { if (kv) pre.push({ k: kv[1], v: kv[2] }); else pre.push({ k: "", v: line }); continue; }
    if (kv) cur.fields.push({ k: kv[1], v: kv[2] }); else cur.notes.push(line.replace(/^[-・]\s*/, ""));
  }
  return { pre, sections };
}
// 「使っている技」のタグ（押すと台本ルールの技カタログが該当項目を開いた状態で別タブに開く）
function TechChips({ items, compact }: { items: DrawAssignment[]; compact?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
      {items.map((a, i) => (
        <a key={i} href={techniqueLink(a.bankId, a.value)} target="_blank" rel="noreferrer" title={`${a.label}: ${a.full}`}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-900 border border-violet-200 hover:bg-violet-600 hover:text-white transition">
          <span className="opacity-70">{a.label}</span><span className="font-bold">{a.value}</span>
        </a>
      ))}
    </div>
  );
}
function AbstractLogicView({ text, assignments = [] }: { text: string; assignments?: DrawAssignment[] }) {
  const { pre, sections } = parseAbstractLogic(text);
  const byArea = (area: DrawAssignment["area"]) => assignments.filter((a) => a.area === area);
  if (sections.length === 0) {
    return <pre className="bg-white rounded-xl border border-violet-200 p-4 text-base leading-7 whitespace-pre-wrap font-sans text-gray-800">{text}</pre>;
  }
  return (
    <div className="space-y-3">
      {assignments.length > 0 && (
        <div className="rounded-xl p-4 bg-white border border-violet-200">
          <p className="text-sm font-bold text-violet-900 mb-1">🎲 今回の割り当て（ツールが抽選した技。タグを押すと台本ルールの説明が開きます）</p>
          <p className="text-xs text-gray-500 mb-2">各カードの下にも、そのカードで使う技を表示しています。</p>
          <div className="space-y-1.5">
            {(["冒頭", "2枚目", "3枚目", "4枚目", "5枚目", "終盤", "本編"] as DrawAssignment["area"][]).map((area) => {
              const items = byArea(area);
              if (items.length === 0) return null;
              return (
                <div key={area} className="flex items-start gap-2">
                  <span className="shrink-0 w-14 text-xs font-bold text-gray-600 pt-1">{area}</span>
                  <TechChips items={items} compact />
                </div>
              );
            })}
          </div>
        </div>
      )}
      {pre.length > 0 && (
        <div className="rounded-xl p-4 bg-violet-100 border border-violet-300 space-y-1.5">
          {pre.map((p, i) => (
            <p key={i} className="text-base leading-7 text-gray-900">{p.k && <span className="font-bold text-violet-900 mr-2">{p.k}:</span>}{p.v}</p>
          ))}
        </div>
      )}
      <ol className="space-y-2">
        {sections.map((sc, i) => (
          <li key={i} className="rounded-xl p-4 border border-violet-200 bg-white flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center text-lg font-bold">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-gray-900">{sc.title.replace(/^\d+枚目[:：]\s*/, "")}</p>
              <dl className="mt-2 space-y-1.5">
                {sc.fields.map((f, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <dt className="shrink-0 w-28 text-sm font-bold text-violet-800 pt-1">{f.k}</dt>
                    <dd className="flex-1 text-base leading-7 text-gray-800">{f.v}</dd>
                  </div>
                ))}
              </dl>
              {sc.notes.length > 0 && <ul className="mt-2 space-y-1 text-base leading-7 text-gray-700">{sc.notes.map((n, j) => <li key={j}>・{n}</li>)}</ul>}
              {(() => { const area = areaForSectionTitle(sc.title, i); return area ? <TechChips items={byArea(area)} /> : null; })()}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// 台本の骨組み: セクションごとにカード表示。参考元・理由・上位互換ポイント（> 行）は「詳細を見る」で開く
type SkelSection = { kind: "major" | "section"; heading: string; body: string[]; details: string[] };
function parseSkeleton(md: string): { header: string[]; sections: SkelSection[] } {
  const header: string[] = [];
  const sections: SkelSection[] = [];
  let cur: SkelSection | null = null;
  let seenTitle = false;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t || t === "---") continue;
    if (t.startsWith("# ")) {
      if (!seenTitle) { seenTitle = true; continue; }
      cur = { kind: "major", heading: t.slice(2).trim(), body: [], details: [] }; sections.push(cur); continue;
    }
    if (t.startsWith("## ")) { cur = { kind: "section", heading: t.slice(3).trim(), body: [], details: [] }; sections.push(cur); continue; }
    if (!cur) { header.push(t); continue; }
    if (t.startsWith("> ")) cur.details.push(t.slice(2).trim());
    else cur.body.push(t);
  }
  return { header, sections };
}
function SkeletonView({ md, canPick, onPick }: { md: string; canPick: boolean; onPick: (heading: string) => void }) {
  const { header, sections } = parseSkeleton(md);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [allOpen, setAllOpen] = useState(false);
  if (sections.length === 0) {
    return <pre className="bg-white rounded-xl border border-emerald-200 p-4 text-base leading-7 whitespace-pre-wrap font-sans text-gray-800">{md}</pre>;
  }
  let n = 0;
  return (
    <div className="space-y-3">
      {header.length > 0 && (
        <div className="rounded-xl p-4 bg-emerald-100 border border-emerald-300 space-y-1">
          {header.map((h, i) => <p key={i} className="text-base leading-7 text-gray-900">{h}</p>)}
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setAllOpen((v) => !v)} className="text-sm text-gray-500 underline hover:text-gray-700">{allOpen ? "すべての詳細をたたむ" : "すべての詳細を見る"}</button>
      </div>
      <ol className="space-y-2">
        {sections.map((sc, i) => {
          const isSec = sc.kind === "section";
          if (isSec) n += 1;
          const isOpen = allOpen || !!open[i];
          const heading = sc.heading.replace(/^[❶❷❸❹❺❻❼❽❾❿⓫⓬]\s*/, "");
          return (
            <li key={i} className={`rounded-xl p-4 border bg-white ${isSec ? "border-emerald-200" : "border-gray-300 bg-gray-50"}`}>
              <div className="flex items-start gap-3">
                {isSec ? (
                  <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-bold">{n}</div>
                ) : (
                  <div className="shrink-0 w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center text-base font-bold">■</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-lg font-bold text-gray-900">{heading}</p>
                    {isSec && canPick && (
                      <button onClick={() => onPick(sc.heading)} className="text-[11px] px-2 py-0.5 rounded-full border border-accent/40 text-accent hover:bg-accent hover:text-white transition-colors shrink-0" title="このセクションをライブラリのパターンで差し替え">🔁 パターン参照</button>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {sc.body.map((b, j) => {
                      if (b.startsWith("### ")) return <p key={j} className="text-base font-bold text-gray-800 mt-2">{b.slice(4)}</p>;
                      if (/^[-・]\s/.test(b)) return <p key={j} className="text-base leading-7 text-gray-800 pl-4">・{b.replace(/^[-・]\s*/, "")}</p>;
                      if (b.startsWith("**") && b.endsWith("**")) return <p key={j} className="text-base font-bold text-gray-800 mt-1">{b.slice(2, -2)}</p>;
                      return <p key={j} className="text-base leading-7 text-gray-800">{b}</p>;
                    })}
                  </div>
                  {sc.details.length > 0 && (
                    <div className="mt-2">
                      <button onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} className="text-sm text-emerald-700 underline hover:text-emerald-900">
                        {isOpen ? "▲ 詳細をたたむ" : "▼ 詳細を見る（参考元・理由・上位互換ポイント）"}
                      </button>
                      {isOpen && (
                        <div className="mt-2 pl-4 border-l-4 border-emerald-200 space-y-1">
                          {sc.details.map((d, j) => <p key={j} className="text-sm leading-6 text-gray-600">{d}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
