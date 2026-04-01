// 台本プロジェクト管理 & 関連データストア

// ===== ジャンル・スタイル =====
export type Genre = "love" | "money" | "general";
export type Style = "healing" | "education";

export const GENRE_LABELS: Record<Genre, string> = {
  love: "恋愛運",
  money: "金運",
  general: "総合運",
};

export const STYLE_LABELS: Record<Style, string> = {
  healing: "ヒーリング系",
  education: "教育系",
};

// ===== 台本プロジェクト =====
export interface ScriptProject {
  id: string;
  genre: Genre;
  style: Style;
  title: string;
  titleCandidates: TitleCandidate[];
  referenceVideos: ReferenceVideo[];
  analyses: string[]; // ScriptAnalysis IDs
  structureProposal: StructureProposal | null;
  generatedScript: string;
  telopScript: TelopLine[] | null;
  thumbnailTexts: string[];
  status: "genre" | "title" | "references" | "analyzing" | "proposal" | "script" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface TitleCandidate {
  title: string;
  reason: string;
  sourceVideo?: string;
  sourceChannel?: string;
  estimatedPotential: "high" | "medium" | "low";
}

export interface ReferenceVideo {
  videoId: string;
  title: string;
  channelName: string;
  views: number;
  thumbnailUrl: string;
  multiplier?: number; // 平均再生倍率
  selected: boolean;
}

export interface StructureProposal {
  suggestedTitle: string;
  concept: string;
  structure: { name: string; timeRange: string; duration: string; description: string; purpose: string }[];
  keyElements: string[];
  suggestedHooks: string[];
  suggestedCtas: string[];
  estimatedDuration: string;
  targetWordCount: number;
}

export interface TelopLine {
  text: string;
  displaySeconds: number;
  section: string;
}

// ===== 台本ルールプリセット =====
export interface ScriptRulePreset {
  id: string;
  genre: Genre;
  style: Style;
  name: string;
  rules: string;
  prompt: string;
  targetWordCount: number;
  hookPattern: string;
  ctaPattern: string;
  notes: string;
}

// ===== フック & CTA データベース =====
export interface HookEntry {
  id: string;
  text: string;
  genre: Genre;
  style: Style;
  score: number; // 1-10
  sourceVideo: string;
  sourceChannel: string;
  tags: string[];
  createdAt: string;
}

export interface CTAEntry {
  id: string;
  text: string;
  genre: Genre;
  style: Style;
  score: number;
  sourceVideo: string;
  sourceChannel: string;
  tags: string[];
  createdAt: string;
}

// ===== パフォーマンスデータ =====
export interface PerformanceRecord {
  id: string;
  projectId: string;
  videoUrl: string;
  title: string;
  genre: Genre;
  style: Style;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  structureUsed: string;
  hooksUsed: string[];
  ctasUsed: string[];
  notes: string;
  recordedAt: string;
}

// ===== 自チャンネルトラッキング =====
export interface MyChannelVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  genre: Genre;
  snapshots: VideoSnapshot[];
  linkedProjectId?: string;
  dropoffNote?: string; // 離脱ポイントの手動メモ
}

export interface VideoSnapshot {
  date: string;
  views: number;
  likes: number;
  comments: number;
}

export interface MyChannelData {
  channelId: string;
  channelName: string;
  videos: MyChannelVideo[];
  lastFetched: string;
}

const MY_CHANNEL_KEY = "fortune_yt_my_channel";

export function getMyChannel(): MyChannelData | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(MY_CHANNEL_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function saveMyChannel(data: MyChannelData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MY_CHANNEL_KEY, JSON.stringify(data));
}

// ジャンル自動判定
const GENRE_KW: Record<Genre, string[]> = {
  love: ["恋愛", "ツインレイ", "ツインソウル", "運命の人", "復縁", "片思い", "あの人", "お相手", "パートナー", "結婚", "同棲", "連絡", "再会", "愛", "恋", "ソウルメイト", "彼", "好きな人", "告白", "両想い", "嫉妬", "欲してくる", "脈", "好意", "想い", "カップル", "モテ", "出会い", "離れられない", "忘れられない", "追いかけ"],
  money: ["金運", "お金", "収入", "豊かさ", "富", "財", "臨時収入", "宝くじ", "昇給", "開運", "金銭", "貯金", "億", "年収"],
  general: ["運勢", "スピリチュアル", "覚醒", "エネルギー", "浄化", "チャクラ", "瞑想", "ヒーリング", "波動", "アセンション", "守護", "天使", "エンジェル", "宇宙"],
};

