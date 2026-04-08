// AIプロンプトに自動注入するルールを構築するヘルパー
import { getProfile, getAnalyses, type ChannelProfile } from "./script-analysis-store";
import { getPresetFor, type Genre, type Style } from "./project-store";
import { getWinningPatterns } from "./winning-patterns-store";

export interface InjectedRules {
  channelContext: string;
  commonRules: string;
  categoryRules: string;
  ngExpressions: string;
  referenceExamples: string;
  winningPatterns: string;
}

export function buildInjectedRules(genre?: Genre, style?: Style): InjectedRules {
  const profile = getProfile();
  const preset = genre && style ? getPresetFor(genre, style) : undefined;

  const channelContext = buildChannelContext(profile);
  const commonRules = profile.commonRules?.trim() || "";
  const ngExpressions = profile.ngExpressions?.trim() || "";
  const categoryRules = preset ? `${preset.rules}\n\nフックパターン: ${preset.hookPattern}\nCTAパターン: ${preset.ctaPattern}` : "";
  const referenceExamples = buildReferenceExamples(profile);
  const winningPatterns = buildWinningPatterns();

  return { channelContext, commonRules, categoryRules, ngExpressions, referenceExamples, winningPatterns };
}

function buildChannelContext(profile: ChannelProfile): string {
  if (!profile.channelName) return "";
  const parts = [`チャンネル名: ${profile.channelName}`];
  if (profile.concept) parts.push(`コンセプト: ${profile.concept}`);
  if (profile.tone) parts.push(`口調: ${profile.tone}`);
  if (profile.target) parts.push(`ターゲット: ${profile.target}`);
  if (profile.characteristics) parts.push(`特徴: ${profile.characteristics}`);
  return parts.join("\n");
}

function buildReferenceExamples(profile: ChannelProfile): string {
  const ids = profile.referenceAnalysisIds || [];
  if (ids.length === 0) return "";
  const analyses = getAnalyses().filter((a) => ids.includes(a.id));
  if (analyses.length === 0) return "";

  return analyses.map((a) => {
    const r = a.analysisResult;
    return `【お手本】「${a.videoTitle}」（${a.channelName}）
概要: ${r?.summary || ""}
構成: ${r?.overallPattern || ""}
フック: ${r?.hooks?.join(" / ") || ""}
CTA: ${r?.ctas?.join(" / ") || ""}`;
  }).join("\n\n");
}

function buildWinningPatterns(): string {
  const wp = getWinningPatterns();
  if (!wp) return "";

  const lines: string[] = [];
  if (wp.bestStructure) lines.push(`- 最も再生された構成: ${wp.bestStructure}`);
  if (wp.bestHookPattern) lines.push(`- 効果的なフック: ${wp.bestHookPattern}`);
  if (wp.bestDuration) lines.push(`- 最適な動画長: ${wp.bestDuration}`);
  if (wp.avoidPatterns?.length) lines.push(`- 避けるべき: ${wp.avoidPatterns.join("、")}`);
  if (wp.hookEffectiveness) lines.push(`- フック傾向: ${wp.hookEffectiveness}`);
  if (wp.ctaEffectiveness) lines.push(`- CTA傾向: ${wp.ctaEffectiveness}`);
  if (wp.topPerformers?.length) {
    lines.push(`- お手本動画: ${wp.topPerformers.map((t) => `「${t.title}」(${t.views?.toLocaleString()}再生)`).join("、")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

// AIプロンプトに挿入するテキストブロックを生成
export function formatRulesForPrompt(rules: InjectedRules): string {
  const sections: string[] = [];

  if (rules.channelContext) {
    sections.push(`【自チャンネル情報】\n${rules.channelContext}`);
  }
  if (rules.commonRules) {
    sections.push(`【チャンネル共通ルール（必ず守ること）】\n${rules.commonRules}`);
  }
  if (rules.ngExpressions) {
    sections.push(`【NG表現（使用禁止）】\n${rules.ngExpressions}`);
  }
  if (rules.categoryRules) {
    sections.push(`【カテゴリ別ルール】\n${rules.categoryRules}`);
  }
  if (rules.referenceExamples) {
    sections.push(`【お手本台本（参考にすべきパターン）】\n${rules.referenceExamples}`);
  }
  if (rules.winningPatterns) {
    sections.push(`【実績データに基づく勝ちパターン（このチャンネルの成功法則）】\n${rules.winningPatterns}`);
  }

  return sections.length > 0 ? "\n\n" + sections.join("\n\n") + "\n" : "";
}
