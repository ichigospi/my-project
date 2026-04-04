// X投稿の安全チェックシステム

import {
  getXSafetyConfig,
  getXPosts,
  getTodayPostCount,
  getLastPostTime,
} from "./x-store";

export interface SafetyCheckResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

// テキスト間の簡易類似度（Jaccard係数ベース）
function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.replace(/\s+/g, "").split(""));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// URL含有チェック
function containsUrl(text: string): boolean {
  return /https?:\/\/\S+/.test(text);
}

// 今日のリンク付き投稿数
function getTodayLinkPostCount(): number {
  const posts = getXPosts();
  const today = new Date().toISOString().slice(0, 10);
  return posts.filter(
    (p) =>
      p.status === "posted" &&
      p.postedAt &&
      p.postedAt.slice(0, 10) === today &&
      containsUrl(p.content)
  ).length;
}

/**
 * 投稿前の安全チェック（5項目）
 */
export function runSafetyCheck(content: string): SafetyCheckResult {
  const config = getXSafetyConfig();
  const checks: SafetyCheckResult["checks"] = [];

  // 1. 日次投稿上限チェック
  const todayCount = getTodayPostCount();
  checks.push({
    name: "日次投稿上限",
    passed: todayCount < config.maxDailyPosts,
    message:
      todayCount < config.maxDailyPosts
        ? `本日 ${todayCount}/${config.maxDailyPosts} 件（残り${config.maxDailyPosts - todayCount}件）`
        : `本日の上限 ${config.maxDailyPosts} 件に達しています`,
  });

  // 2. 投稿間隔チェック
  const lastPost = getLastPostTime();
  const now = new Date();
  const minutesSinceLast = lastPost
    ? (now.getTime() - lastPost.getTime()) / (1000 * 60)
    : Infinity;
  checks.push({
    name: "投稿間隔",
    passed: minutesSinceLast >= config.minIntervalMinutes,
    message:
      minutesSinceLast >= config.minIntervalMinutes
        ? lastPost
          ? `前回投稿から${Math.floor(minutesSinceLast)}分経過（最低${config.minIntervalMinutes}分）`
          : "本日の投稿はまだありません"
        : `前回投稿から${Math.floor(minutesSinceLast)}分（最低${config.minIntervalMinutes}分必要）`,
  });

  // 3. 重複コンテンツチェック
  const recentPosts = getXPosts()
    .filter((p) => p.status === "posted")
    .slice(0, 50);
  const maxSimilarity = recentPosts.reduce(
    (max, p) => Math.max(max, textSimilarity(content, p.content)),
    0
  );
  checks.push({
    name: "重複チェック",
    passed: maxSimilarity < config.similarityThreshold,
    message:
      maxSimilarity < config.similarityThreshold
        ? `最大類似度 ${(maxSimilarity * 100).toFixed(0)}%（閾値${(config.similarityThreshold * 100).toFixed(0)}%）`
        : `類似投稿を検出（${(maxSimilarity * 100).toFixed(0)}%類似 / 閾値${(config.similarityThreshold * 100).toFixed(0)}%）`,
  });

  // 4. リンク付き投稿の比率チェック
  const hasLink = containsUrl(content);
  const todayLinkCount = getTodayLinkPostCount();
  checks.push({
    name: "リンク比率",
    passed: !hasLink || todayLinkCount < config.maxDailyLinks,
    message: !hasLink
      ? "リンクなし投稿"
      : todayLinkCount < config.maxDailyLinks
        ? `リンク付き投稿 ${todayLinkCount}/${config.maxDailyLinks} 件`
        : `リンク付き投稿の上限 ${config.maxDailyLinks} 件に達しています`,
  });

  // 5. コンテンツ長チェック
  const contentLength = content.trim().length;
  const tooShort = contentLength < 10;
  const tooLong = contentLength > 280;
  checks.push({
    name: "文字数チェック",
    passed: !tooShort && !tooLong,
    message: tooShort
      ? `${contentLength}文字（10文字以上必要）`
      : tooLong
        ? `${contentLength}文字（280文字以内にしてください）`
        : `${contentLength}/280文字`,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * スパムパターン検出
 */
export function detectSpamPatterns(content: string): string[] {
  const warnings: string[] = [];

  // 過剰なハッシュタグ
  const hashtagCount = (content.match(/#\S+/g) || []).length;
  if (hashtagCount > 5) {
    warnings.push(`ハッシュタグが${hashtagCount}個（5個以下推奨）`);
  }

  // 過剰なメンション
  const mentionCount = (content.match(/@\S+/g) || []).length;
  if (mentionCount > 3) {
    warnings.push(`メンションが${mentionCount}個（3個以下推奨）`);
  }

  // 全角大文字の過度な使用（煽り検知）
  const exclamationCount = (content.match(/[！!]{2,}/g) || []).length;
  if (exclamationCount > 2) {
    warnings.push("感嘆符の連続使用が多い（スパム判定リスク）");
  }

  return warnings;
}
