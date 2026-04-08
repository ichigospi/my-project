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
  createdAt: string;
  updatedAt: string;
}

export interface IdeaRules {
  direction: string;       // チャンネルの方向性（やるネタ/やらないネタ）
  constraints: string;     // 企画の制約条件
  priority: string;        // 重視する指標
  thumbnailPolicy: string; // サムネ・タイトルの方針
  ngThemes: string;        // NGテーマ
}

const IDEAS_KEY = "fortune_yt_ideas";
const IDEA_RULES_KEY = "fortune_yt_idea_rules";

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

export function getIdeaRules(): IdeaRules {
  if (typeof window === "undefined") return defaultIdeaRules();
  const stored = localStorage.getItem(IDEA_RULES_KEY);
  return stored ? JSON.parse(stored) : defaultIdeaRules();
}

export function saveIdeaRules(rules: IdeaRules) {
  if (typeof window === "undefined") return;
  localStorage.setItem(IDEA_RULES_KEY, JSON.stringify(rules));
}

function defaultIdeaRules(): IdeaRules {
  return { direction: "", constraints: "", priority: "", thumbnailPolicy: "", ngThemes: "" };
}
