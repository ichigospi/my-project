// Xポストツールで使う型定義
// Prismaの生成型はサーバ側でしか使えないので、クライアントでも使える型を別途定義

import type { XPostGenre } from "./x-post-genre";

// 自アカ情報の構造化フィールド型
export interface StoryStateObject {
  situation: string; // 状況
  numbers: string; // 数字
  feeling: string; // 心境（After 時はライフスタイル）
}

export interface TurningPointObject {
  trigger: string; // きっかけ
  encounter: string; // 出会い
  insight: string; // 気付き
}

export interface StoryEpisode {
  title: string;
  detail: string;
  learning: string;
}

// 自アカ情報のフロントエンド表現（DBのJSON文字列をパース済み）
export interface XAccountInfoForm {
  id?: string;
  genre: XPostGenre;
  // 基本
  accountName: string;
  handle: string;
  concept: string;
  target: string;
  followerImage: string;
  // ポジショニング
  usp: string;
  character: string;
  divinationStyle: string;
  // 口調
  pronoun: string;
  sentenceEnd: string;
  temperature: string;
  emojiUsage: string;
  lineBreakRule: string;
  // KW
  mainKeywords: string[];
  subKeywords: string[];
  ngExpressions: string;
  // 商品
  mainProduct: string;
  lpUrl: string;
  // ストーリー（パース済み）
  storyBeforeState: StoryStateObject;
  storyTurningPoint: TurningPointObject;
  storyEpisodes: StoryEpisode[];
  storyExtremeActs: string[];
  storyNgBehaviors: string[];
  storyAfterState: StoryStateObject;
  storyCommonGround: string[];
  storyPhrases: string[];
}

// 教材
export interface XTeaching {
  id: string;
  genre: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

// 競合アカウント
export interface XCompetitor {
  id: string;
  genre: string;
  handle: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  _count: { posts: number };
  posts: { collectedAt: string }[]; // 最新収集日取得用に1件
}

// 収集した競合ポスト
export interface XCollectedPost {
  id: string;
  competitorId: string;
  postId: string;
  postUrl: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  postedAt: string | null;
  collectedAt: string;
  isQuoteRt: boolean;
  quotedPostUrl: string;
  competitor: {
    id: string;
    handle: string;
    name: string;
    genre: string;
  };
}

// X URL から postId とユーザー名を抽出
// 例: https://x.com/nikichi/status/1234567890 → { handle: "nikichi", postId: "1234567890" }
export interface ParsedXUrl {
  handle: string | null;
  postId: string | null;
  isQuoteRt: boolean;
}

export function parseXUrl(url: string): ParsedXUrl {
  const result: ParsedXUrl = { handle: null, postId: null, isQuoteRt: false };
  if (!url) return result;
  try {
    const u = new URL(url.trim());
    const validHosts = ["x.com", "twitter.com", "mobile.twitter.com", "www.x.com", "www.twitter.com"];
    if (!validHosts.includes(u.hostname)) return result;
    // path: /username/status/123 or /username/status/123/photo/1
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[1] === "status") {
      result.handle = parts[0];
      result.postId = parts[2];
    }
  } catch {
    // 無効なURL
  }
  return result;
}

// 参考ポスト
export interface XReferencePost {
  id: string;
  genre: string;
  title: string;
  content: string;
  authorHandle: string;
  postUrl: string;
  likes: number;
  retweets: number;
  impressions: number;
  postedAt: string | null;
  structureType: string;
  hookAnalysis: string;
  bodyAnalysis: string;
  closingAnalysis: string;
  usedWords: string[];
  applicationHint: string;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

// 教育タイプ（12要素）
export const EDUCATION_TYPES = [
  "目的",
  "信用",
  "問題点",
  "手段",
  "投資",
  "行動",
  "読む見る",
  "変化",
  "素直",
  "アウトプット",
  "基準値",
  "覚悟",
] as const;
export type EducationType = (typeof EDUCATION_TYPES)[number];

// 構造タイプ
export const STRUCTURE_TYPES = [
  "フック型",
  "リスト型",
  "ストーリー型",
  "質問型",
  "対比型",
  "実績訴求型",
  "Before/After型",
  "短文インパクト",
  "数字インパクト型",
  "リアクション型",
] as const;

// 接続タイプ（シーケンスパターンのスロット間）
export const CONNECTION_TYPES = [
  { value: "quote_rt", label: "引用RT" },
  { value: "consecutive", label: "連投" },
  { value: "independent", label: "独立" },
  { value: "story_chain", label: "ストーリー連投" },
] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number]["value"];

