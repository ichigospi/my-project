// 勝ちパターン自動学習ストア（チャンネル別）

const WINNING_PATTERNS_KEY = "fortune_yt_winning_patterns";           // 旧singleton
const WINNING_PATTERNS_LIST_KEY = "fortune_yt_winning_patterns_list"; // 新list

export interface WinningPatterns {
  channelId?: string;       // 紐付くMyChannel.id
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

// 一覧取得（旧singletonがあれば自動でlistに移行）
export function getWinningPatternsList(): WinningPatterns[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(WINNING_PATTERNS_LIST_KEY);
  if (stored) return JSON.parse(stored);
  // 移行: 旧singletonを最初のMyChannelに紐付け
  const old = localStorage.getItem(WINNING_PATTERNS_KEY);
  if (old) {
    const oldData: WinningPatterns = JSON.parse(old);
    const myChannels = JSON.parse(localStorage.getItem("fortune_yt_my_channels") || "[]");
    const firstChId = myChannels[0]?.id || "";
    const list: WinningPatterns[] = [{ ...oldData, channelId: firstChId }];
    localStorage.setItem(WINNING_PATTERNS_LIST_KEY, JSON.stringify(list));
    return list;
  }
  return [];
}

// 内部チャンネルIDで取得
export function getWinningPatternsByChannel(channelId: string): WinningPatterns | null {
  const list = getWinningPatternsList();
  return (
    list.find((p) => p.channelId === channelId) ||
    (channelId ? null : list.find((p) => !p.channelId)) ||
    null
  );
}

// 保存（channelIdをキーにupsert）
export function saveWinningPatternsByChannel(patterns: WinningPatterns) {
  if (typeof window === "undefined") return;
  const list = getWinningPatternsList();
  const idx = list.findIndex((p) => (p.channelId || "") === (patterns.channelId || ""));
  if (idx >= 0) list[idx] = patterns;
  else list.push(patterns);
  localStorage.setItem(WINNING_PATTERNS_LIST_KEY, JSON.stringify(list));
}

// 後方互換: 旧API
export function getWinningPatterns(): WinningPatterns | null {
  return getWinningPatternsList()[0] || null;
}

export function saveWinningPatterns(patterns: WinningPatterns) {
  saveWinningPatternsByChannel(patterns);
}
