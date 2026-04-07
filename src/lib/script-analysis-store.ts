// 自チャンネルプロフィール設定

export interface ChannelProfile {
  channelName: string;
  concept: string;        // チャンネルコンセプト
  tone: string;           // 口調・話し方の特徴
  target: string;         // ターゲット層
  genres: string[];       // 得意ジャンル
  mainStyle: "healing" | "education" | "both";  // メインスタイル
  characteristics: string; // その他の特徴・こだわり
}

export interface ScriptAnalysis {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  views: number;
  transcript: string;
  analysisResult: AnalysisResult | null;
  category: "healing" | "education" | "other";
  tags: string[];
  createdAt: string;
  score?: AnalysisScore;
}

export interface AnalysisResult {
  summary: string;
  structure: StructureSection[];
  hooks: string[];
  ctas: string[];
  growthFactors: string[];
  appealPoints: string[];
  targetEmotion: string;
  overallPattern: string;
}

export interface StructureSection {
  name: string;
  timeRange: string;
  duration: string;
  description: string;
  purpose: string;
}

export interface AnalysisScore {
  hookStrength: number;     // 1-10
  ctaEffectiveness: number; // 1-10
  structureBalance: number; // 1-10
  emotionalAppeal: number;  // 1-10
  overall: number;          // 1-10
}

export interface ScriptProposal {
  id: string;
  sourceAnalysisIds: string[];
  style: "healing" | "education";
  topic: string;
  proposal: ProposalResult | null;
  generatedScript: string;
  createdAt: string;
}

export interface ProposalResult {
  concept: string;
  structure: StructureSection[];
  keyElements: string[];
  suggestedHooks: string[];
  suggestedCtas: string[];
  estimatedDuration: string;
}

// --- Storage Keys ---
const PROFILE_KEY = "fortune_yt_profile";
const ANALYSES_KEY = "fortune_yt_analyses";
const PROPOSALS_KEY = "fortune_yt_proposals";

// --- Profile (localStorage only) ---
export function getProfile(): ChannelProfile {
  if (typeof window === "undefined") return defaultProfile();
  const stored = localStorage.getItem(PROFILE_KEY);
  return stored ? JSON.parse(stored) : defaultProfile();
}

export function saveProfile(profile: ChannelProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function defaultProfile(): ChannelProfile {
  return {
    channelName: "",
    concept: "",
    tone: "",
    target: "",
    genres: [],
    mainStyle: "healing",
    characteristics: "",
  };
}

// --- Analyses (localStorage + DB sync) ---

export function getAnalyses(): ScriptAnalysis[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(ANALYSES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveAnalysis(analysis: ScriptAnalysis): ScriptAnalysis[] {
  const analyses = getAnalyses();
  const idx = analyses.findIndex((a) => a.id === analysis.id);
  if (idx >= 0) {
    analyses[idx] = analysis;
  } else {
    analyses.unshift(analysis);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
  }
  // DB同期（非同期）
  syncAnalysisToServer(analysis);
  return analyses;
}

export function deleteAnalysis(id: string): ScriptAnalysis[] {
  const analyses = getAnalyses().filter((a) => a.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
  }
  deleteAnalysisFromServer(id);
  return analyses;
}

// --- Proposals (localStorage + DB sync) ---

export function getProposals(): ScriptProposal[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(PROPOSALS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveProposal(proposal: ScriptProposal): ScriptProposal[] {
  const proposals = getProposals();
  const idx = proposals.findIndex((p) => p.id === proposal.id);
  if (idx >= 0) {
    proposals[idx] = proposal;
  } else {
    proposals.unshift(proposal);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
  }
  syncProposalToServer(proposal);
  return proposals;
}

export function deleteProposal(id: string): ScriptProposal[] {
  const proposals = getProposals().filter((p) => p.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
  }
  deleteProposalFromServer(id);
  return proposals;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// --- DB同期: サーバーからlocalStorageにマージ ---

export async function syncFromServer(): Promise<{ analyses: ScriptAnalysis[]; proposals: ScriptProposal[] }> {
  try {
    const [analysesRes, proposalsRes] = await Promise.all([
      fetch("/api/analyses"),
      fetch("/api/proposals"),
    ]);
    if (!analysesRes.ok || !proposalsRes.ok) {
      return { analyses: getAnalyses(), proposals: getProposals() };
    }

    const serverAnalyses: ScriptAnalysis[] = await analysesRes.json();
    const serverProposals: ScriptProposal[] = await proposalsRes.json();

    const localAnalyses = getAnalyses();
    const localProposals = getProposals();

    // マージ（サーバー優先、ローカルのみのものは保持＆アップロード）
    const mergedAnalyses = mergeData(localAnalyses, serverAnalyses);
    const mergedProposals = mergeData(localProposals, serverProposals);

    if (typeof window !== "undefined") {
      localStorage.setItem(ANALYSES_KEY, JSON.stringify(mergedAnalyses));
      localStorage.setItem(PROPOSALS_KEY, JSON.stringify(mergedProposals));
    }

    // ローカルのみのデータをサーバーにアップロード
    const serverAnalysisIds = new Set(serverAnalyses.map((a) => a.id));
    const serverProposalIds = new Set(serverProposals.map((p) => p.id));

    for (const a of localAnalyses) {
      if (!serverAnalysisIds.has(a.id)) syncAnalysisToServer(a);
    }
    for (const p of localProposals) {
      if (!serverProposalIds.has(p.id)) syncProposalToServer(p);
    }

    return { analyses: mergedAnalyses, proposals: mergedProposals };
  } catch {
    return { analyses: getAnalyses(), proposals: getProposals() };
  }
}

function mergeData<T extends { id: string; createdAt: string }>(local: T[], server: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of server) merged.set(item.id, item);
  for (const item of local) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// --- 非同期サーバー同期ヘルパー ---

function syncAnalysisToServer(analysis: ScriptAnalysis) {
  fetch("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(analysis),
  }).catch(() => {});
}

function deleteAnalysisFromServer(id: string) {
  fetch("/api/analyses", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => {});
}

function syncProposalToServer(proposal: ScriptProposal) {
  fetch("/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proposal),
  }).catch(() => {});
}

function deleteProposalFromServer(id: string) {
  fetch("/api/proposals", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => {});
}
