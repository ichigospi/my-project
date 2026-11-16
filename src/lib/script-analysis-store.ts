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
  updatedAt?: string; // 同期マージで「新しい方が勝つ」判定に使う（サーバー行にも存在）
  score?: AnalysisScore;
  essence?: ScriptEssence; // 元ネタの本質（骨組み・台本に必ず反映する要素）
}

// 元ネタ台本の「本質」。構成を決める段階で大きく表示し、骨組み・台本生成のプロンプトに必達で注入する。
export interface ScriptEssence {
  coreProblems: string[];     // 視聴者の悩みの本質（元ネタが名指しした悩み。言い回しごと）
  targetCallout: string;      // ターゲットの名指し（「特に〜と感じている方に」）
  affirmReframe: string;      // 肯定のリフレーム（例: 運から外れていたのではなく噛み合う途中だった）
  agendaHook: string;         // 予告の切り口（例: 入り口は仕事か・縁か・過去に諦めたことか）
  causeAxis: string;          // 原因・常識破壊の軸（例: 与える側だった→受け取り下手／失敗恐怖）
  advice: string[];           // 具体行動（アドバイス）
  idealFuture: string[];      // 理想の未来の具体
  selfAffirmClose: string;    // 自己肯定の締め
  keyMessage: string;         // 最重要メッセージ（締めの結論）
  commentCta: string;         // コメントCTAの語とロジック
  heavyCtaUnknowns: string[]; // 重CTAで「個別でないと視えない」とした未知数
  mustKeep: string[];         // 骨組みに必ず反映すべき要素（優先順・短文）
  timeline?: { element: string; position: string; card?: number }[]; // 各要素が元ネタのどの段階に出るか（冒頭/序盤/中盤/終盤・何枚目相当）
  extractedAt: string;
}

// 本質の要素を「台本に出てくる順番」で並べたブロック（画面表示とプロンプトの両方で使う）
export interface EssenceBlock { stage: string; title: string; text?: string; items?: string[] }
export function essenceBlocksInOrder(e: ScriptEssence | null | undefined): EssenceBlock[] {
  if (!e) return [];
  const out: EssenceBlock[] = [];
  const push = (stage: string, title: string, v: string | string[] | undefined) => {
    if (Array.isArray(v)) { const xs = v.filter(Boolean); if (xs.length) out.push({ stage, title, items: xs }); }
    else if (v && v.trim()) out.push({ stage, title, text: v });
  };
  push("冒頭", "ターゲットの名指し", e.targetCallout);
  push("冒頭", "予告の切り口", e.agendaHook);
  push("1〜2枚目", "悩みの本質（言い回しを活かす）", e.coreProblems);
  push("1〜2枚目", "肯定のリフレーム", e.affirmReframe);
  push("3枚目", "原因・常識破壊の軸", e.causeAxis);
  push("4枚目", "具体行動", e.advice);
  push("5枚目", "理想の未来の具体", e.idealFuture);
  push("締め", "自己肯定の締め", e.selfAffirmClose);
  push("締め", "最重要メッセージ（結論）", e.keyMessage);
  push("CTA（参考）", "コメントCTAのロジック", e.commentCta);
  push("CTA（参考）", "重CTAの未知数", e.heavyCtaUnknowns);
  return out;
}
// 「必ず反映する要素」を元ネタでの出現順（冒頭→序盤→中盤→終盤、同じ段階ならカード番号順）に並べ替える
export function mustKeepInOrder(e: ScriptEssence | null | undefined): { text: string; position?: string; card?: number }[] {
  if (!e?.mustKeep?.length) return [];
  const rank: Record<string, number> = { "冒頭": 0, "序盤": 1, "中盤": 2, "終盤": 3 };
  const tl = e.timeline || [];
  const find = (x: string) => tl.find((t) => t.element === x) || tl.find((t) => x.includes(t.element) || t.element.includes(x));
  return e.mustKeep
    .map((text, i) => { const t = find(text); return { text, position: t?.position, card: t?.card, i }; })
    .sort((a, b) => {
      const ra = a.position ? (rank[a.position] ?? 9) : 9; const rb = b.position ? (rank[b.position] ?? 9) : 9;
      if (ra !== rb) return ra - rb;
      const ca = a.card ?? 99; const cb = b.card ?? 99;
      if (ca !== cb) return ca - cb;
      return a.i - b.i;
    })
    .map(({ text, position, card }) => ({ text, position, card }));
}