// ===== AI分析履歴 =====
export interface AnalysisLog {
  id: string;
  date: string;
  analysis: string;
  videoCount: number;
  avgViews: number;
}

const ANALYSIS_LOG_KEY = "fortune_yt_analysis_log";

export function getAnalysisLogs(): AnalysisLog[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(ANALYSIS_LOG_KEY) || "[]");
}

export function saveAnalysisLog(log: AnalysisLog) {
  const logs = getAnalysisLogs();
  logs.unshift(log);
  // 最大10件保持
  const trimmed = logs.slice(0, 10);
  localStorage.setItem(ANALYSIS_LOG_KEY, JSON.stringify(trimmed));
}

// ===== 週次スナップショット =====
export interface WeeklySnapshot {
  weekStart: string; // YYYY-MM-DD（月曜日）
  totalViews: number;
  avgViews: number;
  totalLikes: number;
  totalComments: number;
  videoCount: number;
  subscribersGained: number;
  topVideo: { title: string; views: number };
}

const WEEKLY_KEY = "fortune_yt_weekly";

export function getWeeklySnapshots(): WeeklySnapshot[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(WEEKLY_KEY) || "[]");
}

export function saveWeeklySnapshot(snapshot: WeeklySnapshot) {
  const snapshots = getWeeklySnapshots();
  const idx = snapshots.findIndex((s) => s.weekStart === snapshot.weekStart);
  if (idx >= 0) snapshots[idx] = snapshot;
  else snapshots.unshift(snapshot);
  // 最大12週分保持
  const trimmed = snapshots.slice(0, 12);
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(trimmed));
}

// ===== 作業工程表 =====
export type TaskStatus = "not_started" | "in_progress" | "review_waiting" | "reviewing" | "completed" | "rejected";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "未着手",
  in_progress: "作業中",
  review_waiting: "検収待ち",
  reviewing: "検収中",
  completed: "完了",
  rejected: "差し戻し",
};

export interface WorkflowStep {
  name: string;
  status: TaskStatus;
  assignee: string;
  memo: string;
  needsReview: boolean; // 検収が必要な工程
  completedAt?: string;
}

export interface ProductionTask {
  id: string;
  title: string;
  genre: Genre;
  style: Style;
  steps: WorkflowStep[];
  deadline: string;
  publishUrl: string;
  linkedProjectId: string;
  sourceVideoUrl: string; // ネタ元動画URL
  urgent: boolean; // 急ぎフラグ
  createdAt: string;
  updatedAt: string;
}

const TASKS_KEY = "fortune_yt_tasks";
const MEMBERS_KEY = "fortune_yt_members";

export const DEFAULT_STEPS: Omit<WorkflowStep, "assignee">[] = [
  { name: "企画出し", status: "not_started", memo: "", needsReview: false },
  { name: "台本作成", status: "not_started", memo: "", needsReview: true },
  { name: "動画編集", status: "not_started", memo: "", needsReview: true },
  { name: "サムネ作成", status: "not_started", memo: "", needsReview: false },
  { name: "アップロード", status: "not_started", memo: "", needsReview: false },
];