// 単一ポストテンプレ
export interface XSinglePostTemplate {
  id: string;
  genre: string;
  name: string;
  sourceType: string; // "competitor_post" | "reference_post" | "scratch"
  sourceId: string | null;
  structure: TemplateStructure; // パース済み
  skeleton: string;
  placeholders: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStructure {
  hookType?: string; // 14手法のいずれか
  educationType?: EducationType | "";
  structureType?: string;
  reinforcementElements?: string[];
}

// シーケンスパターン
export interface XSequencePatternRecord {
  id: string;
  genre: string;
  name: string;
  description: string;
  pattern: SequenceSlot[]; // パース済み
  example: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceSlot {
  slot: number; // 1, 2, 3...
  educationType: EducationType | "";
  structureType: string;
  skeleton: string;
  placeholders: string[];
  // 次のスロットへの接続タイプ（最後のスロットでは無視）
  connectionType: ConnectionType | "";
}

export function emptyTemplateStructure(): TemplateStructure {
  return { hookType: "", educationType: "", structureType: "", reinforcementElements: [] };
}

export function parseTemplate(record: {
  id: string;
  genre: string;
  name: string;
  sourceType: string;
  sourceId: string | null;
  structure: string;
  skeleton: string;
  placeholders: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}): XSinglePostTemplate {
  let structure: TemplateStructure = emptyTemplateStructure();
  let placeholders: string[] = [];
  try { structure = { ...emptyTemplateStructure(), ...JSON.parse(record.structure || "{}") }; } catch {}
  try { placeholders = JSON.parse(record.placeholders || "[]"); } catch {}
  return {
    ...record,
    structure,
    placeholders,
  };
}

export function parseSequencePattern(record: {
  id: string;
  genre: string;
  name: string;
  description: string;
  pattern: string;
  example: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}): XSequencePatternRecord {
  let pattern: SequenceSlot[] = [];
  try {
    const arr = JSON.parse(record.pattern || "[]");
    if (Array.isArray(arr)) {
      pattern = arr.map((s: Partial<SequenceSlot>, i: number) => ({
        slot: typeof s.slot === "number" ? s.slot : i + 1,
        educationType: (s.educationType as EducationType | "") ?? "",
        structureType: s.structureType ?? "",
        skeleton: s.skeleton ?? "",
        placeholders: Array.isArray(s.placeholders) ? s.placeholders : [],
        connectionType: (s.connectionType as ConnectionType | "") ?? "",
      }));
    }
  } catch {}
  return {
    ...record,
    pattern,
  };
}

// =============================
// 設定（XSettings）
// =============================

export interface EducationFrequencyConfig {
  // 各教育タイプの最低頻度（X日に1回）
  // 例: 目的: 1（毎日）, 信用: 2, 問題点: 3, ...
  minPerDays: Partial<Record<EducationType, number>>;
}

export interface XSettingsForm {
  id?: string;
  genre: XPostGenre;
  postsPerDay: number;
  educationConfig: EducationFrequencyConfig;
  sequenceConfig: { quoteRtRate: number; consecutiveRate: number; independentRate: number; storyChainRate: number };
  spiceEnabled: boolean;
  defaultModel: string;
  xApiBearerToken: string;
}

export function defaultSettings(genre: XPostGenre): XSettingsForm {
  return {
    genre,
    postsPerDay: 5,
    educationConfig: {
      minPerDays: {
        目的: 1,
        信用: 2,
        問題点: 3,
        手段: 2,
        投資: 5,
        行動: 3,
      },
    },
    sequenceConfig: {
      quoteRtRate: 30,
      consecutiveRate: 25,
      independentRate: 40,
      storyChainRate: 5,
    },
    spiceEnabled: true,
    defaultModel: "claude-sonnet-4-6",
    xApiBearerToken: "",
  };
}

interface XSettingsApiRecord {
  id: string;
  genre: string;
  postsPerDay: number;
  educationConfig: string;
  sequenceConfig: string;
  spiceEnabled: boolean;
  defaultModel: string;
  xApiBearerToken: string;
}

export function parseSettings(record: XSettingsApiRecord | null, genre: XPostGenre): XSettingsForm {
  if (!record) return defaultSettings(genre);
  const fallback = defaultSettings(genre);
  let educationConfig: EducationFrequencyConfig = fallback.educationConfig;
  let sequenceConfig = fallback.sequenceConfig;
  try {
    const parsed = JSON.parse(record.educationConfig || "{}");
    educationConfig = parsed.minPerDays ? parsed : fallback.educationConfig;
  } catch {}
  try {
    sequenceConfig = { ...fallback.sequenceConfig, ...JSON.parse(record.sequenceConfig || "{}") };
  } catch {}
  return {
    id: record.id,
    genre,
    postsPerDay: record.postsPerDay,
    educationConfig,
    sequenceConfig,
    spiceEnabled: record.spiceEnabled,
    defaultModel: record.defaultModel,
    xApiBearerToken: record.xApiBearerToken,
  };
}

export function serializeSettings(form: XSettingsForm) {
  return {
    genre: form.genre,
    postsPerDay: form.postsPerDay,
    educationConfig: JSON.stringify(form.educationConfig),
    sequenceConfig: JSON.stringify(form.sequenceConfig),
    spiceEnabled: form.spiceEnabled,
    defaultModel: form.defaultModel,
    xApiBearerToken: form.xApiBearerToken,
  };
}

// =============================
// デイリープラン
// =============================

export interface DailyPlanSlot {
  slot: number; // 1, 2, 3...
  educationType: EducationType | "";
  theme: string; // AI提案 or 手動入力したテーマ
  reasoning: string; // なぜこの教育タイプ・テーマを選んだか（AI出力）
  hookType: string; // 推奨フック（任意）
  connectionType: ConnectionType | ""; // 次スロットへの接続
  status: "draft" | "generated" | "posted"; // ポスト状態
  generatedPostId?: string;
}

export interface XDailyPlanRecord {
  id: string;
  genre: string;
  date: string; // YYYY-MM-DD
  slots: DailyPlanSlot[]; // パース済み
  notes: string;
  status: "draft" | "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
}

export function parseDailyPlan(record: {
  id: string;
  genre: string;
  date: string;
  slots: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}): XDailyPlanRecord {
  let slots: DailyPlanSlot[] = [];
  try {
    const arr = JSON.parse(record.slots || "[]");
    if (Array.isArray(arr)) {
      slots = arr.map((s: Partial<DailyPlanSlot>, i: number) => ({
        slot: typeof s.slot === "number" ? s.slot : i + 1,
        educationType: (s.educationType as EducationType | "") ?? "",
        theme: s.theme ?? "",
        reasoning: s.reasoning ?? "",
        hookType: s.hookType ?? "",
        connectionType: (s.connectionType as ConnectionType | "") ?? "",
        status: (s.status as DailyPlanSlot["status"]) ?? "draft",
        generatedPostId: s.generatedPostId,
      }));
    }
  } catch {}
  return {
    ...record,
    status: (record.status as XDailyPlanRecord["status"]) ?? "draft",
    slots,
  };
}

// =============================
// 分析レコード（DB保存形式）
export interface XPostAnalysisRecord {
  id: string;
  genre: string;
  postIds: string; // JSON文字列
  result: string | null; // JSON文字列 or null
  summary: string;
  customInstruction: string;
  createdAt: string;
  updatedAt: string;
}

// メモ
export interface XMemo {
  id: string;
  genre: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// フォルダ
export interface XFolderWithCount {
  id: string;
  genre: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export const FOLDER_COLORS = [
  { value: "blue", label: "青", className: "bg-blue-500" },
  { value: "emerald", label: "緑", className: "bg-emerald-500" },
  { value: "amber", label: "黄", className: "bg-amber-500" },
  { value: "rose", label: "赤", className: "bg-rose-500" },
  { value: "purple", label: "紫", className: "bg-purple-500" },
  { value: "pink", label: "ピンク", className: "bg-pink-500" },
  { value: "slate", label: "灰", className: "bg-slate-500" },
];

export function folderColorClass(color: string): string {
  return FOLDER_COLORS.find((c) => c.value === color)?.className ?? "bg-blue-500";
}

// 構造化フィールドの初期値生成
export function emptyAccountInfo(genre: XPostGenre): XAccountInfoForm {
  return {
    genre,
    accountName: "",
    handle: "",
    concept: "",
    target: "",
    followerImage: "",
    usp: "",
    character: "",
    divinationStyle: "",
    pronoun: "",
    sentenceEnd: "",
    temperature: "",
    emojiUsage: "",
    lineBreakRule: "",
    mainKeywords: [],
    subKeywords: [],
    ngExpressions: "",
    mainProduct: "",
    lpUrl: "",
    storyBeforeState: { situation: "", numbers: "", feeling: "" },
    storyTurningPoint: { trigger: "", encounter: "", insight: "" },
    storyEpisodes: [],
    storyExtremeActs: [],
    storyNgBehaviors: [],
    storyAfterState: { situation: "", numbers: "", feeling: "" },
    storyCommonGround: [],
    storyPhrases: [],
  };
}

// DBレコード（JSON文字列）→ フロント型
type AccountInfoApi = {
  id?: string;
  genre: string;
  accountName?: string;
  handle?: string;
  concept?: string;
  target?: string;
  followerImage?: string;
  usp?: string;
  character?: string;
  divinationStyle?: string;
  pronoun?: string;
  sentenceEnd?: string;
  temperature?: string;
  emojiUsage?: string;
  lineBreakRule?: string;
  mainKeywords?: string;
  subKeywords?: string;
  ngExpressions?: string;
  mainProduct?: string;
  lpUrl?: string;
  storyBeforeState?: string;
  storyTurningPoint?: string;
  storyEpisodes?: string;
  storyExtremeActs?: string;
  storyNgBehaviors?: string;
  storyAfterState?: string;
  storyCommonGround?: string;
  storyPhrases?: string;
};

export function parseAccountInfo(record: AccountInfoApi | null, genre: XPostGenre): XAccountInfoForm {
  if (!record) return emptyAccountInfo(genre);
  const safeJSON = <T,>(s: string | undefined, fallback: T): T => {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };
  const empty = emptyAccountInfo(genre);
  return {
    id: record.id,
    genre,
    accountName: record.accountName ?? "",
    handle: record.handle ?? "",
    concept: record.concept ?? "",
    target: record.target ?? "",
    followerImage: record.followerImage ?? "",
    usp: record.usp ?? "",
    character: record.character ?? "",
    divinationStyle: record.divinationStyle ?? "",
    pronoun: record.pronoun ?? "",
    sentenceEnd: record.sentenceEnd ?? "",
    temperature: record.temperature ?? "",
    emojiUsage: record.emojiUsage ?? "",
    lineBreakRule: record.lineBreakRule ?? "",
    mainKeywords: safeJSON(record.mainKeywords, []),
    subKeywords: safeJSON(record.subKeywords, []),
    ngExpressions: record.ngExpressions ?? "",
    mainProduct: record.mainProduct ?? "",
    lpUrl: record.lpUrl ?? "",
    storyBeforeState: safeJSON(record.storyBeforeState, empty.storyBeforeState),
    storyTurningPoint: safeJSON(record.storyTurningPoint, empty.storyTurningPoint),
    storyEpisodes: safeJSON(record.storyEpisodes, []),
    storyExtremeActs: safeJSON(record.storyExtremeActs, []),
    storyNgBehaviors: safeJSON(record.storyNgBehaviors, []),
    storyAfterState: safeJSON(record.storyAfterState, empty.storyAfterState),
    storyCommonGround: safeJSON(record.storyCommonGround, []),
    storyPhrases: safeJSON(record.storyPhrases, []),
  };
}

// フロント型 → DBへのpayload（JSON文字列化）
export function serializeAccountInfo(form: XAccountInfoForm) {
  return {
    genre: form.genre,
    accountName: form.accountName,
    handle: form.handle,
    concept: form.concept,
    target: form.target,
    followerImage: form.followerImage,
    usp: form.usp,
    character: form.character,
    divinationStyle: form.divinationStyle,
    pronoun: form.pronoun,
    sentenceEnd: form.sentenceEnd,
    temperature: form.temperature,
    emojiUsage: form.emojiUsage,
    lineBreakRule: form.lineBreakRule,
    mainKeywords: JSON.stringify(form.mainKeywords),
    subKeywords: JSON.stringify(form.subKeywords),
    ngExpressions: form.ngExpressions,
    mainProduct: form.mainProduct,
    lpUrl: form.lpUrl,
    storyBeforeState: JSON.stringify(form.storyBeforeState),
    storyTurningPoint: JSON.stringify(form.storyTurningPoint),
    storyEpisodes: JSON.stringify(form.storyEpisodes),
    storyExtremeActs: JSON.stringify(form.storyExtremeActs),
    storyNgBehaviors: JSON.stringify(form.storyNgBehaviors),
    storyAfterState: JSON.stringify(form.storyAfterState),
    storyCommonGround: JSON.stringify(form.storyCommonGround),
    storyPhrases: JSON.stringify(form.storyPhrases),
  };
}
