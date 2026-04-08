// 勝ちパターン自動学習ストア

const WINNING_PATTERNS_KEY = "fortune_yt_winning_patterns";

export interface WinningPatterns {
  updatedAt: string;
  videoCount: number;       // 分析対象の動画数
  bestHookPattern: string;  // 最も効果的なフックパターン
  bestStructure: string;    // 最も再生された構成パターン
  bestDuration: string;     // 最適な動画長
  bestPostTime: string;     // 最適な投稿タイミング
  avoidPatterns: string[];  // 避けるべきパターン
  topPerformers: { title: string; views: number; pattern: string }[]; // 高パフォーマンス動画
  hookEffectiveness: string;   // フック効果の傾向
  ctaEffectiveness: string;    // CTA効果の傾向
  audienceInsights: string;    // 視聴者インサイト
  rawAnalysis: string;         // AI分析の生テキスト
}

export function getWinningPatterns(): WinningPatterns | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(WINNING_PATTERNS_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function saveWinningPatterns(patterns: WinningPatterns) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WINNING_PATTERNS_KEY, JSON.stringify(patterns));
}
