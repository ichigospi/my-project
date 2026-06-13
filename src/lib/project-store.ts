// 台本プロジェクト管理 & 関連データストア

// ===== ジャンル・スタイル =====
export type Genre = "love" | "money" | "general";
export type Style = "healing" | "education" | "tarot";

export const GENRE_LABELS: Record<Genre, string> = {
  love: "恋愛運",
  money: "金運",
  general: "総合運",
};

export const STYLE_LABELS: Record<Style, string> = {
  healing: "ヒーリング系",
  education: "教育系",
  tarot: "タロット系",
};

// ===== 台本プロジェクト =====
export type ReviewStatus = "none" | "pending" | "approved" | "rejected";

// 品質チェック結果（step6完了後の台本品質評価）
export type QualityCheckStatus = "pass" | "warn" | "fail";

export interface QualityCheckItem {
  name: string;
  status: QualityCheckStatus;
  comment: string;
  suggestion?: string;
}

export interface QualityCheckCategory {
  name: string;
  passed: boolean;
  items: QualityCheckItem[];
}

export interface QualityCheckResult {
  categories: QualityCheckCategory[];
  overallScore: number;        // 0-10
  topPriority: string;         // 最優先で直すべきポイント
  checkedAt: string;
  scriptHash?: string;         // チェック時の台本ハッシュ（変更検知用）
}

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
  channelId?: string;
  // 企画チェック（step1〜2 後にいつでも依頼可能）
  reviewStatus?: ReviewStatus;
  reviewNote?: string;
  // 台本チェック（step6 完了後のみ依頼可能）
  scriptReviewStatus?: ReviewStatus;
  scriptReviewNote?: string;
  // 台本品質チェック結果（step6 完了後）
  qualityCheckResult?: QualityCheckResult;
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
  channelId?: string;
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
  sourceViews?: number;     // 参考動画の再生数
  tags: string[];
  channelId?: string;
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
  sourceViews?: number;
  tags: string[];
  channelId?: string;
  createdAt: string;
}

export interface ThumbnailWordEntry {
  id: string;
  word: string;           // サムネに使われているワード
  genre: Genre;
  style: Style;
  score: number;
  sourceVideo: string;
  sourceChannel: string;
  sourceViews?: number;
  channelId?: string;
  createdAt: string;
}

export interface TitleEntry {
  id: string;
  title: string;           // 動画タイトル
  genre: Genre;
  style: Style;
  score: number;
  sourceVideo: string;     // 元の動画タイトル（同じ場合あり）
  sourceChannel: string;
  sourceViews?: number;
  channelId?: string;
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
  channelId?: string;
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
  internalChannelId?: string; // 内部のMyChannel.id（メインチャンネル/金華 等の識別）
  channelId: string;          // YouTubeのチャンネルID (UCxxx)
  channelName: string;
  videos: MyChannelVideo[];
  lastFetched: string;
}

const MY_CHANNEL_KEY = "fortune_yt_my_channel";                  // 旧singleton
const MY_CHANNEL_DATA_LIST_KEY = "fortune_yt_my_channel_data_list"; // 新list

// 一覧取得（旧singletonがあれば自動でlistに移行）
export function getMyChannelDataList(): MyChannelData[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(MY_CHANNEL_DATA_LIST_KEY);
  if (stored) return JSON.parse(stored);
  // 移行: 旧singletonがあれば最初のMyChannelに紐付けて配列化
  const old = localStorage.getItem(MY_CHANNEL_KEY);
  if (old) {
    const oldData: MyChannelData = JSON.parse(old);
    const myChannels = JSON.parse(localStorage.getItem("fortune_yt_my_channels") || "[]");
    const firstChId = myChannels[0]?.id || "";
    const list: MyChannelData[] = [{ ...oldData, internalChannelId: firstChId }];
    localStorage.setItem(MY_CHANNEL_DATA_LIST_KEY, JSON.stringify(list));
    return list;
  }
  return [];
}

