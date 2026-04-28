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
