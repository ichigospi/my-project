"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getApiKey } from "@/lib/channel-store";
import { getAiModel } from "@/lib/ai-model";
import { getAnalyses, getProfileByChannel } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";
import { buildInjectedRules, formatRulesForPrompt } from "@/lib/rules-injector";
import { getPresetFor } from "@/lib/project-store";
import { getPatterns, buildSelectedPatternsBlock, type PatternItem } from "@/lib/pattern-store";
import type { ScriptProject, RuleProposal, SuggestionDraft } from "@/lib/project-store";
import type { ScriptAnalysis } from "@/lib/script-analysis-store";
import type { Genre, Style, QualityCheckResult, QualityCheckCategory } from "@/lib/project-store";

export default function StepProposal({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [skeleton, setSkeleton] = useState(project.structureProposal?.concept || "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [viewTab, setViewTab] = useState<"skeleton" | "analyses">("skeleton");
  const [promptText, setPromptText] = useState("");
  const [checkingSkeleton, setCheckingSkeleton] = useState(false);
  const [skeletonCheck, setSkeletonCheck] = useState<QualityCheckResult | null>(null);
  const [applyingFix, setApplyingFix] = useState(false);
  const [fixNote, setFixNote] = useState("");
  const [fixSummary, setFixSummary] = useState("");
  // 構成差分チェック（元ネタがテンプレ構成と大きく違うか）
  const [diffChecking, setDiffChecking] = useState(false);
  const [diffModal, setDiffModal] = useState<NonNullable<ScriptProject["structureDiff"]> | null>(null);
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

  // 骨組みを差分パッチ（加筆／違反箇所の削除）で修正する。全文出力し直しはしない。
  const applySkeletonFix = async (revisionNote: string): Promise<boolean> => {
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
        return true;
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
      const body = JSON.stringify({ skeleton, referenceAnalyses, rulesText, style: project.style, structureMode: project.structureMode, aiApiKey, aiModel: getAiModel("check") });
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

  // 骨組み生成の実体（構成モード確定後に呼ぶ）
  const runGenerate = async (mode: "template" | "reference", diff?: ScriptProject["structureDiff"], opts?: { patternIds?: string[]; extraPrompt?: string }) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

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
          analyses, style: project.style, topic: project.title,
          primaryAnalysisId: effectivePrimaryId || undefined,
          structureMode: mode,
          channelProfile: getProfileByChannel(project.channelId || ""), aiApiKey, aiModel: getAiModel("generate"),
          userPrompt: [promptText, opts?.extraPrompt].filter(Boolean).join("\n") || undefined,
          currentSkeleton: skeleton || undefined,
          rulesText,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.skeleton) {
        setSkeleton(data.skeleton);
        setPromptText("");
        // 骨組みテキスト＋構成モードをプロジェクトに保存（台本生成・品質チェックにも引き継ぐ）
        onUpdate({
          ...project,
          structureMode: mode,
          ...(diff ? { structureDiff: diff } : {}),
          ...(opts?.patternIds ? { selectedPatternIds: opts.patternIds } : {}),
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

  // 確認・編集済みの提案を添削部屋へ送る（送った後も下書きは残る）
  const handleSendProposals = () => {
    const chosen = suggestions.filter((s) => s.include);
    if (chosen.length === 0) { setError("送る提案にチェックを入れてください"); return; }
    const items: RuleProposal[] = chosen.map((s) => ({
      id: `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: s.category, title: s.title, content: s.content, reason: s.reason,
      status: "proposed", createdAt: new Date().toISOString(),
    }));
    onUpdate({ ...project, ruleProposals: [...(project.ruleProposals || []), ...items], suggestionDrafts: suggestions });
    setSentToReview(true);
  };

  const togglePattern = (id: string) => {
    const cur = project.selectedPatternIds || [];
    onUpdate({ ...project, selectedPatternIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  // ===== パターン参照（骨組みのセクション単位/構成全体の差し替え） =====
  const [picker, setPicker] = useState<{ mode: "section" | "structure"; heading?: string } | null>(null);
  const [prevSkeleton, setPrevSkeleton] = useState<string | null>(null);

  // セクション見出しから関連カテゴリを推定（おすすめ表示用）
  const recommendedCategories = (heading: string): string[] => {
    const hints: [RegExp, string[]][] = [
      [/オープニング|冒頭|フック|選民|掴み/, ["フック", "視聴維持"]],
      [/CTA|終盤|クロージング|鑑定|LINE|締め/, ["CTA", "売上アドバイス"]],
      [/理想|未来|祝福|欲求/, ["理想の未来"]],
      [/悩み|共感|深掘|問題提起/, ["悩み深掘り"]],
      [/常識|仮想敵|批判|破壊/, ["常識破壊"]],
      [/維持|離脱|引き/, ["視聴維持"]],
      [/構成|本編/, ["構成"]],
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

  // マークダウンを簡易HTML変換
  const renderMarkdown = (md: string) => {
    return md
      .split("\n")
      .map((line, i) => {
        // 見出し
        if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h2>;
        if (line.startsWith("## ")) {
          const heading = line.slice(3);
          return (
            <h3 key={i} className="text-lg font-bold mt-5 mb-2 text-accent flex items-center gap-2 flex-wrap">
              <span>{heading}</span>
              {patterns.length > 0 && (
                <button onClick={() => setPicker({ mode: "section", heading })}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-accent/40 text-accent hover:bg-accent hover:text-white transition-colors font-normal shrink-0"
                  title="このセクションをライブラリのパターンで差し替え（文脈は維持されます）">
                  🔁 パターン参照
                </button>
              )}
            </h3>
          );
        }
        if (line.startsWith("### ")) return <h4 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h4>;
        // 引用（参考元ブロック）
        if (line.startsWith("> ")) return <p key={i} className="pl-4 border-l-2 border-accent/30 text-sm text-gray-600 my-1">{line.slice(2)}</p>;
        // ボールド
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(2, -2)}</p>;
        // リスト
        if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-700 ml-4 list-disc my-0.5">{line.slice(2)}</li>;
        // 区切り線
        if (line.startsWith("---")) return <hr key={i} className="my-4 border-gray-200" />;
        // 空行
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // 通常テキスト
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
      });
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
                        <button onClick={() => navigator.clipboard.writeText(a.transcript)} className="text-xs text-accent hover:underline">コピー</button>
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

      {/* 骨組みタブ */}
      {viewTab === "skeleton" && (
        <>
          {applyingFix && (
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              骨組みを修正中...（対象セクション以外は変更されません）
            </div>
          )}
          {/* 構成モード表示・切替（一度でも確定したら表示） */}
          {project.structureMode && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">構成:</span>
              {(["template", "reference"] as const).map((m) => (
                <button key={m} onClick={() => onUpdate({ ...project, structureMode: m })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${project.structureMode === m ? "bg-accent text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {m === "template" ? "いつものテンプレ" : "元ネタ準拠"}
                </button>
              ))}
              <span className="text-xs text-gray-400">変更したら骨組みを再生成してください</span>
            </div>
          )}

          {/* パターンライブラリから選択（構成提案に注入するパターン） */}
          {patterns.length > 0 && (
            <div className="mb-4 bg-card-bg rounded-xl border border-gray-100 p-3">
              <button onClick={() => setShowPatterns(!showPatterns)} className="w-full flex items-center justify-between text-sm font-medium">
                <span>📚 パターンを選択（{(project.selectedPatternIds || []).filter((id) => patterns.some((p) => p.id === id)).length}件選択中 / 全{patterns.length}件）</span>
                <span className="text-gray-400">{showPatterns ? "▲" : "▼"}</span>
              </button>
              {showPatterns && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {patterns.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1.5">
                      <input type="checkbox" checked={(project.selectedPatternIds || []).includes(p.id)} onChange={() => togglePattern(p.id)} className="mt-0.5" />
                      <span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium mr-1">{p.category}</span>
                        <span className="font-semibold">{p.title}</span>
                        <span className="block text-gray-500 mt-0.5 line-clamp-2">{p.content}</span>
                      </span>
                    </label>
                  ))}
                  <p className="text-[11px] text-gray-400">選択したパターンは骨組み生成・台本生成の両方に「必ず取り入れる」ルールとして注入されます。変更したら骨組みを再生成してください</p>
                </div>
              )}
            </div>
          )}

          {/* 追加ルール提案 */}
          <div className="mb-4">
            <button onClick={handleSuggestRules} disabled={suggesting || analyses.length === 0}
              className="px-4 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-40"
              title="元ネタ台本から、今後使えそうな勝ちパターンをプロマーケター視点で提案します">
              {suggesting ? "元ネタを分析中..." : suggestions.length > 0 ? "🔄 再提案（現在の提案は過去タブへ）" : "💡 追加ルール提案"}
            </button>
            {sentToReview && <span className="ml-3 text-xs text-green-600 font-medium">✓ 添削部屋に送りました（オーナーが確認します）</span>}
          </div>

          {(suggestions.length > 0 || (project.suggestionArchive || []).length > 0) && (
            <div className="mb-6 bg-card-bg rounded-xl border border-accent/30 p-4">
              {/* タブ: 最新の提案 / 過去の提案 */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => setSugTab("current")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sugTab === "current" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                  最新の提案（{suggestions.length}）
                </button>
                <button onClick={() => setSugTab("past")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sugTab === "past" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                  過去の提案（{(project.suggestionArchive || []).reduce((n, b) => n + b.items.length, 0)}）
                </button>
              </div>

              {sugTab === "current" && suggestions.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 mb-3">内容を確認・編集し、チェックを入れて「添削部屋に送る」を押してください（提案は送信しなくても保存されます）</p>
                  <div className="space-y-3">
                    {suggestions.map((s, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${s.include ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                        <label className="flex items-center gap-2 mb-1 cursor-pointer">
                          <input type="checkbox" checked={s.include}
                            onChange={() => persistDrafts(suggestions.map((x, xi) => (xi === i ? { ...x, include: !x.include } : x)))} />
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{s.category}</span>
                          <span className="text-sm font-semibold">{s.title}</span>
                        </label>
                        <textarea value={s.content}
                          onChange={(e) => setSuggestions(suggestions.map((x, xi) => (xi === i ? { ...x, content: e.target.value } : x)))}
                          onBlur={() => persistDrafts(suggestions)}
                          className="w-full h-20 p-2 rounded border border-gray-200 text-xs leading-5 focus:outline-none focus:border-accent" />
                        <p className="text-[11px] text-gray-500 mt-1">理由: {s.reason}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSendProposals}
                    className="mt-3 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
                    チェックした提案を添削部屋に送る
                  </button>
                </>
              )}
              {sugTab === "current" && suggestions.length === 0 && (
                <p className="text-xs text-gray-400">最新の提案はありません。「追加ルール提案」を押すと生成されます</p>
              )}

              {sugTab === "past" && (
                <div className="space-y-4">
                  {(project.suggestionArchive || []).length === 0 && (
                    <p className="text-xs text-gray-400">過去の提案はありません（再提案すると、その時点の提案がここに格納されます）</p>
                  )}
                  {(project.suggestionArchive || []).map((batch, bi) => (
                    <div key={bi}>
                      <p className="text-[11px] font-medium text-gray-500 mb-1.5">
                        📁 {new Date(batch.archivedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} の提案（{batch.items.length}件）
                      </p>
                      <div className="space-y-2">
                        {batch.items.map((s, si) => (
                          <div key={si} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">{s.category}</span>
                              <span className="text-sm font-semibold text-gray-700">{s.title}</span>
                              <button onClick={() => navigator.clipboard.writeText(`[${s.category}] ${s.title}\n${s.content}`)}
                                className="ml-auto text-[11px] text-accent hover:underline shrink-0">コピー</button>
                            </div>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-5">{s.content}</p>
                            <p className="text-[11px] text-gray-400 mt-1">理由: {s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 生成ボタン */}
          {!skeleton && (
            <button onClick={handleGenerate} disabled={generating || diffChecking}
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 mb-6">
              {diffChecking ? "元ネタの構成をチェック中..." : generating ? "骨組みを生成中..." : "台本の骨組みを生成"}
            </button>
          )}

          {/* パターン参照モーダル: セクション/構成全体の差し替え用パターン選択 */}
          {picker && (() => {
            const pool = picker.mode === "structure" ? patterns.filter((p) => p.category === "構成") : patterns;
            const recs = picker.mode === "section" ? recommendedCategories(picker.heading || "") : [];
            const sorted = [...pool].sort((a, b) => (recs.includes(b.category) ? 1 : 0) - (recs.includes(a.category) ? 1 : 0));
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicker(null)}>
                <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold text-base mb-1">
                    {picker.mode === "structure" ? "構成パターンを選択" : "パターンを選択"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {picker.mode === "structure"
                      ? "選んだパターンを最優先の設計図として骨組みを再生成します（テーマ・元ネタ設定はそのまま）"
                      : `「${picker.heading}」を選んだパターンで差し替えます。テーマ・前後の繋がり・尺は自動で維持されます`}
                  </p>
                  {sorted.length === 0 && (
                    <p className="text-sm text-gray-400 py-6 text-center">
                      該当するパターンがありません。<br />添削部屋で提案を「ライブラリに追加」すると、ここから使えるようになります
                    </p>
                  )}
                  <div className="space-y-2">
                    {sorted.map((p) => (
                      <div key={p.id} className={`rounded-lg border p-3 ${recs.includes(p.category) ? "border-accent/40 bg-accent/5" : "border-gray-200"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{p.category}</span>
                          {recs.includes(p.category) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">おすすめ</span>}
                          <span className="text-sm font-semibold">{p.title}</span>
                          <button onClick={() => handleApplyPattern(p)}
                            className="ml-auto shrink-0 px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90">
                            {picker.mode === "structure" ? "この構成で再生成" : "差し替え"}
                          </button>
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

          {/* 構成乖離ポップアップ: 元ネタ準拠かテンプレか選択 */}
          {diffModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                <h3 className="font-bold text-base mb-2">元ネタの構成がいつものテンプレと大きく違います</h3>
                {diffModal.differences.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {diffModal.differences.map((d, i) => (
                      <li key={i} className="text-sm text-gray-700">・{d}</li>
                    ))}
                  </ul>
                )}
                {diffModal.summary && <p className="text-xs text-gray-500 mb-4">{diffModal.summary}</p>}
                <p className="text-xs text-gray-500 mb-4">
                  どちらを選んでも、文字数（元ネタ±500字）・口調・語彙・重複禁止・CTA導線などの必須ルールはそのまま守られます。
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => runGenerate("reference", diffModal)}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
                    元ネタ準拠で作る（構成被りを避ける）
                  </button>
                  <button onClick={() => runGenerate("template", diffModal)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                    いつもの構成で作る
                  </button>
                </div>
              </div>
            </div>
          )}

          {skeleton && (
            <div className="space-y-4 mb-6">
              {/* 表示/編集切り替え */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${!editing ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                    プレビュー
                  </button>
                  <button onClick={() => setEditing(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${editing ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                    編集
                  </button>
                </div>
                <div className="flex gap-2">
                  {prevSkeleton !== null && (
                    <button onClick={handleUndoPattern}
                      className="px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 text-sm hover:bg-purple-50"
                      title="直前のパターン差し替え/再生成を取り消して元の骨組みに戻します">
                      ↩ 差し替え前に戻す
                    </button>
                  )}
                  {patterns.some((p) => p.category === "構成") && (
                    <button onClick={() => setPicker({ mode: "structure" })} disabled={generating}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50"
                      title="構成カテゴリのパターンを選んで骨組み全体を再生成します">
                      🏗 構成全体をパターン参照
                    </button>
                  )}
                  <button onClick={handleGenerate} disabled={generating}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
                    {generating ? "生成中..." : "再生成"}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(skeleton)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                    コピー
                  </button>
                </div>
              </div>

          {/* プレビューモード */}
          {!editing && (
            <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
              {renderMarkdown(skeleton)}
            </div>
          )}

          {/* 編集モード */}
          {editing && (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
              <textarea
                value={skeleton}
                onChange={(e) => {
                  setSkeleton(e.target.value);
                  if (project.structureProposal) {
                    onUpdate({
                      ...project,
                      structureProposal: { ...project.structureProposal, concept: e.target.value },
                    });
                  }
                }}
                rows={25}
                className="w-full px-6 py-4 text-sm leading-relaxed outline-none resize-y font-mono"
              />
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* プロンプト入力欄（AIへの指示） */}
      {skeleton && (
        <div className="mb-6">
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="text-xs font-medium text-gray-500 mb-2 block">AIへの指示（修正依頼・追加指示）</label>
            <div className="flex gap-2">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="例: フックをもっと強くして / オープニングを短くして / ヒーリングパートの前に共感セクションを入れて"
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !promptText.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0 self-end"
              >
                {generating ? "生成中..." : "反映"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 骨組みの品質チェック */}
      {skeleton && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={handleSkeletonCheck} disabled={checkingSkeleton}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {checkingSkeleton ? "骨組みをチェック中..." : "🔍 骨組みの品質チェック"}
            </button>
            <span className="text-xs text-gray-400">構成ルール遵守・元台本からのズレを確認</span>
          </div>

          {skeletonCheck && (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">骨組み品質チェック <span className="text-accent">{skeletonCheck.overallScore} / 10</span></p>
                <button onClick={() => setSkeletonCheck(null)} className="text-xs text-gray-400 hover:text-gray-600">閉じる</button>
              </div>
              {skeletonCheck.topPriority && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">最優先で直すべき</p>
                  <p className="text-sm text-amber-900">{skeletonCheck.topPriority}</p>
                </div>
              )}
              <div className="space-y-3">
                {skeletonCheck.categories.map((cat, ci) => (
                  <div key={ci} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-sm font-semibold mb-2">{cat.name}</p>
                    <div className="space-y-1.5">
                      {cat.items.map((it, ii) => (
                        <div key={ii} className="flex gap-2 text-sm">
                          <span>{it.status === "pass" ? "🟢" : it.status === "warn" ? "🟡" : "🔴"}</span>
                          <div className="flex-1">
                            <span className="text-gray-700">{it.name}</span>
                            {it.comment && <p className="text-xs text-gray-500 mt-0.5">{it.comment}</p>}
                            {it.status !== "pass" && it.suggestion && (
                              <p className="text-xs text-purple-700 mt-0.5">→ {it.suggestion}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
                <button onClick={handleApplySkeletonFindings} disabled={applyingFix}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {applyingFix ? "反映中..." : "🔧 指摘を骨組みに反映（加筆・違反箇所の削除）"}
                </button>
                <span className="text-xs text-gray-400">全文出力し直しではなく、指摘箇所だけを差分修正します</span>
              </div>
            </div>
          )}

          {/* 加筆・削除の自由指示（差分修正） */}
          <div className="mt-4 bg-card-bg rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="text-xs font-medium text-gray-500 mb-2 block">加筆・削除で修正（差分／全文は作り直しません）</label>
            <div className="flex gap-2">
              <textarea value={fixNote} onChange={(e) => setFixNote(e.target.value)}
                placeholder="例: ❷のコメントCTAを削除して社会的証明だけ残す / 終盤に放置リスクのブロックを加筆 / ❹に時間軸予言を一文追加"
                rows={2} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent resize-none" />
              <button onClick={() => applySkeletonFix(fixNote)} disabled={applyingFix || !fixNote.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0 self-end">
                {applyingFix ? "反映中..." : "加筆・削除"}
              </button>
            </div>
            {fixSummary && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs font-medium text-emerald-800 mb-1">適用した修正</p>
                <pre className="text-xs text-emerald-900 whitespace-pre-wrap font-sans">{fixSummary}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onUpdate({ ...project, status: "analyzing" })}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {skeleton ? (
          <button onClick={() => onUpdate({ ...project, status: "script" })}
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
          <button onClick={() => onUpdate({ ...project, status: "script" })}
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
