// パターンライブラリ: 添削部屋で採用した「今後使えそうなパターン」を蓄積し、
// 構成提案の段階で選択して台本生成に注入する。全チャンネル共有（サーバー同期対象）。
// 削除は論理削除（tombstone）: 物理削除すると他端末とのマージで復活してしまうため。

export interface PatternItem {
  id: string;
  category: string;   // PATTERN_CATEGORIES のいずれか
  title: string;
  content: string;    // ルールとして注入されるテキスト
  channelId?: string; // 空なら全チャンネル共通
  deleted?: boolean;  // 論理削除フラグ（取り消し済み）
  createdAt: string;
  updatedAt: string;
}

// パターンのカテゴリ（骨組みの各パートと対応。後から自由に再割り振り可能）
export const PATTERN_CATEGORIES = [
  "全体構成",
  "選民フック",
  "導入の離脱防止",
  "問題提起",
  "悩みの深掘りと共感",
  "仮想敵批判と常識破壊",
  "解決策アドバイス",
  "理想の未来",
  "LINE登録CTA",
  "チャンネル登録・高評価・コメント訴求",
  "口コミ",
  "その他",
] as const;

// 旧カテゴリ→新カテゴリの自動移行（既存の追加済みパターンを読み込み時に変換）
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "フック": "選民フック",
  "CTA": "LINE登録CTA",
  "視聴維持": "導入の離脱防止",
  "売上アドバイス": "その他",
  "悩み深掘り": "悩みの深掘りと共感",
  "常識破壊": "仮想敵批判と常識破壊",
  "構成": "全体構成",
};

export function normalizeCategory(c: string): string {
  if ((PATTERN_CATEGORIES as readonly string[]).includes(c)) return c;
  return LEGACY_CATEGORY_MAP[c] || "その他";
}

const KEY = "fortune_yt_patterns";

function readAll(): PatternItem[] {
  if (typeof window === "undefined") return [];
  try {
    const list: PatternItem[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    // 旧カテゴリを新カテゴリへ移行
    let changed = false;
    const out = list.map((p) => {
      const cat = normalizeCategory(p.category);
      if (cat !== p.category) { changed = true; return { ...p, category: cat }; }
      return p;
    });
    if (changed) savePatterns(out);
    return out;
  } catch { return []; }
}

export function savePatterns(list: PatternItem[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// 表示・注入用（削除済みを除く）
export function getPatterns(): PatternItem[] {
  return readAll().filter((p) => !p.deleted);
}

// 同期push用（tombstone含む全件。削除の伝播に必要）
export function getPatternsForSync(): PatternItem[] {
  return readAll();
}

export function addPattern(p: Omit<PatternItem, "id" | "createdAt" | "updatedAt" | "deleted">): PatternItem {
  const item: PatternItem = {
    ...p,
    category: normalizeCategory(p.category),
    id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  savePatterns([item, ...readAll()]);
  return item;
}

// カテゴリ・内容の変更（後からの再割り振り用）
export function updatePattern(id: string, patch: Partial<Pick<PatternItem, "category" | "title" | "content" | "channelId">>) {
  savePatterns(readAll().map((p) => (p.id === id
    ? { ...p, ...patch, ...(patch.category ? { category: normalizeCategory(patch.category) } : {}), updatedAt: new Date().toISOString() }
    : p)));
}

// 取り消し（論理削除。全端末に同期で伝播する）
export function removePattern(id: string) {
  savePatterns(readAll().map((p) => (p.id === id ? { ...p, deleted: true, updatedAt: new Date().toISOString() } : p)));
}

// サーバーからのpull時のマージ（idごとにupdatedAtが新しい方を採用。tombstoneもそのままマージ）
export function mergePatterns(server: PatternItem[]): PatternItem[] {
  const map = new Map<string, PatternItem>();
  for (const p of readAll()) map.set(p.id, p);
  for (const s of server || []) {
    const local = map.get(s.id);
    if (!local || (s.updatedAt || "") > (local.updatedAt || "")) {
      map.set(s.id, { ...s, category: normalizeCategory(s.category) });
    }
  }
  const merged = [...map.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  savePatterns(merged);
  return merged.filter((p) => !p.deleted);
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
