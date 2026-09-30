// パターンライブラリ: 添削部屋で採用した「今後使えそうなパターン」を蓄積し、
// 構成提案の段階で選択して台本生成に注入する。全チャンネル共有（サーバー同期対象）。

export interface PatternItem {
  id: string;
  category: string;   // フック/CTA/視聴維持/売上アドバイス/理想の未来/悩み深掘り/常識破壊/構成/その他
  title: string;
  content: string;    // ルールとして注入されるテキスト
  channelId?: string; // 空なら全チャンネル共通
  createdAt: string;
  updatedAt: string;
}

const KEY = "fortune_yt_patterns";

export function getPatterns(): PatternItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function savePatterns(list: PatternItem[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function addPattern(p: Omit<PatternItem, "id" | "createdAt" | "updatedAt">): PatternItem {
  const item: PatternItem = {
    ...p,
    id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  savePatterns([item, ...getPatterns()]);
  return item;
}

export function removePattern(id: string) {
  savePatterns(getPatterns().filter((p) => p.id !== id));
}

// サーバーからのpull時のマージ（idごとにupdatedAtが新しい方を採用）
export function mergePatterns(server: PatternItem[]): PatternItem[] {
  const map = new Map<string, PatternItem>();
  for (const p of getPatterns()) map.set(p.id, p);
  for (const s of server || []) {
    const local = map.get(s.id);
    if (!local || (s.updatedAt || "") > (local.updatedAt || "")) map.set(s.id, s);
  }
  const merged = [...map.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  savePatterns(merged);
  return merged;
}

// 選択したパターンをプロンプト注入用テキストに整形
export function buildSelectedPatternsBlock(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return "";
  const selected = getPatterns().filter((p) => ids.includes(p.id));
  if (selected.length === 0) return "";
  return `\n\n【選択パターン（今回の台本に必ず取り入れること）】\n${selected
    .map((p) => `■ [${p.category}] ${p.title}\n${p.content}`)
    .join("\n\n")}\n`;
}
