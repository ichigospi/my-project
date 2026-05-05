// 自チャンネルプロフィール設定

export interface ChannelProfile {
  channelName: string;
  concept: string;        // チャンネルコンセプト
  tone: string;           // 口調・話し方の特徴
  target: string;         // ターゲット層
  genres: string[];       // 得意ジャンル
  mainStyle: "healing" | "education" | "both";  // メインスタイル
  characteristics: string; // その他の特徴・こだわり
  // --- 台本ルール（指示記憶） ---
  commonRules: string;    // チャンネル共通ルール（全台本に適用）
  ngExpressions: string;  // NG表現リスト
  referenceAnalysisIds: string[]; // お手本台本のID
  channelId?: string;
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
    commonRules: "",
    ngExpressions: "",
    referenceAnalysisIds: [],
  };
}

// --- Multi-channel Profile support ---
const PROFILES_KEY = "fortune_yt_profiles";

export function getAllProfiles(): ChannelProfile[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(PROFILES_KEY);
  if (stored) return JSON.parse(stored);
  // Migration: convert single profile to array
  const single = getProfile();
  if (single.channelName) return [single];
  return [];
}

export function getProfileByChannel(channelId: string): ChannelProfile {
  const profiles = getAllProfiles();
  return profiles.find((p) => p.channelId === channelId) || defaultProfile();
}

export function saveProfileByChannel(profile: ChannelProfile) {
  const profiles = getAllProfiles();
  const idx = profiles.findIndex((p) => p.channelId === profile.channelId);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
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

// 「不明」や空欄になっている既存分析を YouTube API で再取得して直す
// 戻り値: 修復した件数
export async function repairAnalysisVideoInfos(ytApiKey: string): Promise<number> {
  if (!ytApiKey) return 0;
  const analyses = getAnalyses();
  const targets = analyses.filter(
    (a) =>
      a.videoId &&
      (!a.videoTitle || a.videoTitle === "不明" ||
       !a.channelName || a.channelName === "不明" ||
       !a.thumbnailUrl)
  );
  if (targets.length === 0) return 0;
  let repaired = 0;
  for (const a of targets) {
    try {
      const params = new URLSearchParams({ videoId: a.videoId, apiKey: ytApiKey });
      const res = await fetch(`/api/youtube/transcript?${params}`);
      if (!res.ok) continue;
      const d = await res.json();
      if (!d?.title) continue;
      const updated: ScriptAnalysis = {
        ...a,
        videoTitle: d.title,
        channelName: d.channelTitle || a.channelName,
        thumbnailUrl: d.thumbnailUrl || a.thumbnailUrl,
        views: typeof d.views === "number" && d.views > 0 ? d.views : a.views,
      };
      saveAnalysis(updated);
      repaired++;
    } catch {
      // 1件失敗しても他は続行
    }
  }
  return repaired;
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

// --- AI 分析の気づき (チャンネル別) ---
export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIAnalysisInsight {
  id: string;
  channelId?: string;
  // 新形式: 会話履歴
  messages?: AIChatMessage[];
  // 旧形式: 後方互換 (1往復のみだった頃のデータ)
  prompt?: string;
  response?: string;
  sourceAnalysisIds: string[]; // 対象analyses
  createdAt: string;
}

const AI_INSIGHTS_KEY = "fortune_yt_ai_insights";

export function getAIInsights(): AIAnalysisInsight[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(AI_INSIGHTS_KEY) || "[]");
}

export function getAIInsightsByChannel(channelId: string): AIAnalysisInsight[] {
  return getAIInsights().filter((i) => !i.channelId || i.channelId === channelId);
}

export function saveAIInsight(insight: AIAnalysisInsight) {
  if (typeof window === "undefined") return;
  const all = getAIInsights();
  all.unshift(insight);
  // チャンネル毎に最新50件のみ保持
  const byChannel = new Map<string, AIAnalysisInsight[]>();
  for (const it of all) {
    const k = it.channelId || "";
    if (!byChannel.has(k)) byChannel.set(k, []);
    byChannel.get(k)!.push(it);
  }
  const trimmed: AIAnalysisInsight[] = [];
  for (const list of byChannel.values()) trimmed.push(...list.slice(0, 50));
  localStorage.setItem(AI_INSIGHTS_KEY, JSON.stringify(trimmed));
}

export function deleteAIInsight(id: string) {
  if (typeof window === "undefined") return;
  const filtered = getAIInsights().filter((i) => i.id !== id);
  localStorage.setItem(AI_INSIGHTS_KEY, JSON.stringify(filtered));
}

// --- DB同期: サーバーからlocalStorageにマージ ---

export async function syncFromServer(): Promise<{ analyses: ScriptAnalysis[]; proposals: ScriptProposal[] }> {
  try {
    const [analysesRes, proposalsRes] = await Promise.all([
      fetch("/api/analyses"),
      fetch("/api/proposals"),
    ]);
    if (!analysesRes.ok || !proposalsRes.ok) {
      const aErr = !analysesRes.ok ? await analysesRes.text() : "ok";
      const pErr = !proposalsRes.ok ? await proposalsRes.text() : "ok";
      console.warn("[sync] API error:", aErr, pErr);
      return { analyses: getAnalyses(), proposals: getProposals() };
    }

    const serverAnalyses: ScriptAnalysis[] = await analysesRes.json();
    const serverProposals: ScriptProposal[] = await proposalsRes.json();
    console.log(`[sync] server: ${serverAnalyses.length} analyses, ${serverProposals.length} proposals`);

    const localAnalyses = getAnalyses();
    const localProposals = getProposals();
    console.log(`[sync] local: ${localAnalyses.length} analyses, ${localProposals.length} proposals`);

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

    let uploadCount = 0;
    for (const a of localAnalyses) {
      if (!serverAnalysisIds.has(a.id)) { syncAnalysisToServer(a); uploadCount++; }
    }
    for (const p of localProposals) {
      if (!serverProposalIds.has(p.id)) { syncProposalToServer(p); uploadCount++; }
    }
    if (uploadCount > 0) console.log(`[sync] uploading ${uploadCount} local-only items to server`);

    return { analyses: mergedAnalyses, proposals: mergedProposals };
  } catch (e) {
    console.error("[sync] failed:", e);
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
  }).then(async (r) => {
    if (!r.ok) console.error("[sync] save analysis failed:", await r.text());
  }).catch((e) => console.error("[sync] save analysis error:", e));
}

function deleteAnalysisFromServer(id: string) {
  fetch("/api/analyses", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch((e) => console.error("[sync] delete analysis error:", e));
}

function syncProposalToServer(proposal: ScriptProposal) {
  fetch("/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proposal),
  }).then(async (r) => {
    if (!r.ok) console.error("[sync] save proposal failed:", await r.text());
  }).catch((e) => console.error("[sync] save proposal error:", e));
}

function deleteProposalFromServer(id: string) {
  fetch("/api/proposals", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch((e) => console.error("[sync] delete proposal error:", e));
}
