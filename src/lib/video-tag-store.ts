// 動画検索のジャンルタグ（種別: タロット/その他、テーマ: 金運/総合/恋愛）
// - ルール判定はここで都度計算（チャンネル名・タイトルのキーワード）
// - AI判定・手動修正の結果は /api/video-tags（AppSetting）に共有保存し、全端末で使い回す

export type VideoType = "tarot" | "other";
export type VideoTheme = "money" | "general" | "love";

export interface VideoTag {
  type?: VideoType;
  theme?: VideoTheme;
  source: "ai" | "manual";
  judgedAt: string;
}

const CACHE_KEY = "fortune_yt_video_tags";

// ===== ルール判定 =====

const TAROT_CHANNEL_RE = /タロット|tarot/i;
const TAROT_TITLE_RE = /タロット|オラクル|カードリーディング|ルノルマン/i;

export function classifyTypeByRule(channelName: string, title: string): VideoType | undefined {
  if (TAROT_CHANNEL_RE.test(channelName || "")) return "tarot";
  if (TAROT_TITLE_RE.test(title || "")) return "tarot";
  return undefined; // ルールでは「タロットでない」とは断定しない（AI/手動に委ねる）
}

const MONEY_RE = /金運|お金|金欠|臨時収入|宝くじ|高額当選|財運|大金|億万|万円|豊かさ|収入|借金|貯金/;
const LOVE_RE = /恋愛|恋人|復縁|ツインレイ|ソウルメイト|運命の人|片思い|片想い|両思い|両想い|告白|結婚|彼氏|彼女|あの人|意中/;

// どちらか一方のワードだけ → そのテーマ / 両方書いてある → 総合 / どちらも無い → 総合
export function classifyThemeByRule(title: string): VideoTheme {
  const money = MONEY_RE.test(title || "");
  const love = LOVE_RE.test(title || "");
  if (money && love) return "general";
  if (money) return "money";
  if (love) return "love";
  return "general";
}

// ===== 保存済みタグ（AI/手動）のローカルキャッシュ＋サーバー共有 =====

export function getCachedTags(): Record<string, VideoTag> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setCachedTags(tags: Record<string, VideoTag>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(tags)); } catch { /* ignore */ }
}

// サーバーから取得してローカルへマージ（manual優先・judgedAt新しい方優先）
export async function pullVideoTags(): Promise<Record<string, VideoTag>> {
  try {
    const res = await fetch("/api/video-tags");
    if (!res.ok) return getCachedTags();
    const data = await res.json();
    const server = (data.tags || {}) as Record<string, VideoTag>;
    const local = getCachedTags();
    const merged: Record<string, VideoTag> = { ...local };
    for (const [id, tag] of Object.entries(server)) {
      const prev = merged[id];
      if (!prev) { merged[id] = tag; continue; }
      if (prev.source === "manual" && tag.source !== "manual") continue;
      if (tag.source === "manual" && prev.source !== "manual") { merged[id] = tag; continue; }
      if ((tag.judgedAt || "") >= (prev.judgedAt || "")) merged[id] = tag;
    }
    setCachedTags(merged);
    return merged;
  } catch {
    return getCachedTags();
  }
}

// 指定タグをローカルに保存し、サーバーへも送る（送信分だけの差分push）
export async function saveVideoTags(patch: Record<string, VideoTag>): Promise<void> {
  const merged = { ...getCachedTags(), ...patch };
  setCachedTags(merged);
  try {
    await fetch("/api/video-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: patch }),
    });
  } catch { /* オフライン時はローカルのみ。次回pullで解消 */ }
}

// ===== 実効タグの解決（手動 > AI > ルール） =====

export function resolveType(tag: VideoTag | undefined, channelName: string, title: string): VideoType {
  if (tag?.type) return tag.type;
  return classifyTypeByRule(channelName, title) || "other";
}

export function resolveTheme(tag: VideoTag | undefined, title: string): VideoTheme {
  if (tag?.theme) return tag.theme;
  return classifyThemeByRule(title);
}
