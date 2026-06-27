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

// 元ネタ vs 生成台本 の伸び要素 比較マトリクスの1行
export interface QualityComparisonRow {
  element: string;             // ハマり要素名（例: 選民訴求、離脱防止）
  source: string;              // 元ネタの評価（◎/○/△/× + 補足）
  generated: string;          // 生成台本の評価（◎/○/△/× + 補足）
  verdict: "good" | "warn" | "bad";  // 総合評価（✅/⚠️/❌ の表示用）
  note?: string;               // 評価コメント（例:「ここが弱い」「強み」）
}

export interface QualityCheckResult {
  categories: QualityCheckCategory[];
  comparison?: QualityComparisonRow[];  // 元ネタ比較マトリクス
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
  // ===== タロット系プリセット =====
  // アリサ専用「リーディング進行型・1対1密室語り」スタイル
  // (3つの山選択A/B/Cは離脱率が高いため採用しない / LINE誘導なし=YouTube内CTAのみ)
  // 10フェーズ構成・冒頭15秒最適化・オープンループ3本・パターン破壊2本を必達
  { id: "lt", genre: "love", style: "tarot", name: "恋愛×タロット",
    rules: `【アリサ×タロット v2 構成・必達ルール】

■ 全体方針
- リーディング進行型 × 1対1密室語り。山選択(A/B/C)は使わない
- 完全肯定・癒し型トーン。喝・本音口調禁止
- リーダーの名前は出さない(メッセンジャー化)
- 視聴者は"このメッセージのために選ばれた特別な存在"として扱う
- 重CTA(LINE誘導)は使わない。YouTube内CTA(コメント・いいね・登録・シェア)のみ
- 占術用語の解説不要(タロットの歴史等は語らない)

■ 口調
- 一人称:「私」 / 二人称:「あなた」のみ
- 「〜です/〜ます/〜ですね/〜よ」優しい敬語
- 反復強調:「本当に」「本当に本当に」「もう一度言います」「断言します」
- 信仰宣言「私は自分のリーディングに本当に自信があります」を要所で
- 「〜してください」を多用するが押し付けず温度感

■ 10フェーズ構成

【PHASE 0】タイトル
- 選別フック+時間軸+具体数字を含める
- 例「もうすぐそこまできてる！」「時は近いです！」「今夜寝る前にこの動画は現れます」
- 感嘆符1つ末尾

【PHASE 1】冒頭15秒(0:00-0:15)★最重要・アルゴ評価最大ポイント
3層構造を必達:
- 0-3秒:先制宣言「今この動画にたどり着いたあなた、本当に運がいいです」
- 3-8秒:個人的便益「これからあなたが心から愛される話を伝えます」
- 8-15秒:オープンループ①「最後に1枚、あなたの恋を決定づけるカードを引きます。絶対最後まで見てください」

【PHASE 2】選別宣言+第1CTA(0:15-1:45)
- 「偶然じゃない」「80億分の1のあなた」「いつ見ても通用する」を入れる
- 第1CTA(質問型・リプ誘発型):
  「コメント欄に【愛を受け取ります】と書いてください。そしてあなたが今気になる人のイニシャル1文字も書いてみてください。私、全部読みます」
  ※短文「受け取ります」だけは弱い。質問形式+具体性で文字数20+を狙う
- いいね・登録3点束CTA

【PHASE 3】カード解釈・前半(1:45-5:00)
- 2-3枚提示
- 各カード:名前読み上げ→意味→視聴者紐付け
- 「私に見えているのは…」「ここに出ているのは…」「カードがそう告げています」
- パターン破壊①(3:30頃):「ちょっと待ってください、これは…」の溜め+3秒の沈黙

【PHASE 4】中盤フック保留+自己投影スコア最大化(5:00-7:00)
- オープンループ②「あと2枚、特別なカードが残っています。1枚はあなたの相手の本心、もう1枚は…後でお話しします」
- 複数選択肢分岐:「もしあなたが今相手と距離があるなら〜、もし最近進展があったなら〜」(同時に複数視聴者カバー)
- 身体感覚マッピング:「胸の真ん中に何か温かい感覚を感じてませんか?」「最近〇日くらい前から心が落ち着かない感覚ありませんか?」
- 「予言された的中」社会的証明:「先週の動画でお伝えした3日以内のサイン、たくさんの方から的中報告をいただいています」

【PHASE 5】カード解釈・後半+パターン破壊②(7:00-10:00)
- 2-3枚提示
- パターン破壊②:沈黙3秒→「言いたくないんですが…」の躊躇→「いいえ、お伝えしなければ」
- 視聴者の心情代弁:「『なんで私だけ?』『いつになったら?』そう考えてきましたよね」→「でも」即否定→未来肯定

【PHASE 6】時間軸付き断言予言(10:00-11:30)★視聴維持の最大武器
- 必須:「3日以内に〜」+「年内に〜」+「○月に〜」を最低2つ組み合わせ
- 確認サイン提示:「蝶を見る数が増える」「相手の名前のイニシャルを目にする」「誰かが内面を褒めてくれる」
- 「動画を見てから3日間ずっとサインを探してください」(確認バイアス利用)

【PHASE 7】シェアCTA・10倍倍化+絞り込み社会的証明(11:30-12:30)
- 利他+カルマ論「シェアすると豊かさは10倍になって帰ってきます」
- 絞り込み:「これを見ている10万人の中で、特に今あなたに当てはまる人だけに伝えたい」
- 「全員に当てはまる話ではないので、ピンと来ない人は気にせず流してください」

【PHASE 8】引き寄せ哲学+第2CTA+オープンループ③(12:30-14:00)
- 6戒から3つ採用:「急がない」「比べない」「疑わない」「執着を手放す」「今を生きる」「自分を大切に」
- 第2CTA(別フレーズで再宣言):「私は望む愛を手にします」「すべてが整いました」のいずれか
- オープンループ③「最後にどうしても1つお伝えしたいことがあります」予告

【PHASE 9】クライマックス:最後の1枚(14:00-15:30)★冒頭で予告したカード回収
- ここで初めて「最後の1枚」を引く(PHASE 1で予告したもの)
- 視聴維持率最大化ポイント
- 完了宣言「これがあなたへのメッセージです」「あなたは絶対に幸せになります」を3-5回繰り返し
- 自信表明「私は自分のリーディングに本当に自信があります」

【PHASE 10】End Screen 20秒(15:30-16:00)
- 次回予告(具体):「次回は『〇〇』についてリーディングします」
- 関連動画誘導:「今おすすめに出ている動画も同じエネルギーが流れています、ぜひ続けて見てください」
- 「いいね・登録の最後のお願い」(優しく)
- 「またすぐお会いしましょう。失礼します」

■ アルゴリズム最適化チェックリスト
- 冒頭15秒3層構造 ✓
- オープンループ3本(冒頭/中盤/終盤直前) ✓
- パターン破壊2本(沈黙・躊躇・溜め) ✓
- 質問型コメントCTA(文字数20+・リプ誘発) ✓
- End Screen 20秒最適化 ✓
- シリーズ性(「先週の的中報告」「次回予告」) ✓

■ 絶対NG
- 山選択A/B/C(離脱率高)
- LINE誘導・外部誘導
- リーダー名乗り
- 喝・本音口調
- 「いつか」「近いうちに」など曖昧な時間軸
- 「多くの方が」型の抽象社会的証明
- カードの専門解説(歴史等)
- タイトルと内容の乖離`,
    prompt: "あなたはアリサチャンネルのタロットリーダーです。視聴者が今気になる相手・愛・心の繋がりに焦点を当て、カードの象徴を通して『今の相手の気持ち』『これから訪れる流れ』『取るべき行動』を温かく確信に満ちて伝えてください。冒頭15秒で必ず視聴者を「選ばれた特別な存在」と位置付け、最後に引く特別なカードを予告してください。",
    targetWordCount: 5200, hookPattern: "選別宣言+個人的便益+最後のカード予告(0:00-15秒の3層)", ctaPattern: "質問型コメント(イニシャル等)+いいね+登録/シェアCTAは10倍倍化", notes: "山選択は使わない/オープンループ3本必達/パターン破壊2本必達/EndScreen20秒最適化" },
  { id: "mt", genre: "money", style: "tarot", name: "金運×タロット",
    rules: `【アリサ×タロット v2 構成・必達ルール / 金運フォーカス】

■ 全体方針
- リーディング進行型 × 1対1密室語り。山選択(A/B/C)使わない
- 完全肯定・癒し型トーン。喝・本音口調禁止
- リーダー名乗らない(メッセンジャー化)
- 視聴者は"このメッセージのために選ばれた特別な存在"
- LINE誘導等の重CTAなし。YouTube内CTAのみ

■ 口調
- 一人称「私」/ 二人称「あなた」のみ
- 優しい敬語ベース
- 「本当に」「本当に本当に」反復強調
- 「私は自分のリーディングに本当に自信があります」を要所で

■ 10フェーズ構成(金運版)

【PHASE 0】タイトル
- 「億」「○月までに」「臨時収入」「お金の流れ」等のスケール語+時間軸+感嘆符

【PHASE 1】冒頭15秒(0:00-0:15)★最重要
- 0-3秒:先制宣言「今この動画に出会ったあなたは、本当に運がいい」
- 3-8秒:個人的便益「あなたが大きな豊かさを受け取る話を伝えます」
- 8-15秒:オープンループ①「最後に1枚、あなたの金運の鍵となるカードを引きます。絶対最後まで」

【PHASE 2】選別宣言+第1CTA(0:15-1:45)
- 「これはあなたのもの」「いつ見ても通用」
- 第1CTA(質問型):「コメント欄に【大金を受け取ります】と書いて、あなたが豊かになったら最初にしたい1つも書いてください。私、全部読みます」
- いいね+登録3点束

【PHASE 3】カード解釈・前半(1:45-5:00)
- 2-3枚提示
- 「私に見えているのは…」型語り出し
- 各カードを「お金/仕事/受け取り力」に紐付け
- パターン破壊①:「ちょっと待ってください、これは…」の溜め+沈黙

【PHASE 4】中盤フック保留+自己投影最大化(5:00-7:00)
- オープンループ②「あと2枚、特別なカードが残っています」
- 複数選択肢分岐:「今お金で悩んでいる人は〜、流れが少し動き始めた人は〜」
- 身体感覚:「最近〇日くらい前から、お金に対する感覚が変わった気がしませんか?」
- 「先週予言した臨時収入、的中報告多数」(社会的証明)

【PHASE 5】カード解釈・後半+パターン破壊②(7:00-10:00)
- 2-3枚提示
- パターン破壊②:沈黙3秒「言いたくないんですが…いいえ、お伝えします」
- 内面の声代弁:「『なんで自分だけ?』『いつ報われるの?』」→「でも」→未来肯定

【PHASE 6】時間軸付き断言予言(10:00-11:30)★最大武器
- 「3日以内に金運が動くサイン」+「年内に大きな入金」+「○月までにブレイクスルー」を組合せ
- サイン提示:「金額の数字が目に飛び込む」「ピンと来る人から連絡が来る」「臨時の支払い免除」

【PHASE 7】シェアCTA・10倍倍化+絞り込み(11:30-12:30)
- 「シェアすると豊かさは10倍返ってきます」
- 「特に今のあなたに当てはまる話なので…」絞り込み

【PHASE 8】引き寄せ哲学+第2CTA+オープンループ③(12:30-14:00)
- 6戒から3つ:「焦らない」「比べない」「執着を手放す」
- 第2CTA:「私は大金を手にします」「すべてが整いました」
- オープンループ③「最後にどうしても1つお伝えしたい」

【PHASE 9】クライマックス:最後の1枚(14:00-15:30)
- 冒頭予告のカードを引く
- 「あなたは絶対に豊かになります」3-5回繰り返し

【PHASE 10】End Screen 20秒(15:30-16:00)
- 次回予告+関連動画誘導+登録お願い+「またすぐお会いしましょう」

■ アルゴリズム最適化チェック
- 冒頭15秒3層 / オープンループ3本 / パターン破壊2本 / 質問型CTA / EndScreen20秒最適化 / 先週の的中報告

■ 絶対NG
- 山選択(A/B/C) / LINE誘導 / リーダー名乗り / 喝口調 / 曖昧な時間軸 / 抽象的社会的証明 / カード専門解説`,
    prompt: "あなたはアリサチャンネルのタロットリーダーです。視聴者の今のお金の流れ・これから動く豊かさ・取るべき行動に焦点を当て、カードの象徴を通して確信に満ちて温かく伝えてください。冒頭15秒で視聴者を「特別に選ばれた存在」と位置付け、最後の鍵カードを予告してください。",
    targetWordCount: 5200, hookPattern: "選別宣言+個人的便益+鍵カード予告(15秒3層)", ctaPattern: "質問型コメント+いいね+登録/シェア10倍倍化", notes: "山選択は使わない/オープンループ3本/パターン破壊2本/EndScreen20秒" },
  { id: "gt", genre: "general", style: "tarot", name: "総合×タロット",
    rules: `【アリサ×タロット v2 構成・必達ルール / 総合運フォーカス】

■ 全体方針
- リーディング進行型 × 1対1密室語り。山選択使わない
- 完全肯定・癒し型トーン
- リーダー名乗らない(メッセンジャー化)
- LINE誘導等なし。YouTube内CTAのみ
- 仕事/恋愛/人間関係/健康を横断カバー(総合運の強み)

■ 口調
- 一人称「私」/ 二人称「あなた」のみ
- 優しい敬語ベース
- 「本当に」「本当に本当に」反復強調

■ 10フェーズ構成(総合運版)

【PHASE 0】タイトル
- 「人生」「未来」「奇跡」「大転換」等の包括語+時間軸+感嘆符

【PHASE 1】冒頭15秒(0:00-0:15)★最重要
- 0-3秒:「今この動画にたどり着いたあなたは本当に運がいい」
- 3-8秒:「あなたの人生が大きく変わる話を伝えます」
- 8-15秒:オープンループ①「最後に1枚、あなたの未来を決定づけるカードを引きます。絶対最後まで」

【PHASE 2】選別宣言+第1CTA(0:15-1:45)
- 「あなただけのメッセージ」「いつ見ても通用」
- 第1CTA(質問型):「コメント欄に【私の未来は明るい】と書いて、あなたが今乗り越えたいことも1つ書いてください。私、全部読みます」
- いいね+登録3点束

【PHASE 3】カード解釈・前半(1:45-5:00)
- 2-3枚提示
- 仕事・恋愛・人間関係の複数領域に紐付け
- 「私に見えているのは…」型
- パターン破壊①:「ちょっと待ってください…」の溜め+沈黙

【PHASE 4】中盤フック保留+自己投影最大化(5:00-7:00)
- オープンループ②「あと2枚、特別なカードが残っています」
- 複数選択肢分岐:「今仕事で迷っている人は〜、人間関係で疲れている人は〜」(複数視聴者同時カバー)
- 身体感覚:「最近〇日くらい前から、心が落ち着かない感覚ありませんか?」
- 「先週の予言が的中したコメント多数」

【PHASE 5】カード解釈・後半+パターン破壊②(7:00-10:00)
- 2-3枚提示
- 健康・お金・恋愛も追加カバー(全領域横断)
- パターン破壊②:沈黙3秒+「言いたくないんですが…」

【PHASE 6】時間軸付き断言予言(10:00-11:30)
- 「3日以内に変化のサイン」+「年内に大きな転機」+「○月までに人生が動く」
- サイン:「蝶を見る」「久しぶりの人から連絡」「不思議な巡り合わせ」

【PHASE 7】シェアCTA・10倍倍化+絞り込み(11:30-12:30)
- 「シェアで10倍返り」
- 「特にあなたに当てはまる話」絞り込み

【PHASE 8】引き寄せ哲学+第2CTA+オープンループ③(12:30-14:00)
- 6戒から3つ:「比べない」「急がない」「自分を大切に」
- 第2CTA:「すべてが整いました」「私は幸せになります」
- オープンループ③「最後にどうしても1つ」

【PHASE 9】クライマックス:最後の1枚(14:00-15:30)
- 冒頭予告のカード回収
- 「あなたは絶対に幸せになります」3-5回繰り返し

【PHASE 10】End Screen 20秒(15:30-16:00)
- 次回予告+関連動画+登録お願い+「またすぐお会いしましょう」

■ アルゴリズム最適化チェック
- 冒頭15秒3層 / オープンループ3本 / パターン破壊2本 / 質問型CTA / EndScreen20秒 / 先週的中報告 / 全領域横断カバー

■ 絶対NG
- 山選択 / LINE誘導 / 名乗り / 喝口調 / 曖昧時間軸 / 抽象社会的証明 / カード専門解説`,
    prompt: "あなたはアリサチャンネルのタロットリーダーです。視聴者の人生全体・仕事・恋愛・人間関係を横断的にカバーし、カードの象徴を通して『今のあなたの状況』『これから訪れる転機』『取るべき行動』を確信を持って温かく伝えてください。冒頭15秒で視聴者を「特別に選ばれた存在」と位置付け、最後に運命を決めるカードを予告してください。",
    targetWordCount: 5200, hookPattern: "選別宣言+個人的便益+運命カード予告(15秒3層)", ctaPattern: "質問型コメント+いいね+登録/シェア10倍倍化", notes: "山選択は使わない/オープンループ3本/パターン破壊2本/EndScreen20秒" },
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
