// 企画出しデータストア
import type { Genre, Style } from "./project-store";

export type IdeaStatus = "idea" | "reviewing" | "adopted" | "rejected";

export interface IdeaEntry {
  id: string;
  title: string;
  genre: Genre;
  style: Style;
  status: IdeaStatus;
  description: string;
  sourceVideos: string[];
  sourceAnalysisIds: string[];
  suggestedHooks: string[];
  suggestedThumbnailWords: string[];
  notes: string;
  linkedProjectId?: string;
  channelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaRules {
  channelId?: string;      // 紐付くMyChannel.id
  direction: string;       // チャンネルの方向性（やるネタ/やらないネタ）
  constraints: string;     // 企画の制約条件
  priority: string;        // 重視する指標
  thumbnailPolicy: string; // サムネ・タイトルの方針
  ngThemes: string;        // NGテーマ
}

const IDEAS_KEY = "fortune_yt_ideas";
const IDEA_RULES_KEY = "fortune_yt_idea_rules";              // 旧singleton
const IDEA_RULES_LIST_KEY = "fortune_yt_idea_rules_list";    // 新list

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  idea: "アイデア",
  reviewing: "検討中",
  adopted: "採用",
  rejected: "見送り",
};

export function getIdeas(): IdeaEntry[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(IDEAS_KEY) || "[]");
}

export function saveIdea(idea: IdeaEntry): IdeaEntry[] {
  const ideas = getIdeas();
  const idx = ideas.findIndex((i) => i.id === idea.id);
  if (idx >= 0) ideas[idx] = idea;
  else ideas.unshift(idea);
  localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
  return ideas;
}

export function deleteIdea(id: string): IdeaEntry[] {
  const ideas = getIdeas().filter((i) => i.id !== id);
  localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
  return ideas;
}

// 一覧取得（旧singletonがあれば自動でlistに移行）
export function getIdeaRulesList(): IdeaRules[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(IDEA_RULES_LIST_KEY);
  if (stored) return JSON.parse(stored);
  // 移行: 旧singletonを最初のMyChannelに紐付け
  const old = localStorage.getItem(IDEA_RULES_KEY);
  if (old) {
    const oldData: IdeaRules = JSON.parse(old);
    const myChannels = JSON.parse(localStorage.getItem("fortune_yt_my_channels") || "[]");
    const firstChId = myChannels[0]?.id || "";
    const list: IdeaRules[] = [{ ...oldData, channelId: firstChId }];
    localStorage.setItem(IDEA_RULES_LIST_KEY, JSON.stringify(list));
    return list;
  }
  return [];
}

// チャンネル別取得
export function getIdeaRulesByChannel(channelId: string): IdeaRules {
  const list = getIdeaRulesList();
  const found =
    list.find((r) => r.channelId === channelId) ||
    (channelId ? null : list.find((r) => !r.channelId));
  return found || { ...defaultIdeaRules(), channelId };
}

// チャンネル別保存
export function saveIdeaRulesByChannel(rules: IdeaRules) {
  if (typeof window === "undefined") return;
  const list = getIdeaRulesList();
  const idx = list.findIndex((r) => (r.channelId || "") === (rules.channelId || ""));
  if (idx >= 0) list[idx] = rules;
  else list.push(rules);
  localStorage.setItem(IDEA_RULES_LIST_KEY, JSON.stringify(list));
}

// 後方互換: 旧API（最初のチャンネル分のルールを返す）
export function getIdeaRules(): IdeaRules {
  return getIdeaRulesList()[0] || defaultIdeaRules();
}

export function saveIdeaRules(rules: IdeaRules) {
  saveIdeaRulesByChannel(rules);
}

function defaultIdeaRules(): IdeaRules {
  return { direction: "", constraints: "", priority: "", thumbnailPolicy: "", ngThemes: "" };
}

// ===== チャンネル別フィルター =====
export function getIdeasByChannel(channelId: string): IdeaEntry[] {
  return getIdeas().filter((i) => !i.channelId || i.channelId === channelId);
}