// 工程表にタスクを追加（台本作成ウィザードやAI分析から呼び出し）
export function addTaskFromProject(title: string, genre: Genre, style: Style, projectId: string, sourceVideoUrl?: string): ProductionTask {
  const members = getMembers();
  const task: ProductionTask = {
    id: genId(), title, genre, style,
    steps: DEFAULT_STEPS.map((s) => ({ ...s, assignee: members[0] || "自分" })),
    deadline: "", publishUrl: "", linkedProjectId: projectId,
    sourceVideoUrl: sourceVideoUrl || "", urgent: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  saveTask(task);
  return task;
}

// 工程表のステータスを外部から更新
export function updateTaskStepStatus(projectId: string, stepName: string, status: TaskStatus) {
  const tasks = getTasks();
  const task = tasks.find((t) => t.linkedProjectId === projectId);
  if (!task) return;
  const stepIdx = task.steps.findIndex((s) => s.name === stepName);
  if (stepIdx < 0) return;
  task.steps[stepIdx].status = status;
  if (status === "completed") task.steps[stepIdx].completedAt = new Date().toISOString();
  saveTask(task);
}

export function getTasks(): ProductionTask[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
}

export function saveTask(task: ProductionTask): ProductionTask[] {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  task.updatedAt = new Date().toISOString();
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  return tasks;
}

export function deleteTask(id: string): ProductionTask[] {
  const tasks = getTasks().filter((t) => t.id !== id);
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  return tasks;
}

export function getMembers(): string[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '["自分"]');
}

