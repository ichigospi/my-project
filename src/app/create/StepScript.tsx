"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getProfileByChannel, getAnalyses } from "@/lib/script-analysis-store";
import { pullSharedSettings } from "@/lib/shared-sync";
import { getPresetFor, getPerformanceRecordsByChannel } from "@/lib/project-store";
import { getWinningPatternsByChannel } from "@/lib/winning-patterns-store";
import { pushSharedSettings } from "@/lib/shared-sync";
import { calcSimilarity } from "@/lib/similarity";
import { buildInjectedRules, formatRulesForPrompt } from "@/lib/rules-injector";
import type { ScriptProject, TelopLine, Genre, Style, QualityCheckResult, QualityCheckCategory, QualityCheckItem, QualityComparisonRow } from "@/lib/project-store";

// 簡易ハッシュ（チェック時の台本と現在の台本が一致するか判定用）
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// マークダウン記法を除いた純粋なテキスト文字数
function pureTextLength(text: string): number {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/---+/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .length;
}

// セクション別文字数
// 「## 見出し」だけでなく、チャンネルルールに沿った「❶〜❿」マーカーや
// 「【前半】【中盤】【終盤】」ラベルでのセクション区切りにも対応する
const SECTION_HEADER_RE = /^(?=##\s|[❶❷❸❹❺❻❼❽❾❿]|【(?:前半|中盤|終盤)[^】]*】)/m;

function getSectionStats(text: string): { name: string; chars: number }[] {
  const sections: { name: string; chars: number }[] = [];
  const parts = text.split(SECTION_HEADER_RE);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const name = (lines[0]?.replace(/^##\s+/, "").trim()) || "（セクション名なし）";
    const body = lines.slice(1).join("\n");
    sections.push({ name, chars: pureTextLength(body) });
  }
  return sections;
}

// 骨組み(マークダウン)を n 個の連続グループに分割する（分割出力モード用）
// セクション見出しを境界に、なるべく文字数が均等になるよう連続したまとまりで分ける
function splitSkeletonText(skeleton: string, n: number): string[] {
  if (n <= 1) return [skeleton];
  const parts = skeleton.split(SECTION_HEADER_RE).filter((p) => p.trim());
  if (parts.length <= 1) {
    // 見出しが無い骨組みは行数で等分にフォールバック
    const lines = skeleton.split("\n");
    const per = Math.ceil(lines.length / n);
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(lines.slice(i * per, (i + 1) * per).join("\n"));
    return out.filter((p) => p.trim());
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const target = total / n;
  const groups: string[] = [];
  let cur = "";
  let curLen = 0;
  let made = 0;
  for (let i = 0; i < parts.length; i++) {
    cur += parts[i];
    curLen += parts[i].length;
    const remainingGroups = n - made - 1;
    const remainingParts = parts.length - i - 1;
    if (made < n - 1 && curLen >= target && remainingParts >= remainingGroups) {
      groups.push(cur);
      cur = ""; curLen = 0; made++;
    }
  }
  if (cur.trim()) groups.push(cur);
  return groups;
}

// 推定動画尺（千代婆ベース: 後で調整、デフォルト250文字/分）
const CHARS_PER_MINUTE = 250;

export default function StepScript({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  // 台本生成時に共通ルール/NG表現が古い/空のままだと別チャンネルの世界観が混入するため、
  // マウント時に必ず共有設定をpullしてlocalStorageを最新化する
  useEffect(() => {
    pullSharedSettings().catch(() => { /* pull失敗時もローカル分で続行 */ });
  }, []);

  const [generating, setGenerating] = useState(false);
  const [convertingTelop, setConvertingTelop] = useState(false);
  const [suggestingThumb, setSuggestingThumb] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [scriptHistory, setScriptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [showQualityDetail, setShowQualityDetail] = useState(true);
  const [syncDone, setSyncDone] = useState(false);

  // 分割出力（出力回数 1〜3）
  const [splitCount, setSplitCount] = useState(project.splitCount || 1);
  const [segmentChecking, setSegmentChecking] = useState<number | null>(null);
  const [segmentRevising, setSegmentRevising] = useState<number | null>(null);
  const [segmentReviseNote, setSegmentReviseNote] = useState<Record<number, string>>({});
  // パートQCの指摘ごとの「転記対象から外す」状態（key = "segIdx:catIdx:itemIdx"。デフォルトは含める=未除外）
  const [excludedFixes, setExcludedFixes] = useState<Record<string, boolean>>({});
  // 全体QC（8観点）の指摘ごとの除外状態（key = "catIdx-itemIdx"。デフォルトは含める）
  const [mainExcludedFixes, setMainExcludedFixes] = useState<Record<string, boolean>>({});

  // 一致率チェック
  const [similarities, setSimilarities] = useState<{ title: string; rate: number }[]>([]);

  useEffect(() => {
    if (!project.generatedScript) return;
    const allAnalyses = getAnalyses();
    const refs = allAnalyses.filter((a) => project.analyses.includes(a.id));
    const sims = refs
      .filter((a) => a.transcript)
      .map((a) => ({
        title: a.videoTitle,
        rate: Math.round(calcSimilarity(project.generatedScript, a.transcript) * 100),
      }));
    setSimilarities(sims);
  }, [project.generatedScript, project.analyses]);

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!project.structureProposal) { setError("構成提案がありません"); return; }

    // 現在の台本を履歴に保存
    if (project.generatedScript) {
      setScriptHistory((prev) => [...prev, project.generatedScript]);
    }

    setGenerating(true);
    setError("");
    const preset = getPresetFor(project.genre, project.style, project.channelId);

    // 元ネタの分析データ（上位互換生成のため、超えるべき基準値として渡す）
    const referenceAnalyses = getAnalyses()
      .filter((a) => project.analyses?.includes(a.id))
      .map((a) => ({
        videoTitle: a.videoTitle,
        channelName: a.channelName,
        views: a.views,
        analysisResult: a.analysisResult,
      }));

    try {
      const res = await fetch("/api/script/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal: project.structureProposal,
          channelProfile: getProfileByChannel(project.channelId || ""),
          style: project.style,
          topic: project.title,
          additionalNotes: preset ? `【台本ルール】\n${preset.rules}\n\n【ベースプロンプト】\n${preset.prompt}\n\n【目標文字数】${preset.targetWordCount}文字\n\n【フックパターン】${preset.hookPattern}\n\n【CTAパターン】${preset.ctaPattern}` : "",
          rulesText: formatRulesForPrompt(buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId)),
          referenceAnalyses,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.script) { onUpdate({ ...project, generatedScript: data.script, status: "completed", scriptSegments: undefined, splitCount: 1 }); }
    } catch { setError("台本生成に失敗"); }
    finally { setGenerating(false); }
  };

  // 元ネタ分析の整形（分割生成・パートチェックで共用）
  const buildRefs = () => getAnalyses()
    .filter((a) => project.analyses?.includes(a.id))
    .map((a) => ({ videoTitle: a.videoTitle, channelName: a.channelName, views: a.views, analysisResult: a.analysisResult }));

  // 計画上の総パート数（骨組みと出力回数で決まる。逐次生成の途中でも一定）
  const plannedTotalParts = () => {
    const concept = project.structureProposal?.concept || "";
    const count = project.splitCount || splitCount;
    if (count <= 1 || !concept) return 1;
    return splitSkeletonText(concept, count).length;
  };

  // 分割出力：指定インデックスのパートだけを生成して返す（前パートを文脈に続きを書く）
  const generateSegmentText = async (index: number, previousScript: string, aiApiKey: string, count: number): Promise<string | null> => {
    const preset = getPresetFor(project.genre, project.style, project.channelId);
    const channelProfile = getProfileByChannel(project.channelId || "");
    const additionalNotes = preset ? `【台本ルール】\n${preset.rules}\n\n【ベースプロンプト】\n${preset.prompt}\n\n【目標文字数】${preset.targetWordCount}文字\n\n【フックパターン】${preset.hookPattern}\n\n【CTAパターン】${preset.ctaPattern}` : "";
    const rulesText = formatRulesForPrompt(buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId));
    const parts = splitSkeletonText(project.structureProposal?.concept || "", count);
    // 総目標文字数（プリセット）を、骨組みの各パートの分量比で重み付けして per-part に配分
    const totalTargetChars = preset?.targetWordCount || 5200;
    const totalLen = parts.reduce((s, p) => s + p.length, 0) || 1;
    const partTargetChars = Math.round(totalTargetChars * ((parts[index]?.length || 0) / totalLen));
    const res = await fetch("/api/script/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposal: project.structureProposal, channelProfile, style: project.style, topic: project.title,
        additionalNotes, rulesText, referenceAnalyses: buildRefs(), aiApiKey,
        segment: { index, total: parts.length, skeletonPart: parts[index], previousScript, partTargetChars, totalTargetChars },
      }),
    });
    const data = await res.json();
    if (data.error) { setError(`パート${index + 1}の生成に失敗: ${data.error}`); return null; }
    return (data.script || "").trim();
  };

  // 生成ボタン：単発、または分割の「パート1」を生成（分割は以降「次のパート」で続ける）
  const handleGenerateMain = async () => {
    if (splitCount <= 1) { handleGenerate(); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!project.structureProposal?.concept) { setError("構成提案（骨組み）がありません"); return; }
    if (project.generatedScript) setScriptHistory((prev) => [...prev, project.generatedScript]);
    setGenerating(true);
    setError("パート1を生成中...");
    try {
      const part = await generateSegmentText(0, "", aiApiKey, splitCount);
      if (part == null) return;
      onUpdate({ ...project, generatedScript: part, scriptSegments: [{ script: part }], splitCount, status: "completed" });
      setError("");
    } catch { setError("分割生成に失敗しました"); }
    finally { setGenerating(false); }
  };

  // 次のパートを生成（前パートまでを文脈に続きを書く）
  const handleGenerateNextSegment = async () => {
    const segs = project.scriptSegments || [];
    const count = project.splitCount || splitCount;
    const parts = splitSkeletonText(project.structureProposal?.concept || "", count);
    const index = segs.length;
    if (index >= parts.length) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setGenerating(true);
    setError(`パート${index + 1}/${parts.length}を生成中...`);
    try {
      const previousScript = segs.map((s) => s.script).join("\n\n");
      const part = await generateSegmentText(index, previousScript, aiApiKey, count);
      if (part == null) return;
      const newSegs = [...segs, { script: part }];
      const combined = newSegs.map((s) => s.script).join("\n\n");
      onUpdate({ ...project, scriptSegments: newSegs, generatedScript: combined, status: "completed" });
      setError("");
    } catch { setError("パート生成に失敗しました"); }
    finally { setGenerating(false); }
  };

  // パートごとの品質チェック（軽量・パート向け観点）
  const handleSegmentCheck = async (idx: number) => {
    const segs = project.scriptSegments;
    if (!segs || !segs[idx]) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setSegmentChecking(idx);
    setError("");
    try {
      const rulesText = formatRulesForPrompt(buildInjectedRules(project.genre as Genre, project.style as Style, project.channelId));
      const previousScript = segs.slice(0, idx).map((s) => s.script).join("\n\n");
      const body = JSON.stringify({
        segmentScript: segs[idx].script, partIndex: idx, partTotal: plannedTotalParts(),
        previousScript, referenceAnalyses: buildRefs(), rulesText, style: project.style, aiApiKey,
      });
      let data: Record<string, unknown> | null = null;
      let lastErr = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        let httpStatus = 0; let parseErr: string | null = null;
        try {
          const res = await fetch("/api/script/quality-check-segment", { method: "POST", headers: { "Content-Type": "application/json" }, body });
          httpStatus = res.status;
          const raw = await res.text();
          try { data = JSON.parse(raw); } catch { parseErr = raw.slice(0, 120) || "(空レスポンス)"; }
        } catch (e) { parseErr = `通信エラー: ${String(e).slice(0, 100)}`; }
        // JSONとして読めない場合のみ真のタイムアウトとしてリトライ。JSON付きのエラーはそのまま表示する。
        if (parseErr && !data) {
          lastErr = parseErr || `HTTP ${httpStatus}`;
          if (attempt < 3) { setError(`パート${idx + 1}チェック リトライ中... (${attempt + 1}/4)`); await new Promise((r) => setTimeout(r, 6000 * (attempt + 1))); continue; }
          setError(`パート${idx + 1}のチェックがタイムアウト: ${lastErr}`); return;
        }
        if (data && (data as { retryable?: boolean }).retryable) {
          if (attempt < 3) { setError(`AI混雑のためリトライ中... (${attempt + 1}/4)`); await new Promise((r) => setTimeout(r, 6000 * (attempt + 1))); continue; }
        }
        break;
      }
      if (!data) { setError(`パート${idx + 1}のチェックに失敗: ${lastErr}`); return; }
      if (data.error) { setError(data.error as string); return; }
      setError("");
      const result: QualityCheckResult = {
        categories: (data.categories as QualityCheckCategory[]) || [],
        overallScore: (data.overallScore as number) || 0,
        topPriority: (data.topPriority as string) || "",
        checkedAt: new Date().toISOString(),
        scriptHash: simpleHash(segs[idx].script),
      };
      const newSegs = segs.map((s, i) => (i === idx ? { ...s, qualityCheckResult: result } : s));
      onUpdate({ ...project, scriptSegments: newSegs });
      pushSharedSettings();
    } catch { setError(`パート${idx + 1}のチェックに失敗しました`); }
    finally { setSegmentChecking(null); }
  };

  // パートごとの修正（差分パッチ方式の revise を流用）。修正後はそのパートのチェック結果を破棄し結合台本を更新
  const handleSegmentRevise = async (idx: number) => {
    const segs = project.scriptSegments;
    if (!segs || !segs[idx]) return;
    const note = segmentReviseNote[idx];
    if (!note?.trim()) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setSegmentRevising(idx);
    setError("");
    try {
      const res = await fetch("/api/script/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: segs[idx].script, revisionNote: note, referenceAnalyses: buildRefs(), aiApiKey }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.script) {
        const revised = (data.script as string).split("---修正箇所---")[0].trim();
        const newSegs = segs.map((s, i) => (i === idx ? { script: revised } : s));
        const combined = newSegs.map((s) => s.script).join("\n\n");
        onUpdate({ ...project, scriptSegments: newSegs, generatedScript: combined });
        setSegmentReviseNote((p) => ({ ...p, [idx]: "" }));
      }
    } catch { setError(`パート${idx + 1}の修正に失敗しました`); }
    finally { setSegmentRevising(null); }
  };

  // パートのチェック指摘を、そのパートの修正指示欄に転記する
  const handleSegmentApplyFix = (idx: number) => {
    const qc = project.scriptSegments?.[idx]?.qualityCheckResult;
    if (!qc) return;
    const issues: string[] = [];
    qc.categories.forEach((cat, ci) => {
      cat.items.forEach((it, ii) => {
        // チェックを外した（excluded=true）指摘は転記しない。pass・suggestion無しも除外
        if (it.status !== "pass" && it.suggestion && !excludedFixes[`${idx}:${ci}:${ii}`]) {
          issues.push(`【${cat.name} - ${it.name}】\n  問題: ${it.comment}\n  修正案: ${it.suggestion}`);
        }
      });
    });
    if (issues.length === 0) { setError("転記する指摘が選択されていません（チェックを確認してください）"); return; }
    const note = `以下の指摘箇所「だけ」を最小差分で修正してください。\n\n【絶対ルール】\n・このリストに無い箇所は1文字たりとも変えないこと\n・指摘箇所以外の言い回し・並び順・改行は元のまま維持\n\n【修正すべき指摘】\n${issues.join("\n\n")}`;
    setSegmentReviseNote((p) => ({ ...p, [idx]: note }));
  };

  // 修正指示で台本を修正
  const handleRevise = async () => {
    if (!revisionNote.trim() || !project.generatedScript) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setScriptHistory((prev) => [...prev, project.generatedScript]);
    setRevising(true);
    setError("");

    // 元ネタの分析データ（修正時も基準値として渡す）
    const referenceAnalyses = getAnalyses()
      .filter((a) => project.analyses?.includes(a.id))
      .map((a) => ({
        videoTitle: a.videoTitle,
        analysisResult: a.analysisResult,
      }));

    try {
      const res = await fetch("/api/script/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: project.generatedScript, revisionNote, referenceAnalyses, aiApiKey }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.script) {
        // 修正箇所サマリーを分離
        const parts = data.script.split("---修正箇所---");
        const revisedScript = parts[0].trim();
        const summary = parts[1]?.trim() || "";
        onUpdate({ ...project, generatedScript: revisedScript });
        setRevisionSummary(summary);
        setRevisionNote("");
      }
    } catch { setError("修正に失敗"); }
    finally { setRevising(false); }
  };

  const handleRestoreHistory = (idx: number) => {
    if (project.generatedScript) {
      setScriptHistory((prev) => [...prev, project.generatedScript]);
    }
    onUpdate({ ...project, generatedScript: scriptHistory[idx] });
  };

  // 品質チェック実行
  const handleQualityCheck = async () => {
    if (!project.generatedScript) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setCheckingQuality(true);
    setError("");
    try {
      // 元ネタの分析データを取得
      const allAnalyses = getAnalyses();
      const referenceAnalyses = allAnalyses.filter((a) => project.analyses?.includes(a.id));
      const profile = getProfileByChannel(project.channelId || "");
      const preset = getPresetFor(project.genre as Genre, project.style as Style, project.channelId);
      const winningPatterns = getWinningPatternsByChannel(project.channelId || "");

      const body = JSON.stringify({
        script: project.generatedScript,
        title: project.title || "",
        profile, preset, winningPatterns,
        referenceAnalyses: referenceAnalyses.map((a) => ({
          videoTitle: a.videoTitle,
          views: a.views,
          analysisResult: a.analysisResult,
          transcript: a.transcript,
        })),
        aiApiKey,
      });

      // Railway proxy が "upstream error"(プレーンテキスト) を返すと res.json() が
      // 失敗するため、text() で受けて safe parse。upstream/5xx は自動リトライ。
      let data: Record<string, unknown> | null = null;
      let lastErr = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        let httpStatus = 0;
        let parseErr: string | null = null;
        try {
          const res = await fetch("/api/script/quality-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          httpStatus = res.status;
          const raw = await res.text();
          try { data = JSON.parse(raw); }
          catch { parseErr = raw.slice(0, 120) || "(空レスポンス)"; }
        } catch (e) {
          parseErr = `通信エラー: ${String(e).slice(0, 100)}`;
        }

        // パース失敗 or 5xx は upstream タイムアウト → リトライ
        if (parseErr || httpStatus >= 500) {
          lastErr = parseErr || `HTTP ${httpStatus}`;
          if (attempt < 3) {
            setError(`品質チェック リトライ中... (${attempt + 1}/4: ${lastErr})`);
            await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
            continue;
          }
          setError(`品質チェックがタイムアウトしました（4回失敗）: ${lastErr}`);
          return;
        }
        // retryable フラグ(APIの混雑)もリトライ
        if (data && (data as { retryable?: boolean }).retryable) {
          if (attempt < 3) {
            setError(`AI混雑のためリトライ中... (${attempt + 1}/4)`);
            await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
            continue;
          }
        }
        break;
      }

      if (!data) { setError(`品質チェックに失敗しました: ${lastErr}`); return; }
      if (data.error) { setError(data.error as string); return; }
      setError("");
      const result: QualityCheckResult = {
        categories: (data.categories as QualityCheckCategory[]) || [],
        comparison: (data.comparison as QualityComparisonRow[]) || [],
        overallScore: (data.overallScore as number) || 0,
        topPriority: (data.topPriority as string) || "",
        checkedAt: new Date().toISOString(),
        scriptHash: simpleHash(project.generatedScript),
      };
      onUpdate({ ...project, qualityCheckResult: result });
      setShowQualityDetail(true);
      pushSharedSettings();
    } catch {
      setError("品質チェックに失敗しました");
    } finally {
      setCheckingQuality(false);
    }
  };

  // 品質チェック結果を修正指示欄に流し込む（既存の修正フローを再利用）
  const handleApplyQualityFix = () => {
    const r = project.qualityCheckResult;
    if (!r) return;
    const issues: string[] = [];
    r.categories.forEach((cat, ci) => {
      cat.items.forEach((item, ii) => {
        // チェックを外した（excluded）指摘は転記しない
        if (item.status !== "pass" && item.suggestion && !mainExcludedFixes[`${ci}-${ii}`]) {
          issues.push(`【${cat.name} - ${item.name}】\n  問題: ${item.comment}\n  修正案: ${item.suggestion}`);
        }
      });
    });
    if (issues.length === 0) { setError("転記する指摘が選択されていません（チェックを確認してください）"); return; }
    // AIに「指摘箇所だけ最小差分で修正」と明確に指示
    // pass項目を全部列挙すると逆に冗長で AI が混乱するため、ルールだけ書いて任せる
    const note = `以下の指摘箇所「だけ」を最小差分で修正してください。\n\n` +
      `【絶対ルール】\n` +
      `・このリストに無い箇所は1文字たりとも変えないこと\n` +
      `・指摘箇所以外の言い回し・並び順・改行は元のまま維持\n` +
      `・修正前後の差分を最小化すること\n\n` +
      `【修正すべき指摘】\n${issues.join("\n\n")}`;
    setRevisionNote(note);
    // スクロールして修正指示欄を見せる
    setTimeout(() => {
      const el = document.querySelector("textarea[placeholder*=\"フック\"]") as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleConvertTelop = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey || !project.generatedScript) return;
    setConvertingTelop(true);
    try {
      const res = await fetch("/api/script/to-telop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: project.generatedScript, aiApiKey }),
      });
      const data = await res.json();
      if (data.telops) onUpdate({ ...project, telopScript: data.telops });
    } catch { setError("テロップ変換に失敗"); }
    finally { setConvertingTelop(false); }
  };

  const [thumbSuggestions, setThumbSuggestions] = useState<{ text: string; reason: string; source?: string }[]>([]);

  const handleSuggestThumbnail = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) return;
    setSuggestingThumb(true);
    try {
      // 競合の人気動画タイトルを取得
      const allAnalyses = getAnalyses();
      const refAnalyses = allAnalyses.filter((a) => project.analyses.includes(a.id));
      const competitorTitles = refAnalyses.map((a) => a.videoTitle);

      const res = await fetch("/api/script/thumbnail-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          hooks: project.structureProposal?.suggestedHooks,
          script: project.generatedScript?.substring(0, 500),
          competitorTitles,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setThumbSuggestions(data.suggestions);
        onUpdate({ ...project, thumbnailTexts: data.suggestions.map((s: { text: string }) => s.text) });
      }
    } catch { setError("サムネ提案に失敗"); }
    finally { setSuggestingThumb(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(project.generatedScript); };
  const handleSync = async () => {
    setSyncing(true);
    setSyncDone(false);
    try {
      const result = await pushSharedSettings();
      if (result.ok) {
        setSyncDone(true);
        setTimeout(() => setSyncDone(false), 3000);
      } else {
        setError(result.error || "同期に失敗しました");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "同期に失敗しました");
    }
    finally { setSyncing(false); }
  };
  const handleExport = () => {
    const header = `# ${project.title}\nジャンル: ${project.genre} / スタイル: ${project.style}\n作成日: ${new Date().toLocaleDateString("ja-JP")}\n\n---\n\n`;
    const blob = new Blob([header + project.generatedScript], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `台本-${project.title}-${new Date().toISOString().split("T")[0]}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const pureChars = project.generatedScript ? pureTextLength(project.generatedScript) : 0;
  const estimatedMinutes = Math.round(pureChars / CHARS_PER_MINUTE);
  const sections = project.generatedScript ? getSectionStats(project.generatedScript) : [];
  const totalSeconds = project.telopScript?.reduce((sum, t) => sum + t.displaySeconds, 0) || 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">⑥ 台本出力</h2>

      <ScriptProfileWarning channelId={project.channelId} />

      {!project.generatedScript && (
        <div className="text-center py-12">
          {/* 出力回数（分割）セレクタ */}
          <div className="mb-5">
            <p className="text-sm text-gray-500 mb-2">出力回数（分割数）</p>
            <div className="inline-flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setSplitCount(n)}
                  className={`w-12 h-10 rounded-lg text-sm font-medium border ${splitCount === n ? "bg-accent text-white border-accent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {n}回
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {splitCount === 1
                ? "一括で全文を生成します"
                : `骨組みを${splitCount}分割。まずパート1を生成し、品質チェック・修正してから「次のパート」を生成（前パートを引き継いで続きを書きます）`}
            </p>
          </div>
          <button onClick={handleGenerateMain} disabled={generating}
            className="px-8 py-4 rounded-xl bg-accent text-white text-lg font-medium hover:bg-accent/90 disabled:opacity-50">
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {splitCount > 1 ? "パート1を生成中..." : "台本を生成中..."}
              </span>
            ) : (splitCount > 1 ? `パート1を生成する（全${splitCount}分割）` : "台本を生成する")}
          </button>
        </div>
      )}

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {project.generatedScript && (
        <div className="space-y-6">

          {/* 統計バー */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl md:text-2xl font-bold">{pureChars}</p>
                <p className="text-xs text-gray-500">文字数（本文のみ）</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-bold">約{estimatedMinutes}分</p>
                <p className="text-xs text-gray-500">推定動画尺</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-bold">{sections.length}</p>
                <p className="text-xs text-gray-500">セクション数</p>
              </div>
              <div>
                <p className={`text-xl md:text-2xl font-bold ${similarities.every((s) => s.rate <= 25) ? "text-green-600" : "text-red-500"}`}>
                  {similarities.length > 0 ? (similarities.every((s) => s.rate <= 25) ? "安全" : "要確認") : "—"}
                </p>
                <p className="text-xs text-gray-500">一致率チェック</p>
              </div>
            </div>

            {/* セクション別文字数 */}
            {sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">セクション別文字数</p>
                <div className="flex gap-1 items-end h-16">
                  {sections.map((s, i) => {
                    const maxChars = Math.max(...sections.map((x) => x.chars), 1);
                    const height = Math.max((s.chars / maxChars) * 100, 5);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${s.name}: ${s.chars}文字`}>
                        <span className="text-[10px] text-gray-400">{s.chars}</span>
                        <div className="w-full bg-accent/70 rounded-t" style={{ height: `${height}%` }} />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">{s.name.substring(0, 6)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 一致率詳細 */}
            {similarities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">参考台本との一致率（25%以下が安全圏）</p>
                <div className="space-y-1.5">
                  {similarities.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 flex-1 truncate">{s.title}</span>
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.rate <= 25 ? "bg-green-500" : s.rate <= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(s.rate, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${s.rate <= 25 ? "text-green-600" : s.rate <= 40 ? "text-yellow-600" : "text-red-500"}`}>
                        {s.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 分割パート（パート1→チェック/修正→次のパート、と逐次に進める） */}
          {project.scriptSegments && project.scriptSegments.length >= 1 && (project.splitCount || 1) > 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">分割パート（{project.scriptSegments.length}/{plannedTotalParts()} 生成済み・各パートをチェック/修正してから次へ）</p>
              </div>
              {project.scriptSegments.map((seg, idx) => {
                const total = plannedTotalParts();
                const label = idx === 0 ? "前半" : idx === total - 1 ? "終盤" : "中盤";
                const qc = seg.qualityCheckResult;
                return (
                  <div key={idx} className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-semibold">パート{idx + 1}/{total}（{label}）<span className="text-xs text-gray-400 ml-2">{pureTextLength(seg.script)}文字</span></p>
                      <button onClick={() => handleSegmentCheck(idx)} disabled={segmentChecking === idx}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
                        {segmentChecking === idx ? "チェック中..." : qc ? "再チェック" : "🔍 品質チェック"}
                      </button>
                    </div>
                    <div className="p-3 relative">
                      {segmentRevising === idx && (
                        <div className="absolute inset-0 bg-white/80 rounded flex items-center justify-center z-10">
                          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <textarea value={seg.script}
                        onChange={(e) => {
                          const newSegs = project.scriptSegments!.map((s, i) => (i === idx ? { ...s, script: e.target.value } : s));
                          onUpdate({ ...project, scriptSegments: newSegs, generatedScript: newSegs.map((s) => s.script).join("\n\n") });
                        }}
                        rows={8} className="w-full text-sm leading-7 outline-none resize-y" />

                      {/* パートの品質チェック結果 */}
                      {qc && (
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold">パート品質 <span className="text-accent">{qc.overallScore}/10</span></p>
                          </div>
                          {qc.topPriority && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2">最優先: {qc.topPriority}</p>}
                          <div className="space-y-1.5">
                            {qc.categories.map((cat, ci) => (
                              <div key={ci}>
                                <p className="text-xs font-semibold text-gray-600">{cat.name}</p>
                                {cat.items.map((it, ii) => {
                                  const fixKey = `${idx}:${ci}:${ii}`;
                                  const checkable = it.status !== "pass" && !!it.suggestion;
                                  return (
                                    <div key={ii} className="flex gap-1.5 text-xs ml-2">
                                      {checkable ? (
                                        <input type="checkbox" checked={!excludedFixes[fixKey]}
                                          onChange={() => setExcludedFixes((p) => ({ ...p, [fixKey]: !p[fixKey] }))}
                                          className="mt-0.5 accent-accent cursor-pointer" title="この指摘を修正指示に含める" />
                                      ) : <span className="w-3 shrink-0" />}
                                      <span>{it.status === "pass" ? "🟢" : it.status === "warn" ? "🟡" : "🔴"}</span>
                                      <div className="flex-1">
                                        <span className="text-gray-700">{it.name}</span>
                                        {it.comment && <span className="text-gray-500"> — {it.comment}</span>}
                                        {it.status !== "pass" && it.suggestion && <p className="text-purple-700">→ {it.suggestion}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* パートの修正指示 */}
                      <div className="mt-3">
                        {qc && (
                          <button onClick={() => handleSegmentApplyFix(idx)}
                            className="mb-2 text-xs text-blue-600 hover:underline">✔ チェックした指摘を修正指示に転記</button>
                        )}
                        <textarea value={segmentReviseNote[idx] || ""}
                          onChange={(e) => setSegmentReviseNote((p) => ({ ...p, [idx]: e.target.value }))}
                          placeholder={`パート${idx + 1}への修正指示（このパートだけを差分修正します）`}
                          rows={8} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent resize-y leading-6" />
                        <div className="flex justify-end mt-2">
                          <button onClick={() => handleSegmentRevise(idx)} disabled={segmentRevising === idx || !segmentReviseNote[idx]?.trim()}
                            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                            {segmentRevising === idx ? "修正中..." : "このパートを修正"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 次のパートを生成（前パートを引き継ぐ） */}
              {project.scriptSegments.length < plannedTotalParts() && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm text-emerald-900">
                    パート{project.scriptSegments.length}までを確認・修正できました。次は<strong>パート{project.scriptSegments.length + 1}/{plannedTotalParts()}</strong>（{project.scriptSegments.length}までの続き）を生成します。
                  </p>
                  <button onClick={handleGenerateNextSegment} disabled={generating}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0">
                    {generating ? "生成中..." : `▶ 次のパートを生成`}
                  </button>
                </div>
              )}
              {project.scriptSegments.length >= plannedTotalParts() && (
                <p className="text-xs text-emerald-700">✅ 全パート生成済み。下の「台本本体」が結合した最終版です（全体の品質チェックもできます）。</p>
              )}
              <p className="text-xs text-gray-400">※ 下の「台本本体」は各パートを結合した最終版です（パートを編集すると自動で反映されます）。</p>
            </div>
          )}

          {/* 台本本体 */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 relative">
            {/* 修正中オーバーレイ */}
            {revising && (
              <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm font-medium text-accent">台本を修正中...</p>
                </div>
              </div>
            )}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">{project.title}</h3>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">コピー</button>
                <button onClick={handleExport} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">エクスポート</button>
                <button onClick={handleSync} disabled={syncing}
                  className={`px-3 py-1.5 rounded-lg text-xs ${syncDone ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600"} disabled:opacity-50`}>
                  {syncing ? "同期中..." : syncDone ? "同期済み" : "同期"}
                </button>
                <select value={splitCount} onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white" title="出力回数（分割数）">
                  <option value={1}>1回出力</option>
                  <option value={2}>2分割</option>
                  <option value={3}>3分割</option>
                </select>
                <button onClick={handleGenerateMain} disabled={generating} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">
                  {generating ? "生成中..." : "再生成"}
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea value={project.generatedScript}
                onChange={(e) => onUpdate({ ...project, generatedScript: e.target.value })}
                rows={20} className="w-full text-sm leading-7 outline-none resize-y" />
            </div>
          </div>

          {/* 全体の品質チェック（分割が未完了の間は混乱を避けるため隠す） */}
          {((project.splitCount || 1) <= 1 || (project.scriptSegments?.length || 0) >= plannedTotalParts()) ? (
            <QualityCheckPanel
              project={project}
              onUpdate={onUpdate}
              checking={checkingQuality}
              showDetail={showQualityDetail}
              onToggleDetail={() => setShowQualityDetail(!showQualityDetail)}
              onCheck={handleQualityCheck}
              onApplyFix={handleApplyQualityFix}
              currentScriptHash={simpleHash(project.generatedScript || "")}
              excludedFixes={mainExcludedFixes}
              onToggleExclude={(key) => setMainExcludedFixes((p) => ({ ...p, [key]: !p[key] }))}
            />
          ) : (
            <p className="text-xs text-gray-400">※ 全体の品質チェックは全パート生成後に表示されます（今は各パートごとのチェックを使ってください）。</p>
          )}

          {/* 修正指示欄 */}
          <div className={`bg-card-bg rounded-xl p-5 shadow-sm border ${revising ? "border-accent" : "border-accent/20"}`}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">修正指示</h3>
              {revising && (
                <span className="inline-flex items-center gap-1.5 text-xs text-accent font-medium">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  修正中...
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <textarea value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="例: 冒頭のフックをもっと強くして / CTAの部分を予祝形式に変えて / 文法を修正して"
                rows={8} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none resize-y leading-6" disabled={revising} />
              <button onClick={handleRevise} disabled={revising || !revisionNote.trim()}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0 self-end min-w-24">
                {revising ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    修正中
                  </span>
                ) : "修正する"}
              </button>
            </div>
          </div>

          {/* 修正箇所サマリー */}
          {revisionSummary && (
            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <h3 className="font-semibold text-sm text-green-800 mb-2">修正箇所</h3>
              <pre className="text-sm text-green-900 whitespace-pre-wrap font-sans leading-relaxed">{revisionSummary}</pre>
              <button onClick={() => setRevisionSummary("")} className="text-xs text-green-600 hover:underline mt-2">閉じる</button>
            </div>
          )}

          {/* 修正履歴 */}
          {scriptHistory.length > 0 && (
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                <svg className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                修正履歴（{scriptHistory.length}件）
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2">
                  {scriptHistory.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                      <span className="text-xs text-gray-500">バージョン{i + 1} · {pureTextLength(s)}文字</span>
                      <button onClick={() => handleRestoreHistory(i)} className="text-xs text-accent hover:underline">復元</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ツール */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* テロップ変換 */}
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">テロップ形式</h3>
                <button onClick={handleConvertTelop} disabled={convertingTelop}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {convertingTelop ? "変換中..." : "テロップに変換"}
                </button>
              </div>
              {project.telopScript && (
                <>
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                    <span>{project.telopScript.length}テロップ · 約{Math.floor(totalSeconds / 60)}分{totalSeconds % 60}秒</span>
                    <button onClick={() => { const t = project.telopScript!.map((x) => x.text).join("\n"); navigator.clipboard.writeText(t); }} className="text-accent hover:underline">コピー</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
                    {project.telopScript.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-gray-400 w-6 shrink-0 text-right">{t.displaySeconds}s</span>
                        <span className="text-gray-700">{t.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* サムネテキスト */}
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">サムネテキスト提案</h3>
                <button onClick={handleSuggestThumbnail} disabled={suggestingThumb}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {suggestingThumb ? "提案中..." : "提案する"}
                </button>
              </div>
              {thumbSuggestions.length > 0 && (
                <div className="space-y-2">
                  {thumbSuggestions.map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{s.text}</span>
                        <button onClick={() => navigator.clipboard.writeText(s.text)} className="text-xs text-accent hover:underline shrink-0 ml-2">コピー</button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                      {s.source && <p className="text-xs text-accent/70 mt-0.5">参考: {s.source}</p>}
                    </div>
                  ))}
                </div>
              )}
              {thumbSuggestions.length === 0 && project.thumbnailTexts.length > 0 && (
                <div className="space-y-2">
                  {project.thumbnailTexts.map((t, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{t}</span>
                      <button onClick={() => navigator.clipboard.writeText(t)} className="text-xs text-accent hover:underline shrink-0 ml-2">コピー</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6 items-start">
        <button onClick={() => onUpdate({ ...project, status: "proposal" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {/* 台本チェック依頼ワークフロー（台本生成済みの場合のみ） */}
        {!!project.generatedScript && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-xs text-gray-400">台本チェック</span>
            {(!project.scriptReviewStatus || project.scriptReviewStatus === "none") && (
              <button onClick={() => { onUpdate({ ...project, scriptReviewStatus: "pending" }); pushSharedSettings(); }}
                className="px-3 py-1.5 rounded-lg text-xs border border-blue-300 text-blue-600 hover:bg-blue-50">
                台本チェック依頼
              </button>
            )}
            {project.scriptReviewStatus === "pending" && (
              <>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">チェック待ち</span>
                <select
                  value="pending"
                  onChange={(e) => {
                    const val = e.target.value as "pending" | "approved" | "rejected" | "none";
                    const note = val === "rejected" ? prompt("差し戻し理由:") || "" : "";
                    onUpdate({ ...project, scriptReviewStatus: val, scriptReviewNote: note });
                    pushSharedSettings();
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                >
                  <option value="pending">チェック待ち</option>
                  <option value="approved">承認</option>
                  <option value="rejected">差し戻し</option>
                  <option value="none">取り消し</option>
                </select>
              </>
            )}
            {project.scriptReviewStatus === "approved" && (
              <>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">承認済み</span>
                <button onClick={() => { onUpdate({ ...project, scriptReviewStatus: "none", scriptReviewNote: "" }); pushSharedSettings(); }}
                  className="text-xs text-gray-400 hover:text-gray-600">リセット</button>
              </>
            )}
            {project.scriptReviewStatus === "rejected" && (
              <>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">差し戻し</span>
                {project.scriptReviewNote && <span className="text-xs text-red-500">{project.scriptReviewNote}</span>}
                <button onClick={() => { onUpdate({ ...project, scriptReviewStatus: "pending", scriptReviewNote: "" }); pushSharedSettings(); }}
                  className="px-2 py-1 rounded text-xs border border-blue-300 text-blue-600 hover:bg-blue-50">
                  再依頼
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityCheckPanel({
  project, onUpdate, checking, showDetail, onToggleDetail, onCheck, onApplyFix, currentScriptHash, excludedFixes, onToggleExclude,
}: {
  project: ScriptProject;
  onUpdate: (p: ScriptProject) => void;
  checking: boolean;
  showDetail: boolean;
  onToggleDetail: () => void;
  onCheck: () => void;
  onApplyFix: () => void;
  currentScriptHash: string;
  excludedFixes: Record<string, boolean>;
  onToggleExclude: (key: string) => void;
}) {
  const r = project.qualityCheckResult;
  const stale = r?.scriptHash && r.scriptHash !== currentScriptHash;
  const scoreColor = (s: number) =>
    s >= 8 ? "text-green-600" : s >= 6 ? "text-amber-600" : "text-red-600";
  const statusBadge = (status: QualityCheckItem["status"]) => {
    if (status === "pass") return <span className="text-green-600 shrink-0">✓</span>;
    if (status === "warn") return <span className="text-amber-600 shrink-0">⚠</span>;
    return <span className="text-red-600 shrink-0">✗</span>;
  };

  // 編集中のキー: "ci-ii" or "new-ci"
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<QualityCheckItem>({ name: "", status: "warn", comment: "", suggestion: "" });
  const [editingPriority, setEditingPriority] = useState(false);
  const [topPriorityDraft, setTopPriorityDraft] = useState("");

  // 結果を更新するヘルパー
  const updateResult = (next: QualityCheckResult) => {
    // categories の passed を items から再計算
    next.categories = next.categories.map((c) => ({
      ...c,
      passed: c.items.every((it) => it.status === "pass"),
    }));
    onUpdate({ ...project, qualityCheckResult: next });
  };

  const startEdit = (ci: number, ii: number) => {
    if (!r) return;
    const item = r.categories[ci].items[ii];
    setDraft({ ...item });
    setEditingKey(`${ci}-${ii}`);
  };
  const startAdd = (ci: number) => {
    setDraft({ name: "", status: "warn", comment: "", suggestion: "" });
    setEditingKey(`new-${ci}`);
  };
  const cancelEdit = () => {
    setEditingKey(null);
  };
  const saveEdit = () => {
    if (!r || !editingKey) return;
    if (!draft.name.trim() || !draft.comment.trim()) return;
    const next: QualityCheckResult = JSON.parse(JSON.stringify(r));
    if (editingKey.startsWith("new-")) {
      const ci = parseInt(editingKey.slice(4), 10);
      next.categories[ci].items.push({ ...draft, suggestion: draft.suggestion?.trim() || undefined });
    } else {
      const [ciStr, iiStr] = editingKey.split("-");
      const ci = parseInt(ciStr, 10);
      const ii = parseInt(iiStr, 10);
      next.categories[ci].items[ii] = { ...draft, suggestion: draft.suggestion?.trim() || undefined };
    }
    updateResult(next);
    setEditingKey(null);
  };
  const deleteItem = (ci: number, ii: number) => {
    if (!r) return;
    if (!confirm("この指摘を削除しますか？")) return;
    const next: QualityCheckResult = JSON.parse(JSON.stringify(r));
    next.categories[ci].items.splice(ii, 1);
    updateResult(next);
  };
  const startEditPriority = () => {
    setTopPriorityDraft(r?.topPriority || "");
    setEditingPriority(true);
  };
  const savePriority = () => {
    if (!r) return;
    updateResult({ ...r, topPriority: topPriorityDraft });
    setEditingPriority(false);
  };

  const editForm = () => (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input type="text" value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="項目名（例: 冒頭フックの強さ）"
          className="flex-1 min-w-32 px-2 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-accent" />
        <select value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as QualityCheckItem["status"] })}
          className="px-2 py-1.5 rounded border border-gray-200 text-sm outline-none">
          <option value="pass">✓ pass</option>
          <option value="warn">⚠ warn</option>
          <option value="fail">✗ fail</option>
        </select>
      </div>
      <textarea value={draft.comment} rows={2}
        onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
        placeholder="評価内容（該当箇所引用 等）"
        className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-accent" />
      <textarea value={draft.suggestion || ""} rows={2}
        onChange={(e) => setDraft({ ...draft, suggestion: e.target.value })}
        placeholder="改善案（warn/fail のとき記入）"
        className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-accent" />
      <div className="flex justify-end gap-2">
        <button onClick={cancelEdit}
          className="px-3 py-1 rounded text-xs border border-gray-200 hover:bg-gray-50">キャンセル</button>
        <button onClick={saveEdit}
          disabled={!draft.name.trim() || !draft.comment.trim()}
          className="px-3 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">保存</button>
      </div>
    </div>
  );

  return (
    <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-purple-200">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">品質チェック</h3>
          {r && (
            <span className={`text-sm font-bold ${scoreColor(r.overallScore)}`}>
              {r.overallScore.toFixed(1)} / 10
            </span>
          )}
          {r && stale && <span className="text-xs text-amber-600">※ 台本が変更されています。再チェックを推奨</span>}
          {checking && (
            <span className="inline-flex items-center gap-1.5 text-xs text-purple-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
              分析中...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {r && (
            <button onClick={onToggleDetail} className="text-xs text-gray-500 hover:text-gray-700">
              {showDetail ? "詳細を閉じる" : "詳細を見る"}
            </button>
          )}
          <button onClick={onCheck} disabled={checking}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {checking ? "チェック中..." : (r ? "再チェック" : "品質チェック実行")}
          </button>
        </div>
      </div>

      {!r && !checking && (
        <p className="text-sm text-gray-500">
          元ネタ要素の継承 / CTAロジック / LINE鑑定の強度 / 重複・矛盾 / マーケター総合 などの観点で台本を評価し、元ネタとの比較マトリクスを表示します。
        </p>
      )}

      {r && (
        <>
          {/* 最優先で直すべき */}
          <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-amber-700">最優先で直すべき</p>
              {!editingPriority && (
                <button onClick={startEditPriority}
                  className="text-xs text-amber-600 hover:text-amber-800">編集</button>
              )}
            </div>
            {editingPriority ? (
              <>
                <textarea value={topPriorityDraft} rows={2}
                  onChange={(e) => setTopPriorityDraft(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-amber-300 text-sm outline-none" />
                <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => setEditingPriority(false)}
                    className="px-3 py-1 rounded text-xs border border-gray-200 hover:bg-gray-50">キャンセル</button>
                  <button onClick={savePriority}
                    className="px-3 py-1 rounded text-xs bg-amber-600 text-white hover:bg-amber-700">保存</button>
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-900">{r.topPriority || "（未設定）"}</p>
            )}
          </div>

          {/* ===== サマリー（常時表示）: 8観点の信号機 + 要改善の比較行だけ ===== */}
          {/* 8観点バッジ横並び */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {r.categories.map((cat: QualityCheckCategory, ci: number) => {
              const worst = cat.items.some((it) => it.status === "fail")
                ? "fail" : cat.items.some((it) => it.status === "warn") ? "warn" : "pass";
              const icon = worst === "fail" ? "🔴" : worst === "warn" ? "🟡" : "🟢";
              // カテゴリ名から接頭辞(A. 等)を除いた短縮名
              const shortName = cat.name.replace(/^[A-H]\.\s*/, "");
              return (
                <button key={ci}
                  onClick={() => { if (!showDetail) onToggleDetail(); }}
                  title={shortName}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                    worst === "fail" ? "bg-red-50 border-red-200 text-red-700"
                    : worst === "warn" ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-green-50 border-green-200 text-green-700"
                  }`}>
                  <span>{icon}</span>
                  <span className="truncate max-w-[8rem]">{shortName}</span>
                </button>
              );
            })}
          </div>

          {/* 要改善の比較行だけ（⚠️/❌）を常時表示 */}
          {r.comparison && r.comparison.some((row) => row.verdict !== "good") && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5">
                改善が必要な要素（{r.comparison.filter((row) => row.verdict !== "good").length}件）
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {r.comparison.filter((row) => row.verdict !== "good").map((row: QualityComparisonRow, ri: number) => (
                      <tr key={ri} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{row.element}</td>
                        <td className="px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">元: {row.source}</td>
                        <td className="px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">生成: {row.generated}</td>
                        <td className="px-2 py-1.5">
                          <span className="whitespace-nowrap">
                            {row.verdict === "warn" ? "⚠️" : "❌"}{row.note ? ` ${row.note}` : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== 詳細（折りたたみ）: 比較マトリクス全行 + 8観点の各項目 ===== */}
          {showDetail && r.comparison && r.comparison.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">📊 元ネタ比較マトリクス（全{r.comparison.length}要素）</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="text-left px-2 py-1.5 border-b border-gray-200 font-medium">ハマり要素</th>
                      <th className="text-center px-2 py-1.5 border-b border-gray-200 font-medium">元ネタ</th>
                      <th className="text-center px-2 py-1.5 border-b border-gray-200 font-medium">生成台本</th>
                      <th className="text-left px-2 py-1.5 border-b border-gray-200 font-medium">評価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.comparison.map((row: QualityComparisonRow, ri: number) => (
                      <tr key={ri} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1.5 font-medium text-gray-700">{row.element}</td>
                        <td className="px-2 py-1.5 text-center text-gray-600">{row.source}</td>
                        <td className="px-2 py-1.5 text-center text-gray-600">{row.generated}</td>
                        <td className="px-2 py-1.5">
                          <span className="whitespace-nowrap">
                            {row.verdict === "good" ? "✅" : row.verdict === "warn" ? "⚠️" : "❌"}
                            {row.note ? ` ${row.note}` : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showDetail && r.categories.map((cat: QualityCheckCategory, ci: number) => (
            <div key={ci} className="mb-3 last:mb-0">
              <h4 className="text-sm font-semibold mb-1">
                {cat.passed ? "✅" : "⚠️"} {cat.name}
              </h4>
              <div className="space-y-1.5 ml-1">
                {cat.items.map((item: QualityCheckItem, ii: number) => {
                  const key = `${ci}-${ii}`;
                  if (editingKey === key) {
                    return <div key={ii}>{editForm()}</div>;
                  }
                  const checkable = item.status !== "pass" && !!item.suggestion;
                  return (
                    <div key={ii} className="group flex items-start gap-2 text-sm">
                      {checkable ? (
                        <input type="checkbox" checked={!excludedFixes[key]}
                          onChange={() => onToggleExclude(key)}
                          className="mt-1 accent-purple-600 cursor-pointer shrink-0" title="この指摘を修正指示に含める" />
                      ) : <span className="w-3 shrink-0" />}
                      {statusBadge(item.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.comment}</p>
                        {item.suggestion && item.status !== "pass" && (
                          <p className="text-xs text-blue-700 mt-0.5">→ {item.suggestion}</p>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(ci, ii)}
                          className="text-xs text-gray-500 hover:text-gray-800 px-1.5 py-0.5 rounded hover:bg-gray-100">編集</button>
                        <button onClick={() => deleteItem(ci, ii)}
                          className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-gray-100">×</button>
                      </div>
                    </div>
                  );
                })}
                {/* 新規追加フォーム */}
                {editingKey === `new-${ci}` && editForm()}
                {/* 追加ボタン */}
                {editingKey !== `new-${ci}` && (
                  <button onClick={() => startAdd(ci)}
                    className="text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded">
                    + 指摘を追加
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
            <button onClick={onApplyFix}
              className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200">
              ✔ チェックした指摘を修正指示に転記
            </button>
            <span className="text-xs text-gray-400">※ チェックを外した指摘は転記されません（デフォルトは全てON）</span>
          </div>
        </>
      )}
    </div>
  );
}

function ScriptProfileWarning({ channelId }: { channelId?: string }) {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const profile = getProfileByChannel(channelId || "");
    const missing: string[] = [];
    if (!profile.channelName) missing.push("チャンネル名");
    if (!profile.concept) missing.push("コンセプト");
    if (!profile.tone) missing.push("口調");
    setWarn(missing.length > 0 ? `未設定: ${missing.join(" / ")}` : null);
  }, [channelId]);
  if (!warn) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
      <span>⚠️</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">自チャンネルプロフィール {warn}</p>
        <p className="text-xs text-amber-700 mt-0.5">未設定のままだと、AIが参考動画の人物像をコピーしてしまうことがあります。</p>
        <a href="/analysis?tab=profile" className="inline-block mt-1 text-xs text-amber-700 underline hover:text-amber-900">
          → 自チャンネル設計を開く
        </a>
      </div>
    </div>
  );
}
