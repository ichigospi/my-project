// ジャンルナレッジ: 分析済みの元台本から抽出した「ジャンル別の勝ち筋」。
// プリセット本体には書き込まず、生成時にカテゴリ別ルールの直後へ参考情報として注入する。
// 全端末共有（サーバー同期対象）。
import type { Genre } from "./project-store";

export interface GenreKnowledge {
  content: string;
  updatedAt: string;
}

const KEY = "fortune_yt_genre_knowledge";

export function getGenreKnowledgeMap(): Partial<Record<Genre, GenreKnowledge>> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function saveGenreKnowledgeMap(map: Partial<Record<Genre, GenreKnowledge>>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function setGenreKnowledge(genre: Genre, content: string) {
  const map = getGenreKnowledgeMap();
  map[genre] = { content, updatedAt: new Date().toISOString() };
  saveGenreKnowledgeMap(map);
}

// サーバーpull時のマージ（ジャンルごとにupdatedAtが新しい方を採用）
export function mergeGenreKnowledge(server: Partial<Record<Genre, GenreKnowledge>>) {
  const map = getGenreKnowledgeMap();
  for (const [g, v] of Object.entries(server || {}) as [Genre, GenreKnowledge][]) {
    if (!v?.content && v?.content !== "") continue;
    const local = map[g];
    if (!local || (v.updatedAt || "") > (local.updatedAt || "")) map[g] = v;
  }
  saveGenreKnowledgeMap(map);
}

// 生成プロンプトへの注入ブロック（ルール優先・メタファー単一のガード付き）
export function buildGenreKnowledgeBlock(genre?: Genre): string {
  if (!genre) return "";
  const k = getGenreKnowledgeMap()[genre];
  if (!k?.content?.trim()) return "";
  return `\n\n【ジャンルナレッジ（実績台本からの学習・参考情報）】
※位置づけ: カテゴリ別ルール・チャンネルルールが最優先。矛盾する場合はルールに従う
※「中心メタファー候補」から使ってよいのは1本の台本につき1つだけ（複数の比喩を混ぜない）
${k.content.trim()}\n`;
}