// 元ネタの本質をプロンプト用テキストに整形（骨組み・台本生成の両方で使う。台本に出てくる順番で並べる）
export function formatEssenceForPrompt(e: ScriptEssence | null | undefined, label = "元ネタ"): string {
  if (!e) return "";
  const li = (xs: string[]) => xs.filter(Boolean).map((x) => `  - ${x}`).join("\n");
  const lines: string[] = [];
  lines.push(`【${label}の本質（必達・骨組みと台本の両方に必ず反映する）】`);
  lines.push("これは元ネタが視聴者に刺さった「中身」です。表面の構成だけ真似て中身を落とさないこと。各項目を対応するパートに必ず組み込む（台本に出てくる順）:");
  const mk = mustKeepInOrder(e);
  if (mk.length) lines.push(`■ 必ず反映する要素（元ネタでの出現順）\n${li(mk.map((m) => `${m.position ? `[${m.position}${m.card ? `・${m.card}枚目相当` : ""}] ` : ""}${m.text}`))}`);
  for (const b of essenceBlocksInOrder(e)) {
    if (b.items) lines.push(`■ ${b.stage}｜${b.title}\n${li(b.items)}`);
    else lines.push(`■ ${b.stage}｜${b.title}: ${b.text}`);
  }
  return lines.join("\n");
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
  // --- 上位互換生成のための5要素（元ネタから抽出し、これを超える台本を作る） ---
  idealFuture?: string;        // 理想の未来（欲求喚起）: 数字・シチュエーション込みの具体描写
  worstFuture?: string;        // 最悪の未来: 回避したい恐怖・損失の具体描写
  retentionTactics?: string[]; // 視聴維持率を確保する仕掛け（離脱防止の工夫）
  worldview?: string;          // 世界観の演出（用語・比喩・スピリチュアルな世界観の作り込み）
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
  updatedAt?: string; // 同期マージで「新しい方が勝つ」判定に使う
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
  const stamped: ScriptAnalysis = { ...analysis, updatedAt: new Date().toISOString() };
  const analyses = getAnalyses();
  const idx = analyses.findIndex((a) => a.id === stamped.id);
  if (idx >= 0) {
    analyses[idx] = stamped;
  } else {
    analyses.unshift(stamped);
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
    } catch (e) {
      // 容量不足(QuotaExceeded)等でローカル保存に失敗しても、サーバー送信は必ず行う
      // （次回の同期pullでサーバーから復元される）
      console.error("[sync] localStorage save failed (server sync continues):", e);
    }
  }
  // DB同期（非同期・リトライ付き）
  syncAnalysisToServer(stamped);
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
  const stamped = { ...proposal, updatedAt: new Date().toISOString() } as ScriptProposal;
  const proposals = getProposals();
  const idx = proposals.findIndex((p) => p.id === stamped.id);
  if (idx >= 0) {
    proposals[idx] = stamped;
  } else {
    proposals.unshift(stamped);
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
    } catch (e) {
      console.error("[sync] localStorage save failed (server sync continues):", e);
    }
  }
  syncProposalToServer(stamped);
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

    // ローカルの方が新しい/サーバーに無いデータをサーバーへアップロード
    // （過去に送信失敗した完成版を自動で回復させる）
    const serverAnalysisById = new Map(serverAnalyses.map((a) => [a.id, a]));
    const serverProposalById = new Map(serverProposals.map((p) => [p.id, p]));

    let uploadCount = 0;
    for (const a of localAnalyses) {
      const sv = serverAnalysisById.get(a.id);
      if (!sv || itemTime(a) > itemTime(sv)) { syncAnalysisToServer(a); uploadCount++; }
    }
    for (const p of localProposals) {
      const sv = serverProposalById.get(p.id);
      if (!sv || itemTime(p) > itemTime(sv)) { syncProposalToServer(p); uploadCount++; }
    }
    if (uploadCount > 0) console.log(`[sync] uploading ${uploadCount} local-only items to server`);

    return { analyses: mergedAnalyses, proposals: mergedProposals };
  } catch (e) {
    console.error("[sync] failed:", e);
    return { analyses: getAnalyses(), proposals: getProposals() };
  }
}

// 「新しい方が勝つ」マージ。
// 旧実装は同一IDでサーバー優先だったため、AI分析後の完成版がサーバーに届く前に
// 失敗していると、次のpullで古い（書き起こしのみ等の）サーバー版に上書きされて
// 「分析済みが消える」データ退行が起きていた。
function itemTime<T extends { createdAt: string; updatedAt?: string }>(x: T): number {
  return new Date(x.updatedAt || x.createdAt || 0).getTime();
}
function mergeData<T extends { id: string; createdAt: string; updatedAt?: string }>(local: T[], server: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of server) merged.set(item.id, item);
  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing || itemTime(item) > itemTime(existing)) merged.set(item.id, item);
  }
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// --- 非同期サーバー同期ヘルパー ---

// 5xx・通信エラーは最大3回リトライして送信する（分析データ消失の防止）
async function postJsonWithRetry(url: string, body: unknown, label: string) {
  const json = JSON.stringify(body);
  let lastErr = "";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
      if (r.ok) return;
      lastErr = `HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}`;
      if (r.status < 500) break; // 4xxは再試行しない
    } catch (e) {
      lastErr = String(e).slice(0, 120);
    }
    if (i < 2) await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  console.error(`[sync] ${label} failed after retries:`, lastErr);
}

function syncAnalysisToServer(analysis: ScriptAnalysis) {
  void postJsonWithRetry("/api/analyses", analysis, "save analysis");
}

function deleteAnalysisFromServer(id: string) {
  fetch("/api/analyses", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch((e) => console.error("[sync] delete analysis error:", e));
}

function syncProposalToServer(proposal: ScriptProposal) {
  void postJsonWithRetry("/api/proposals", proposal, "save proposal");
}

function deleteProposalFromServer(id: string) {
  fetch("/api/proposals", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch((e) => console.error("[sync] delete proposal error:", e));
}