// 内部チャンネルIDで取得
export function getMyChannelDataByChannel(internalChannelId: string): MyChannelData | null {
  const list = getMyChannelDataList();
  // チャンネル指定があればそれ、無ければ未紐付け（internalChannelId空）のものを返す
  return (
    list.find((d) => d.internalChannelId === internalChannelId) ||
    (internalChannelId ? null : list.find((d) => !d.internalChannelId)) ||
    null
  );
}

// 保存（internalChannelIdをキーにupsert）
export function saveMyChannelData(data: MyChannelData) {
  if (typeof window === "undefined") return;
  const list = getMyChannelDataList();
  const idx = list.findIndex((d) => d.internalChannelId === data.internalChannelId);
  if (idx >= 0) list[idx] = data;
  else list.push(data);
  localStorage.setItem(MY_CHANNEL_DATA_LIST_KEY, JSON.stringify(list));
}

// 後方互換: 旧API
export function getMyChannel(): MyChannelData | null {
  return getMyChannelDataList()[0] || null;
}

export function saveMyChannel(data: MyChannelData) {
  saveMyChannelData(data);
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
  channelId?: string;
}

const ANALYSIS_LOG_KEY = "fortune_yt_analysis_log";

export function getAnalysisLogs(): AnalysisLog[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(ANALYSIS_LOG_KEY) || "[]");
}

export function getAnalysisLogsByChannel(channelId: string): AnalysisLog[] {
  return getAnalysisLogs().filter((l) => !l.channelId || l.channelId === channelId);
}

export function saveAnalysisLog(log: AnalysisLog) {
  const logs = getAnalysisLogs();
  logs.unshift(log);
  // チャンネル毎に最大10件保持
  const byChannel = new Map<string, AnalysisLog[]>();
  for (const l of logs) {
    const k = l.channelId || "";
    if (!byChannel.has(k)) byChannel.set(k, []);
    byChannel.get(k)!.push(l);
  }
  const trimmed: AnalysisLog[] = [];
  for (const list of byChannel.values()) trimmed.push(...list.slice(0, 10));
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
  channelId?: string;
}

const WEEKLY_KEY = "fortune_yt_weekly";

export function getWeeklySnapshots(): WeeklySnapshot[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(WEEKLY_KEY) || "[]");
}

export function getWeeklySnapshotsByChannel(channelId: string): WeeklySnapshot[] {
  return getWeeklySnapshots().filter((s) => !s.channelId || s.channelId === channelId);
}

