// X投稿の安全チェックシステム

import { getXSafetyConfig, getXPosts, getTodayPostCount, getLastPostTime } from "./x-store";

export interface SafetyCheckResult {
  passed: boolean;
  checks: { name: string; passed: boolean; message: string }[];
}

function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.replace(/\s+/g, "").split(""));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function containsUrl(text: string): boolean {
  return /https?:\/\/\S+/.test(text);
}

function getTodayLinkPostCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  return getXPosts().filter(
    (p) => p.status === "posted" && p.postedAt && p.postedAt.slice(0, 10) === today && containsUrl(p.content)
  ).length;
}

export function runSafetyCheck(content: string): SafetyCheckResult {
  const config = getXSafetyConfig();
  const checks: SafetyCheckResult["checks"] = [];

  // 1. 日次投稿上限
  const todayCount = getTodayPostCount();
  checks.push({
    name: "日次投稿上限",
    passed: todayCount < config.maxDailyPosts,
    message: todayCount < config.maxDailyPosts
      ? `本日 ${todayCount}/${config.maxDailyPosts} 件（残り${config.maxDailyPosts - todayCount}件）`
      : `本日の上限 ${config.maxDailyPosts} 件に達しています`,
  });

  // 2. 投稿間隔
  const lastPost = getLastPostTime();
  const minutesSinceLast = lastPost ? (Date.now() - lastPost.getTime()) / 60000 : Infinity;
  checks.push({
    name: "投稿間隔",
    passed: minutesSinceLast >= config.minIntervalMinutes,
    message: minutesSinceLast >= config.minIntervalMinutes
      ? lastPost ? `前回から${Math.floor(minutesSinceLast)}分経過` : "本日の投稿はまだありません"
      : `前回から${Math.floor(minutesSinceLast)}分（最低${config.minIntervalMinutes}分必要）`,
  });

  // 3. 重複コンテンツ
  const recentPosts = getXPosts().filter((p) => p.status === "posted").slice(0, 50);
  const maxSim = recentPosts.reduce((max, p) => Math.max(max, textSimilarity(content, p.content)), 0);
  checks.push({
    name: "重複チェック",
    passed: maxSim < config.similarityThreshold,
    message: maxSim < config.similarityThreshold
      ? `最大類似度 ${(maxSim * 100).toFixed(0)}%`
      : `類似投稿検出（${(maxSim * 100).toFixed(0)}%類似）`,
  });

  // 4. リンク比率
  const hasLink = containsUrl(content);
  const todayLinks = getTodayLinkPostCount();
  checks.push({
    name: "リンク比率",
    passed: !hasLink || todayLinks < config.maxDailyLinks,
    message: !hasLink ? "リンクなし" : todayLinks < config.maxDailyLinks
      ? `リンク付き ${todayLinks}/${config.maxDailyLinks} 件`
      : `リンク付き上限 ${config.maxDailyLinks} 件に達しています`,
  });

  // 5. 文字数
  const len = content.trim().length;
  checks.push({
    name: "文字数",
    passed: len >= 10 && len <= 280,
    message: len < 10 ? `${len}文字（10文字以上必要）` : len > 280 ? `${len}文字（280文字以内）` : `${len}/280文字`,
  });

  return { passed: checks.every((c) => c.passed), checks };
}

export function detectSpamPatterns(content: string): string[] {
  const warnings: string[] = [];
  const hashtagCount = (content.match(/#\S+/g) || []).length;
  if (hashtagCount > 5) warnings.push(`ハッシュタグが${hashtagCount}個（5個以下推奨）`);
  const mentionCount = (content.match(/@\S+/g) || []).length;
  if (mentionCount > 3) warnings.push(`メンションが${mentionCount}個（3個以下推奨）`);
  if ((content.match(/[！!]{2,}/g) || []).length > 2) warnings.push("感嘆符の連続使用が多い");
  return warnings;
}
