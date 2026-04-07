// AIプロンプトに自動注入するルールを構築するヘルパー
import { getProfile, getAnalyses, type ChannelProfile } from "./script-analysis-store";
import { getPresetFor, type Genre, type Style } from "./project-store";

export interface InjectedRules {
  channelContext: string;  // チャンネル情報
  commonRules: string;     // 共通ルール
  categoryRules: string;   // カテゴリ別ルール
  ngExpressions: string;   // NG表現
  referenceExamples: string; // お手本台本の要約
}

export function buildInjectedRules(genre?: Genre, style?: Style): InjectedRules {
  const profile = getProfile();
  const preset = genre && style ? getPresetFor(genre, style) : undefined;

  const channelContext = buildChannelContext(profile);
  const commonRules = profile.commonRules?.trim() || "";
  const ngExpressions = profile.ngExpressions?.trim() || "";
  const categoryRules = preset ? `${preset.rules}\n\nフックパターン: ${preset.hookPattern}\nCTAパターン: ${preset.ctaPattern}` : "";
  const referenceExamples = buildReferenceExamples(profile);

  return { channelContext, commonRules, categoryRules, ngExpressions, referenceExamples };
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

  return sections.length > 0 ? "\n\n" + sections.join("\n\n") + "\n" : "";
}