export function saveMembers(members: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function detectGenre(title: string): Genre {
  let best: Genre = "general";
  let bestCount = 0;
  for (const [genre, keywords] of Object.entries(GENRE_KW) as [Genre, string[]][]) {
    const count = keywords.filter((kw) => title.includes(kw)).length;
    if (count > bestCount) { best = genre; bestCount = count; }
  }
  return best;
}

// ===== Storage Keys =====
const PROJECTS_KEY = "fortune_yt_projects";
const PRESETS_KEY = "fortune_yt_presets";
const HOOKS_KEY = "fortune_yt_hooks";
const CTAS_KEY = "fortune_yt_ctas";
const PERFORMANCE_KEY = "fortune_yt_performance";

// ===== ヘルパー =====
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ===== プロジェクト CRUD =====
export function getProjects(): ScriptProject[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
}

export function saveProject(project: ScriptProject): ScriptProject[] {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  project.updatedAt = new Date().toISOString();
  if (idx >= 0) projects[idx] = project;
  else projects.unshift(project);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return projects;
}

export function deleteProject(id: string): ScriptProject[] {
  const projects = getProjects().filter((p) => p.id !== id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return projects;
}

export function createProject(genre: Genre, style: Style): ScriptProject {
  return {
    id: genId(), genre, style, title: "", titleCandidates: [],
    referenceVideos: [], analyses: [], structureProposal: null,
    generatedScript: "", telopScript: null, thumbnailTexts: [],
    status: "title", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// ===== プリセット CRUD =====
export function getPresets(): ScriptRulePreset[] {
  if (typeof window === "undefined") return DEFAULT_PRESETS;
  const stored = localStorage.getItem(PRESETS_KEY);
  if (!stored) { localStorage.setItem(PRESETS_KEY, JSON.stringify(DEFAULT_PRESETS)); return DEFAULT_PRESETS; }
  return JSON.parse(stored);
}

export function savePreset(preset: ScriptRulePreset) {
  const presets = getPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function getPresetFor(genre: Genre, style: Style): ScriptRulePreset | undefined {
  return getPresets().find((p) => p.genre === genre && p.style === style);
}

const DEFAULT_PRESETS: ScriptRulePreset[] = [
  { id: "lh", genre: "love", style: "healing", name: "恋愛×ヒーリング",
    rules: "冒頭30秒で視聴者の孤独感・寂しさに共感し、希望のメッセージで引き込む。本編は癒しのアファメーション形式で展開。終盤に予祝CTAを入れる。",
    prompt: "あなたは恋愛ヒーリング専門のスピリチュアルYouTuberです。視聴者の心に寄り添い、宇宙からの愛のメッセージを届けてください。",
    targetWordCount: 5000, hookPattern: "この動画に出会ったあなたへ/宇宙からの緊急メッセージ", ctaPattern: "予祝コメント（完了形で書き込み）", notes: "" },
  { id: "le", genre: "love", style: "education", name: "恋愛×教育",
    rules: "冒頭で「知らないと損する」系のフックで好奇心を刺激。本編は具体的なサイン・方法を箇条書きで解説。終盤に次回予告とチャンネル登録CTA。",
    prompt: "あなたは恋愛スピリチュアルの専門家です。視聴者にわかりやすく、具体的な知識と実践方法を教えてください。",
    targetWordCount: 4000, hookPattern: "○○を知らないと損する/○つのサイン", ctaPattern: "チャンネル登録＋次回予告", notes: "" },
  { id: "mh", genre: "money", style: "healing", name: "金運×ヒーリング",
    rules: "お金のブロック解除をテーマに、潜在意識の書き換えを誘導。アファメーション＋ヒーリング形式。",
    prompt: "あなたは金運ヒーリングの専門家です。視聴者のお金に対するブロックを解除し、豊かさの波動に同調させてください。",
    targetWordCount: 5000, hookPattern: "お金のブロックが外れる/豊かさが流れ込む", ctaPattern: "豊かさのアファメーションをコメント", notes: "" },
  { id: "me", genre: "money", style: "education", name: "金運×教育",
    rules: "金運アップの具体的方法や開運行動を解説。数字やデータを交えて説得力を出す。",
    prompt: "あなたは金運・開運の専門家です。具体的で実践的な金運アップの方法を教えてください。",
    targetWordCount: 4000, hookPattern: "金運が上がる人の○つの習慣/○月の金運", ctaPattern: "実践報告コメント＋チャンネル登録", notes: "" },
  { id: "gh", genre: "general", style: "healing", name: "総合×ヒーリング",
    rules: "全体運のヒーリング。チャクラ・エネルギー浄化・スピリチュアル覚醒などのテーマ。穏やかな誘導瞑想形式。",
    prompt: "あなたはスピリチュアルヒーラーです。視聴者のエネルギーを浄化し、高次の存在からのメッセージを届けてください。",
    targetWordCount: 5000, hookPattern: "あなたのエネルギーが変わる/浄化が始まる", ctaPattern: "感想コメント＋高評価", notes: "" },
  { id: "ge", genre: "general", style: "education", name: "総合×教育",
    rules: "スピリチュアルの基礎知識や概念を解説。初心者にもわかりやすく、具体例を多用。",
    prompt: "あなたはスピリチュアルの教育者です。難しい概念をわかりやすく、具体的に教えてください。",
    targetWordCount: 4000, hookPattern: "○○とは？/知らないと危険な○○", ctaPattern: "質問コメント＋チャンネル登録", notes: "" },
];

// ===== フック & CTA DB =====
export function getHooks(): HookEntry[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(HOOKS_KEY) || "[]");
}

export function saveHook(hook: HookEntry) {
  const hooks = getHooks();
  hooks.unshift(hook);
  localStorage.setItem(HOOKS_KEY, JSON.stringify(hooks));
}

export function getHooksFor(genre?: Genre, style?: Style): HookEntry[] {
  return getHooks().filter((h) => (!genre || h.genre === genre) && (!style || h.style === style));
}

export function deleteHook(id: string) {
  const hooks = getHooks().filter((h) => h.id !== id);
  localStorage.setItem(HOOKS_KEY, JSON.stringify(hooks));
}

export function getCTAs(): CTAEntry[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(CTAS_KEY) || "[]");
}

export function saveCTA(cta: CTAEntry) {
  const ctas = getCTAs();
  ctas.unshift(cta);
  localStorage.setItem(CTAS_KEY, JSON.stringify(ctas));
}

export function getCTAsFor(genre?: Genre, style?: Style): CTAEntry[] {
  return getCTAs().filter((c) => (!genre || c.genre === genre) && (!style || c.style === style));
}

export function deleteCTA(id: string) {
  const ctas = getCTAs().filter((c) => c.id !== id);
  localStorage.setItem(CTAS_KEY, JSON.stringify(ctas));
}

// ===== パフォーマンス =====
export function getPerformanceRecords(): PerformanceRecord[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || "[]");
}

export function savePerformanceRecord(record: PerformanceRecord) {
  const records = getPerformanceRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.unshift(record);
  localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(records));
}

export function deletePerformanceRecord(id: string) {
  const records = getPerformanceRecords().filter((r) => r.id !== id);
  localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(records));
}

// 自チャンネルの伸びた企画パターンを取得
export function getTopPerformingPatterns(genre?: Genre): PerformanceRecord[] {
  return getPerformanceRecords()
    .filter((r) => !genre || r.genre === genre)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
}
