// AIプロンプトに自動注入するルールを構築するヘルパー
import { getProfile, getProfileByChannel, getAnalyses, type ChannelProfile } from "./script-analysis-store";
import { getPresetFor, type Genre, type Style } from "./project-store";
import { getWinningPatternsByChannel } from "./winning-patterns-store";

export interface InjectedRules {
  channelContext: string;
  commonRules: string;
  categoryRules: string;
  ngExpressions: string;
  referenceExamples: string;
  winningPatterns: string;
}

// チャンネル固有の語彙ルール。設計データの同期状態に依存せず、コード側で必ず注入する。
// 対象チャンネルの判定は語り手プロフィールのチャンネル名で行う。
export function channelVocabRules(profile: ChannelProfile): string {
  if ((profile.channelName || "").includes("きん婆")) {
    return `【きん婆固有の語彙ルール（必達）】
- エネルギーの流れは「気脈」とは絶対に書かない。必ず「氣流」と書く
  （例:「氣流が詰まって邪気が発生しとる」「氣流が整うて、金運が流れ込みはじめる」）
- 白蛇様の「加護」「ご加護」とは言わない。必ず「神氣」と書く
  （例:「白蛇様の神氣に包まれとる」「白蛇様の神氣を受け取りよし」）
- この2語（氣流・神氣）はきん婆の世界観の核となる独自用語。台本全体で一貫して使うこと`;
  }
  return "";
}

// プロフィールの共通ルールに語彙ルールを合成して返す（品質チェックへ渡す用）
export function withChannelVocabRules(profile: ChannelProfile): ChannelProfile {
  const vocab = channelVocabRules(profile);
  if (!vocab) return profile;
  return { ...profile, commonRules: [profile.commonRules?.trim(), vocab].filter(Boolean).join("\n\n") };
}

export function buildInjectedRules(genre?: Genre, style?: Style, channelId?: string): InjectedRules {
  // チャンネル指定があれば必ずそのチャンネルの設計を使う。
  // 旧実装は常に単一プロフィール(getProfile=旧チャンネルの設計)を読んでいたため、
  // 別チャンネルの共通ルール・NG表現・世界観（アリサ等）が全チャンネルの生成に混入していた。
  const profile = channelId ? getProfileByChannel(channelId) : getProfile();
  const preset = genre && style ? getPresetFor(genre, style, channelId) : undefined;

  const channelContext = buildChannelContext(profile);
  const commonRules = [profile.commonRules?.trim(), channelVocabRules(profile)].filter(Boolean).join("\n\n");
  const ngExpressions = profile.ngExpressions?.trim() || "";
  const categoryRules = preset ? `${preset.rules}\n\nフックパターン: ${preset.hookPattern}\nCTAパターン: ${preset.ctaPattern}` : "";
  const referenceExamples = buildReferenceExamples(profile);
  const winningPatterns = buildWinningPatterns(channelId || "");

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

function buildWinningPatterns(channelId: string): string {
  const wp = getWinningPatternsByChannel(channelId);
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