export function saveWeeklySnapshot(snapshot: WeeklySnapshot) {
  const snapshots = getWeeklySnapshots();
  const idx = snapshots.findIndex(
    (s) => s.weekStart === snapshot.weekStart && (s.channelId || "") === (snapshot.channelId || "")
  );
  if (idx >= 0) snapshots[idx] = snapshot;
  else snapshots.unshift(snapshot);
  // チャンネル毎に最大12週分保持
  const byChannel = new Map<string, WeeklySnapshot[]>();
  for (const s of snapshots) {
    const k = s.channelId || "";
    if (!byChannel.has(k)) byChannel.set(k, []);
    byChannel.get(k)!.push(s);
  }
  const trimmed: WeeklySnapshot[] = [];
  for (const list of byChannel.values()) trimmed.push(...list.slice(0, 12));
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
  channelId?: string;
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
export function addTaskFromProject(title: string, genre: Genre, style: Style, projectId: string, sourceVideoUrl?: string, channelId?: string): ProductionTask | null {
  // 同じプロジェクトIDの工程が既にあればスキップ
  const existing = getTasks();
  const dup = existing.find((t) => t.linkedProjectId === projectId);
  if (dup) return dup;

  const members = getMembers();
  const task: ProductionTask = {
    id: genId(), title, genre, style,
    steps: DEFAULT_STEPS.map((s) => ({ ...s, assignee: members[0] || "自分" })),
    deadline: "", publishUrl: "", linkedProjectId: projectId,
    sourceVideoUrl: sourceVideoUrl || "", urgent: false,
    channelId: channelId || "",
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

export function createProject(genre: Genre, style: Style, channelId?: string): ScriptProject {
  return {
    id: genId(), genre, style, title: "", titleCandidates: [],
    referenceVideos: [], analyses: [], structureProposal: null,
    generatedScript: "", telopScript: null, thumbnailTexts: [],
    status: "title", channelId: channelId || "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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

export function deletePreset(id: string) {
  const presets = getPresets().filter((p) => p.id !== id);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// チャンネル別プリセット取得（channelIdが空のもの=デフォルト も含む）
export function getPresetsByChannel(channelId: string): ScriptRulePreset[] {
  return getPresets().filter((p) => !p.channelId || p.channelId === channelId);
}

export function getPresetFor(genre: Genre, style: Style, channelId?: string): ScriptRulePreset | undefined {
  const presets = getPresets();
  // チャンネル指定がある場合は、そのチャンネルのもの優先 → 共通(channelIdなし)にフォールバック
  if (channelId) {
    const own = presets.find((p) => p.genre === genre && p.style === style && p.channelId === channelId);
    if (own) return own;
  }
  return presets.find((p) => p.genre === genre && p.style === style && !p.channelId);
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
  // ===== タロット系プリセット（複数の山から視聴者が直感で選ぶスタイル）=====
  { id: "lt", genre: "love", style: "tarot", name: "恋愛×タロット",
    rules: "冒頭でカードをシャッフルして3つの山(A/B/C)を提示し、視聴者が直感で1つを選ぶ構成。各山ごとに展開を分け、引いたカードのキーワードを読み解きながら『今の相手の気持ち』『これから訪れる流れ』『取るべき行動』を伝える。間とテンポを大切にし、視聴者がカードと向き合う時間を作る。山ごとのパートはセクションとして明確に区切り、視聴者が自分の選んだ山だけを見やすくする。",
    prompt: "あなたはタロットリーダーです。視聴者が直感で選んだ山のカードを通して、今の相手の気持ち・これから訪れる流れ・取るべき行動を、カードの象徴とリンクさせて温かく伝えてください。",
    targetWordCount: 4500, hookPattern: "今のあなたに必要なメッセージ/直感で選んでください 3つの山", ctaPattern: "選んだ山(A/B/C)をコメント＋チャンネル登録", notes: "山選択のCTAは「選んだ山のアルファベット1文字をコメント」と具体的に指定" },
  { id: "mt", genre: "money", style: "tarot", name: "金運×タロット",
    rules: "冒頭でカードをシャッフルして3つの山(A/B/C)を提示し、視聴者が直感で1つを選ぶ構成。各山ごとに引いたカードを読み解き、『今のお金の流れ』『これから動く金運』『取るべき行動・浄化』を伝える。山ごとのパートを明確に区切り、選んだ山だけを視聴する人にも完結する構造にする。",
    prompt: "あなたはタロットリーダーです。視聴者が直感で選んだ山のカードを通して、今のお金の流れ・これから動く金運・取るべき行動を、カードの象徴とリンクさせて伝えてください。",
    targetWordCount: 4500, hookPattern: "あなたの金運を視ます/3つの山から直感で選んでください", ctaPattern: "選んだ山(A/B/C)をコメント＋チャンネル登録", notes: "" },
  { id: "gt", genre: "general", style: "tarot", name: "総合×タロット",
    rules: "冒頭でカードをシャッフルして3つの山(A/B/C)を提示し、視聴者が直感で1つを選ぶ構成。各山ごとに引いたカードを読み解き、『今のあなたの全体運』『これから訪れる転機』『取るべき行動』を伝える。山ごとのパートを明確に区切る。",
    prompt: "あなたはタロットリーダーです。視聴者が直感で選んだ山のカードを通して、今の全体運・これから訪れる転機・取るべき行動を、カードの象徴とリンクさせて伝えてください。",
    targetWordCount: 4500, hookPattern: "今のあなたへのメッセージ/3つの山から直感で選んでください", ctaPattern: "選んだ山(A/B/C)をコメント＋チャンネル登録", notes: "" },
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

export function getHooksFor(genre?: Genre, style?: Style, channelId?: string): HookEntry[] {
  return getHooks().filter((h) =>
    (!genre || h.genre === genre) &&
    (!style || h.style === style) &&
    (!channelId || !h.channelId || h.channelId === channelId)
  );
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

// ===== サムネワード =====
const THUMBNAIL_WORDS_KEY = "fortune_yt_thumbnail_words";

export function getThumbnailWords(): ThumbnailWordEntry[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(THUMBNAIL_WORDS_KEY) || "[]");
}

export function saveThumbnailWord(entry: ThumbnailWordEntry) {
  const items = getThumbnailWords();
  items.unshift(entry);
  localStorage.setItem(THUMBNAIL_WORDS_KEY, JSON.stringify(items));
}

export function deleteThumbnailWord(id: string) {
  const items = getThumbnailWords().filter((i) => i.id !== id);
  localStorage.setItem(THUMBNAIL_WORDS_KEY, JSON.stringify(items));
}

// ===== タイトル =====
const TITLES_KEY = "fortune_yt_titles";

export function getTitles(): TitleEntry[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(TITLES_KEY) || "[]");
}

export function saveTitle(entry: TitleEntry) {
  const items = getTitles();
  items.unshift(entry);
  localStorage.setItem(TITLES_KEY, JSON.stringify(items));
}

export function deleteTitle(id: string) {
  const items = getTitles().filter((i) => i.id !== id);
  localStorage.setItem(TITLES_KEY, JSON.stringify(items));
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

export function getPerformanceRecordsByChannel(channelId: string): PerformanceRecord[] {
  return getPerformanceRecords().filter((r) => !r.channelId || r.channelId === channelId);
}

// ===== チャンネル別フィルター =====
export function getProjectsByChannel(channelId: string): ScriptProject[] {
  const filtered = getProjects().filter((p) => !p.channelId || p.channelId === channelId);
  return sortProjectsByReview(filtered);
}

// レビュー状態優先で並び替え:
//   1) rejected (差し戻し) を最上部
//   2) pending (チェック待ち)
//   3) その他（none / approved）
// 同優先度内は updatedAt 降順。
// 企画チェック・台本チェックの両方を見て、どちらかが該当すれば優先する。
function projectReviewPriority(p: ScriptProject): number {
  const statuses = [p.reviewStatus, p.scriptReviewStatus];
  if (statuses.includes("rejected")) return 0;
  if (statuses.includes("pending")) return 1;
  return 2;
}

export function sortProjectsByReview(projects: ScriptProject[]): ScriptProject[] {
  return [...projects].sort((a, b) => {
    const pa = projectReviewPriority(a);
    const pb = projectReviewPriority(b);
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.updatedAt || 0).getTime();
    const tb = new Date(b.updatedAt || 0).getTime();
    return tb - ta;
  });
}

export function getTasksByChannel(channelId: string): ProductionTask[] {
  return getTasks().filter((t) => !t.channelId || t.channelId === channelId);
}

export function getHooksByChannel(channelId: string): HookEntry[] {
  return getHooks().filter((h) => !h.channelId || h.channelId === channelId);
}

export function getCTAsByChannel(channelId: string): CTAEntry[] {
  return getCTAs().filter((c) => !c.channelId || c.channelId === channelId);
}

export function getThumbnailWordsByChannel(channelId: string): ThumbnailWordEntry[] {
  return getThumbnailWords().filter((w) => !w.channelId || w.channelId === channelId);
}

export function getTitlesByChannel(channelId: string): TitleEntry[] {
  return getTitles().filter((t) => !t.channelId || t.channelId === channelId);
}
