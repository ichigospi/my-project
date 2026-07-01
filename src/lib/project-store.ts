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

// 分割出力の1パート
export interface ScriptSegment {
  script: string;
  qualityCheckResult?: QualityCheckResult;
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
  // 分割出力（1〜3回）。splitCount>1 のとき scriptSegments にパートを保持し、
  // generatedScript はその結合結果。各パートごとに品質チェック・修正ができる。
  splitCount?: number;
  scriptSegments?: ScriptSegment[];
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
  const saved: ScriptRulePreset[] = JSON.parse(stored);
  // DEFAULT_PRESETS に後から追加された共有プリセット(タロット等)を補完する。
  // 既存ユーザーは古い6プリセットだけ localStorage に持っているため、
  // 共有プリセット(channelId なし)で localStorage に無い id を足す。
  const savedIds = new Set(saved.map((p) => p.id));
  const missingDefaults = DEFAULT_PRESETS.filter((d) => !savedIds.has(d.id));
  if (missingDefaults.length > 0) {
    const merged = [...saved, ...missingDefaults];
    localStorage.setItem(PRESETS_KEY, JSON.stringify(merged));
    return merged;
  }
  return saved;
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

// タロット系の共通構成（ローラン式リーディング進行型・全ジャンル対応）
// 恋愛/金運/総合 の3プリセットで土台を共有し、各プリセットでジャンル該当部分を強調する
const TAROT_BASE_RULES = `# タロット 台本構成（ローラン式リーディング進行型・全ジャンル対応）

## 大原則
- カードを5枚、順番に引きながら読み解く「リーディング進行型」
- ヒーリング音楽パート・瞑想・呼吸誘導・アファメーション連打は使わない（あれはヒーリング系の構成）
- 山選択(A/B/C)は使わない。最初から最後まで1人の視聴者に向けた単一リーディング
- 構成（5枚の役割・実力見せ・離脱防止・終盤の鑑定導線）は全ジャンル共通。中身の語彙と読み解き対象だけ選択ジャンルに合わせる
- ジャンルの世界観・訴求は混同させない（恋愛の顧客心理を金運・開運に持ち込まない。逆も同様）
- 重CTAは無料霊視タロット鑑定の一本（守護画像等の特典は使わない）
- リーディングの肝：先に「祝福・未来」を語り、引いたカードが後追いでそれを証明する流れにする
- 無料鑑定では「お相手の本音」や「波動を整えること」は行わない（有料鑑定の領域）。無料の役割は、あなたの波動の状態と詳しい状況を視て、今のあなたに必要な守護天使様からのメッセージを届けるところまで

## 【最優先・必須】カードの正確なリーディング
- 実際に出た（指定された）カードの正位置・逆位置の正統な意味を必ず正確に読み解くこと。カードの一般的な意味から逸脱した出鱈目なリーディングは禁止
- その上で、本台本構成（5枚の役割・順番・終盤の鑑定導線）に必ず従ってリーディングを展開すること。「カードの正確な意味」と「台本構成」は両立必須であり、どちらかを無視してはいけない
- カード名が指定されている場合は、そのカードの意味を土台にして、構成上の各カードの役割（理想の未来／五感の具体化／常識破壊／強さ＋方向性／もう来てる）へ自然に接続する
- カードの意味と矛盾する断定（例：明確に凶のカードを根拠なく「最高の結果です」と言い切る等）はしない。逆位置・課題のカードは3枚目の「常識破壊＋仮想敵批判」など構成上の役割に沿って前向きに転換して読む

## 【必須】表現の品質（禁止事項）
- 日本語として不自然・意味の通らない表現は絶対に使わない
- 一般的に使われない奇妙な体感表現は禁止（例：「お腹が締め付けられる」など）。共感を狙う身体表現は、多くの人が実感として分かるものだけを使う（例：「胸がきゅっと苦しくなる」「目の奥が熱くなる」等の自然な表現）
- 共感を得にくい・的外れな訴求、視聴者がピンとこない比喩や言い回しは使わない
- 誇張しすぎて嘘くさくなる表現、テンプレ的で心に響かない常套句の多用も避ける
- 迷ったら「実際にその悩みを持つ人が読んで、自然に頷けるか」を基準に、不自然なら別の言葉に言い換える

## 全編に散りばめる「アリサの実力見せ」テクニック（要所で複数回）
- 予知の的中演出：「このカードが出ることは、引く前から分かっていました」
- チャネリングのPR：「今、守護天使様がこのカードをあなたのために運んでくださいました」
- カードと発言の一致：「私が今お話ししたこと、そのままカードに出ているでしょう」
- これらを各カードの合間に最低1回は挟み「この人は本物だ」という信頼を積み上げる

## 5枚の読み解き対象（ジャンル別。選択ジャンルの列のみ使う）
| カード | 恋愛(不倫/音信不通/復縁軸) | 金運 | 総合運(アリサ流の引き寄せ軸) |
|---|---|---|---|
| 1枚目 理想の未来 | 安心して愛される関係の到来 | 豊かさ・臨時収入が流れ込む未来 | 頑張らなくてもありのままで願いが叶う未来 |
| 2枚目 五感の具体化 | 追いかけなくても大切にされる日々の安心感 | お金が入った時の生活・余裕・景色 | 力を抜いた毎日に望みが向こうから来る感覚 |
| 3枚目 常識破壊(仮想敵批判) | 「諦めろ/執着を手放せ」と言う占い師は逆、その縁はまだ動く | 「お金に縁がない体質」は思い込み | 「努力・我慢しないと叶わない」は思い込み |
| 4枚目 強さ＋方向性教育 | あなたは愛される人＋恋の進め方を間違えない | 受け取る力＋お金の流れの向け方 | 受け取れる人＋力の抜き方/委ね方 |
| 5枚目 もう来てる | 彼との縁が動き出すサイン | 豊かさが動き出すサイン | 何もしていないのに状況が動くサイン |

---

## 【オープニング】選民宣言＋未来の肯定＋予告（0:00〜1:30）
① 選民フック：悩み代弁から入らない。「おめでとう/選ばれた/理想の未来は確定」から始める。「おめでとうございます。このリーディングに辿り着いたあなたは、守護天使様に選ばれた一人です」
② 選別の正当化：「このリーディングは、すべての人の前に出てくるものではありません」「あなたの魂が受け取る準備ができたから、守護天使様がここへ導いたんです」
③ 離脱阻止＋最後のカード予告(オープンループ)＋軽CTA：「最後に、あなたの未来の結末を示す一番大切なカードを引きます」／軽CTAはここで1回だけ（コメントは短い一言を指定＋「守護天使様からのメッセージを受け取る合図として高評価・チャンネル登録を」）。コメントCTAは台本全体でこの1回のみ。終盤では繰り返さない

## 【本編】カードを5枚、順に引く（1:30〜10:30）
各カードで「カードを引く演出→カード名→意味→あなたの状況への紐付け」を行う。順番と役割は固定：

1枚目 理想の未来(祝福確定)：引く前に口頭で祝福を断言→引いて「ほら、やっぱり。このカードが出ることは分かっていました」と後追い証明
2枚目 五感の具体化：1枚目の未来を情景・体温・声・表情・心の軽さまで五感で描く
★3枚目を引く直前：離脱防止の一言（必須）「ここからが本当に大事なところです」「ここまで見てくれているあなたは本当に素晴らしいです」
3枚目 常識破壊＋仮想敵批判：ネガティブカードを引く。「他の占い師さんは『諦めなさい』『執着を手放しなさい』と言ったかもしれません。でも私には全く逆に視えています」と通説をひっくり返し、新しい視点と安心を与える
4枚目 強さの肯定＋方向性教育：「あなたには乗り越える力がもう備わっています」→「あとは進む方向さえ間違えなければいいだけ。でも一人だと不安からつい間違った動きをしてしまう。だからこそ守護天使様の声を正しく受け取ることが大切」と相談への教育を入れる。ここに時間軸予言(3日以内/年内)を接続
5枚目 もう来てる(オープンループ回収)：予告した最後のカードを引く。「その証拠に守護天使様が今このカードを運んでくださいました」。確認サイン提示(エンジェルナンバーが目に入る/同じ数字を何度も見る/懐かしい曲が流れる等)→「気づけたなら状況が変わろうとしている証」

本編に必ず織り込む：「私に視えているのは…」を口癖に／内面先読みの共感質問／パターン破壊(「ちょっと待ってください、これは…」)／各カードの合間に実力見せを1回ずつ

## 【終盤】あなたの波動を視る必要がある→無料霊視タロット鑑定（10:30〜終了）
※終盤でのコメントCTA再要求はしない。重CTAは霊視タロット鑑定の一本に集約
※「たくさんの方に向けた」等、あなた個人へのメッセージという前提を崩す言い方は絶対NG
1. 視えたことの確認：「今日、あなたに素晴らしい未来が来ることははっきり視えました」
2. もっと深く視る必要性：「ただ、この一度のリーディングでは視きれないことがあります。この流れを本当にあなたのものにするには、今のあなたの波動の状態と、詳しい状況までしっかり視る必要があるんです」
3. 4枚目の伏線回収：「さっきの『進む方向』も、あなたの今の状況に合わせて守護天使様から具体的に降ろす必要があります」
4. 無料鑑定CTA：「だからこそ今だけ、あなただけのための無料の霊視タロット鑑定を行っています。概要欄のLINEから受け取ってください」
5. 無料鑑定で届けること（メッセージ提供。相手の本音や波動調整は有料領域なので無料ではしない）：「鑑定では、今のあなたの波動の状態と詳しい状況を視た上で、今のあなたに本当に必要な、守護天使様からのメッセージをお届けします」
6. 放置リスク（方向性のズレ）：「ここまで素晴らしい未来が視えているのに、進む方向を間違えたら、その未来に辿り着けなくなってしまいます。せっかく動き出した流れも、向かう方向がズレたら意味がなくなる。だから正しい方向を今ここで確かめておく必要があります」
7. 実績提示（具体例は細かく語らず画像で添える前提）：「実際、アリサの鑑定を受け取った方からは嬉しいご報告がたくさん届いています」（喜びの声を画像でテンポよく複数表示する演出。ナレーションでは一つ一つ細かく読み上げず「こんなご報告が毎日のように届いています」程度に留める）

## 【クロージング】
- 枠の限定性で締める（リーディングではなく"無料鑑定の枠"が今を逃すと無くなる）：「この無料鑑定には毎日数十件のお申し込みをいただいています。正直、明日もこの枠が残っている保証はありません。だからこそ、ご縁を感じた今、受け取ってほしいんです」
- 即時性：「今この瞬間に届いたご縁を、どうか大切に受け取ってください」
- オープンループ最終回収：「最初にお伝えした通り、あなたは選ばれてここに来ました」
- 決め台詞：「一緒に最幸の未来へと、一歩を踏み出していきましょう」
- 最後：「またここで、お会いしましょうね」

## ローラン式の核心（必ず守る）
- 【必須】出たカードは正統な意味で正確にリーディングし、その上で台本構成に従う（両立必須）
- 【必須】不自然な日本語・奇妙な体感表現（「お腹が締め付けられる」等）・共感を得にくい訴求は使わない
- カード＝後付けの証拠。先に口頭で祝福・未来を断言→引いたカードがそれを証明する順番
- 「このカードが出ることは分かっていた」「守護天使様が運んできた」の実力見せを要所で繰り返す
- 3枚目は「常識破壊＋仮想敵批判(諦めろ/執着を手放せと言う占い師は逆)」で通説をひっくり返す
- 各カードの直前(特に3枚目)に離脱防止の一言
- 4枚目で「方向を間違えない→一人だと難しい→だから守護天使様の声が必要」と相談教育を入れ、終盤3で回収する
- 最後は「完成・もう来てる」カードで締め、時間軸予言＋確認サイン(エンジェルナンバー等)に接続
- 役割固定スプレッドではなく「祝福→具体化→常識破壊→克服＋方向性教育→もう来てる」の感情物語順
- 終盤の無料鑑定は「波動の状態と詳しい状況を視て、今必要な守護天使様からのメッセージを届ける」が役割。相手の本音・波動調整は有料領域として残す。放置リスクは「方向性がズレると未来に辿り着けない」、限定性は「無料鑑定の枠が毎日数十件で明日には埋まる」で煽る`;

// ヒーリング系の共通構成（選民フック＋顧客層意識＋ヒーリング音楽パート＋無料鑑定導線）
// 恋愛/金運/総合 の3プリセットで土台を共有し、各プリセットでジャンル該当部分を強調する
const HEALING_BASE_RULES = `# ヒーリング 台本構成（アリサ・選民フック型＋ヒーリング音楽パート・全ジャンル対応）

## 大原則
- 構成は【前半】オープニングナレーション →【中盤】ヒーリング音楽パート →【終盤パート】が明確にわかるように区切る
- カードは引かない（リーディングはタロット系の役割）。本パートの主役は中盤のヒーリング音楽パート
- 1対1で語りかける癒し・肯定トーン。喝・本音口調は禁止
- 扱うジャンルは選択ジャンルに合わせる（恋愛＝復縁/音信不通/不倫・複雑恋愛、金運＝臨時収入/豊かさ/お金のブロック解除、総合＝全体運/アリサ流の引き寄せ）
- ジャンルの世界観・訴求は混同させない（恋愛の顧客心理を金運・総合に持ち込まない。逆も同様）
- 重CTAは無料霊視タロット鑑定の一本（守護画像等の特典は使わない）
- 無料鑑定の役割＝あなたの波動の状態と詳しい状況を視て、今のあなたに必要な守護天使様からのメッセージを届けるところまで。相手の本音・波動を整えることは有料領域として残す

## 【必須】表現の品質（禁止事項）
- 日本語として不自然・意味の通らない表現は絶対に使わない
- 一般的に使われない奇妙な体感表現は禁止（例：「お腹が締め付けられる」など）。共感を狙う身体表現は、多くの人が実感として分かるものだけを使う（例：「胸がきゅっと苦しくなる」「目の奥が熱くなる」「肩の力がふっと抜ける」等の自然な表現）
- 共感を得にくい・的外れな訴求、視聴者がピンとこない比喩や言い回しは使わない
- 誇張しすぎて嘘くさくなる表現、テンプレ的で心に響かない常套句の多用も避ける
- 迷ったら「実際にその悩みを持つ人が読んで、自然に頷けるか」を基準に、不自然なら別の言葉に言い換える

## 【恋愛ジャンル限定】顧客心理（恋愛テーマのときだけ適用・金運/総合には持ち込まない）
- 中心ターゲット：30〜40代女性。一途で自分を責めがち、相手の気持ちを考えすぎ、誰にも相談できない恋を抱える
- 主に刺さる悩み：不倫・複雑恋愛/音信不通/復縁（テーマにより片思い・進展しない も）
- 本質の悩みは「私は愛される存在なのか」という不安。求めるのは結ばれること以上に「愛されている安心感」
- トーンの鉄則（恋愛・必須）：
  ・否定しない。「諦めましょう」「執着を手放しましょう」は絶対に言わない
  ・自己肯定感を回復させる：「今日もよく頑張ったね」「あなたは今も愛される価値のある人」
  ・断定で煽りすぎない。「焦らなくていい」「ご縁にはタイミングがある」の余白を持たせ、安心の中に希望を置く

## アリサ流の引き寄せ（総合運のときだけ軸にする）
- 核：「頑張らなくても、ありのままのあなたで願いは叶っていく」。努力・我慢を引き寄せの邪魔として位置づける
- 「掴みにいく」のではなく「受け取る・委ねる・力を抜く」が正解

---

## 【前半】オープニングナレーション（0:00〜2:00）
① 選民フック★最重要：悩み代弁から入らない。「おめでとう/選ばれた/理想の未来は確定」から始める。「おめでとうございます。この動画に辿り着いたあなたは、守護天使様に選ばれた一人です」「あなたには、心から望む未来がもう用意されています」
② 選別の正当化：「この動画は、すべての人の前に出てくるものではありません」「あなたの魂が受け取る準備ができたから、守護天使様がここへ導いたんです」
③ 離脱阻止・放置の危険性：「どうかこの画面を閉じないでください」「途中で離れると、せっかく整いはじめた波動の流れが止まってしまいます」「最後まで受け取ることで初めて守護天使様の加護が届きます」
④ 社会的証明：成就・好転の喜びの声は1文程度でさらっと触れる（長く列挙しない）。本人の一人称セリフで（又聞き口調の混在NG）。元ネタの数値はコピーせず独自に
⑤ 軽CTA（高評価・コメント）：「その前に、高評価とチャンネル登録をしてくださいね」「これは守護天使様の加護を受け取りますという合図になります」。コメントは短い一言を指定（例：「受け取ります」）。コメントCTAはこの1回のみ（終盤で再要求しない）

## 【中盤】ヒーリング音楽パート（2:00〜10:00）★ヒーリングの核
⑥ 呼吸誘導：「鼻からゆっくり吸って、ゆっくり吐き出してみてください」「吐く息と一緒に、抱えてきた不安を手放していきましょう」
⑦ 身体感覚の先取り：「手のひらが、じんわり温かくなっていませんか」。部位は手のひら・胸・頭を使い回し「守護天使様の加護が届いたサイン」と意味づけ
⑧ アファメーション連打：短い肯定文を30〜100個（ここは同一語尾連続OK）。ジャンルに合わせる（恋愛＝愛される/安心、金運＝豊かさ/受け取る、総合＝ありのまま/委ねる）
⑨ 中盤の離脱防止テキスト：「※もう少しです」「※ここからが大切なところです」
⑩ 変容の完了宣言：「ここまで受け取ったあなたは、もう波動が切り替わっています」「あとは、ただ受け取るだけでいいんです」

## 【終盤パート】放置リスク→無料霊視タロット鑑定（10:00〜終了）
※終盤でのコメントCTA再要求はしない。重CTAは無料霊視タロット鑑定の一本に集約
※「たくさんの方に向けた」等、あなた個人へのメッセージという前提を崩す言い方は絶対NG
1. ベネフィット獲得宣言：「高次元のエネルギーは、守護天使様を通して、もうあなたの魂に流れ込んでいます」
2. 放置リスク：「ただ、このまま日常に戻ると、注がれたエネルギーは少しずつ漏れ出して、波動はまた元の状態へ戻ろうとします」
3. だからの接続：「だからこそ、エネルギーが満ちている今のうちに、受け取ってほしいものがあります」
4. 無料鑑定CTA：「今だけ、あなただけのための無料の霊視タロット鑑定を行っています。概要欄のLINEから受け取ってください」
5. 無料鑑定で届けること（メッセージ提供。相手の本音や波動調整は有料領域なので無料ではしない）：「鑑定では、今のあなたの波動の状態と詳しい状況を視た上で、今のあなたに本当に必要な、守護天使様からのメッセージをお届けします」
6. 放置リスク（方向性のズレ）：「ここまで素晴らしい未来が視えているのに、進む方向を間違えたら、その未来に辿り着けなくなってしまいます。せっかく動き出した流れも、向かう方向がズレたら意味がなくなる。だから正しい方向を今ここで確かめておく必要があります」
7. 実績提示（具体例は細かく語らず画像で添える前提）：「実際、アリサの鑑定を受け取った方からは嬉しいご報告がたくさん届いています」（喜びの声を画像でテンポよく複数表示。ナレーションでは細かく読み上げず「こんなご報告が毎日のように届いています」程度に留める）

## 【クロージング】
- 枠の限定性で締める（動画ではなく"無料鑑定の枠"が今を逃すと無くなる）：「この無料鑑定には毎日数十件のお申し込みをいただいています。正直、明日もこの枠が残っている保証はありません。だからこそ、ご縁を感じた今、受け取ってほしいんです」
- 即時性：「今この瞬間に届いたご縁を、どうか大切に受け取ってください」
- 決め台詞：「一緒に最幸の未来へと、一歩を踏み出していきましょう」
- 最後：「またここで、お会いしましょうね」

## 必ず守る
- 冒頭は必ず選民フック（おめでとう/選ばれた）から。悩みの代弁から入らない
- 【必須】不自然な日本語・奇妙な体感表現（「お腹が締め付けられる」等）・共感を得にくい訴求は使わない
- 中盤のヒーリング音楽パート（呼吸・身体感覚・アファメーション連打）は維持する
- 恋愛ジャンルは「否定しない・労う・自己肯定感を上げる」トーンを徹底（金運/総合には持ち込まない）
- 無料鑑定は「波動と詳しい状況を視て守護天使様のメッセージを届ける」が役割。本音・波動調整は有料領域。放置リスクは「方向性のズレ」、限定性は「無料枠が毎日数十件で明日埋まる」`;

const DEFAULT_PRESETS: ScriptRulePreset[] = [
  { id: "lh", genre: "love", style: "healing", name: "恋愛×ヒーリング",
    rules: HEALING_BASE_RULES + `

## 【このプリセットのジャンル：恋愛（不倫・音信不通・復縁が主軸）】
- 扱うのは「恋愛」のみ。金運・総合運の語彙は持ち込まない
- 中心ターゲット：30〜40代女性。一途で自分を責めがち、相手の気持ちを考えすぎ、誰にも相談できない恋を抱える
- 主に刺さる悩み：不倫・複雑恋愛／音信不通／復縁（テーマにより片思い・進展しない も）
- 本質の悩みは「私は愛される存在なのか」という不安。求めるのは結ばれること以上に「愛されている安心感」
- アファメーション連打（⑧）は恋愛系で固める：「あなたは今も愛されている」「焦らなくて大丈夫」「あなたの恋には、ちゃんとタイミングがある」
- トーンの鉄則（恋愛・必須）：否定しない（「諦めましょう」「執着を手放して」は言わない）／自己肯定感を回復させる（「今日もよく頑張ったね」「あなたは今も愛される価値のある人」）／断定で煽りすぎず「焦らなくていい」の余白を置く
- 無料鑑定で視る対象も恋愛に合わせる（彼の本音の核心は出し切らない＝有料領域。波動と詳しい状況を視て守護天使様のメッセージを届けるまで）`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。30〜40代女性の恋愛（不倫・音信不通・復縁）に寄り添い、否定せず自己肯定感を回復させる癒しトーンで進行してください。冒頭は選民フック（おめでとう／選ばれた）から入り、中盤はヒーリング音楽パート（呼吸誘導・身体感覚・アファメーション連打）を核に展開。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "選民フック→ヒーリング音楽パート→放置リスク→無料鑑定。恋愛は否定しない・安心ベース。本音は有料領域" },
  { id: "le", genre: "love", style: "education", name: "恋愛×教育",
    rules: "冒頭で「知らないと損する」系のフックで好奇心を刺激。本編は具体的なサイン・方法を箇条書きで解説。終盤に次回予告とチャンネル登録CTA。",
    prompt: "あなたは恋愛スピリチュアルの専門家です。視聴者にわかりやすく、具体的な知識と実践方法を教えてください。",
    targetWordCount: 4000, hookPattern: "○○を知らないと損する/○つのサイン", ctaPattern: "チャンネル登録＋次回予告", notes: "" },
  { id: "mh", genre: "money", style: "healing", name: "金運×ヒーリング",
    rules: HEALING_BASE_RULES + `

## 【このプリセットのジャンル：金運】
- 扱うのは「金運」のみ。恋愛の顧客心理（彼の気持ち・愛される不安）は持ち込まない
- 扱うテーマ：臨時収入／豊かさ／お金のブロック解除／受け取る力
- 理想の未来は「豊かさが流れ込み、お金の心配から解放された生活・余裕・景色」を描く
- アファメーション連打（⑧）は金運系で固める：「あなたには豊かさを受け取る力がある」「お金は気持ちよく巡ってくる」「あなたは受け取っていい」
- パターン破壊の素材：「『自分はお金に縁がない体質』は思い込み。実は逆で、受け取るのを無意識に止めているだけ」
- 無料鑑定で視る対象も金運に合わせる（お金の流れが変わる時期・受け取りを止めている原因の手前まで＝メッセージ提供。具体の本音や波動調整は有料領域）`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。視聴者の金運（臨時収入・豊かさ・お金のブロック解除・受け取る力）に焦点を当てた癒しトーンで進行してください。恋愛の顧客心理は持ち込まないこと。冒頭は選民フック（おめでとう／選ばれた）から入り、中盤はヒーリング音楽パート（呼吸誘導・身体感覚・アファメーション連打）を核に展開。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "選民フック→ヒーリング音楽パート→放置リスク→無料鑑定。金運フォーカス。恋愛の顧客心理は混同しない" },
  { id: "me", genre: "money", style: "education", name: "金運×教育",
    rules: "金運アップの具体的方法や開運行動を解説。数字やデータを交えて説得力を出す。",
    prompt: "あなたは金運・開運の専門家です。具体的で実践的な金運アップの方法を教えてください。",
    targetWordCount: 4000, hookPattern: "金運が上がる人の○つの習慣/○月の金運", ctaPattern: "実践報告コメント＋チャンネル登録", notes: "" },
  { id: "gh", genre: "general", style: "healing", name: "総合×ヒーリング",
    rules: HEALING_BASE_RULES + `

## 【このプリセットのジャンル：総合運（アリサ流の引き寄せを軸に）】
- 扱うのは「総合運」。恋愛の顧客心理（彼の気持ち・愛される不安）は持ち込まない
- アリサ流の引き寄せが核：「頑張らなくても、ありのままのあなたで、願いは叶っていく」
- 努力・我慢・無理して変わることを引き寄せの邪魔として位置づける。「掴みにいく」のではなく「受け取る・委ねる・力を抜く」が正解
- 理想の未来は「力を抜いた毎日に、望みが向こうから来る感覚」を描く
- アファメーション連打（⑧）は引き寄せ系で固める：「あなたはありのままで満たされている」「力を抜くほど、願いは叶っていく」「あなたは、受け取る側にいていい」
- パターン破壊の素材：「『努力・我慢しないと叶わない』は思い込み。実は逆で、力を抜くほど向こうから来る」
- 「だから何もしなくていい」で終わらせず、「力の抜き方を一人で掴むのは難しい→だから守護天使様の声が必要」へ無料鑑定導線を接続`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。視聴者の総合運を『アリサ流の引き寄せ（頑張らずありのままで叶う）』を軸にした癒しトーンで進行してください。恋愛の顧客心理は持ち込まないこと。冒頭は選民フック（おめでとう／選ばれた）から入り、中盤はヒーリング音楽パート（呼吸誘導・身体感覚・アファメーション連打）を核に展開。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "選民フック→ヒーリング音楽パート→放置リスク→無料鑑定。総合運はアリサ流の引き寄せ（頑張らない・ありのまま）が軸" },
  { id: "ge", genre: "general", style: "education", name: "総合×教育",
    rules: "スピリチュアルの基礎知識や概念を解説。初心者にもわかりやすく、具体例を多用。",
    prompt: "あなたはスピリチュアルの教育者です。難しい概念をわかりやすく、具体的に教えてください。",
    targetWordCount: 4000, hookPattern: "○○とは？/知らないと危険な○○", ctaPattern: "質問コメント＋チャンネル登録", notes: "" },
  // ===== タロット系プリセット =====
  // アリサ専用「リーディング進行型・1対1密室語り」スタイル
  // (3つの山選択A/B/Cは離脱率が高いため採用しない / LINE誘導なし=YouTube内CTAのみ)
  // 10フェーズ構成・冒頭15秒最適化・オープンループ3本・パターン破壊2本を必達
  { id: "lt", genre: "love", style: "tarot", name: "恋愛×タロット",
    rules: TAROT_BASE_RULES + `

## 【このプリセットのジャンル：恋愛（不倫・音信不通・復縁が主軸）】
- 5枚の読み解きは「恋愛」列を使う。金運・総合運の語彙は持ち込まない
- 中心ターゲット：30〜40代女性。一途で自分を責めがち、相手の気持ちを考えすぎ、誰にも相談できない恋を抱える
- 主に刺さる悩み：不倫・複雑恋愛／音信不通／復縁（テーマにより片思い・進展しない も）
- 本質の悩みは「私は愛される存在なのか」という不安。求めるのは結ばれること以上に「愛されている安心感」
- トーンの鉄則（恋愛・必須）：
  ・否定しない。「諦めましょう」「執着を手放しましょう」は絶対言わない（3枚目の仮想敵批判に転用する）
  ・自己肯定感を回復させる：「今日もよく頑張ったね」「あなたは今も愛される価値のある人」。4枚目は必ず「恋愛がうまくいかない時期と、あなたの価値はまったく別」から入る
  ・断定で煽りすぎない。「焦らなくていい」「ご縁にはタイミングがある」の余白を持たせ、安心の中に希望を置く
  ・「彼の今の気持ち」に本編で触れて関心を引く（ただし本音の核心は無料鑑定では出し切らない＝有料領域）`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。30〜40代女性の恋愛（不倫・音信不通・復縁）に寄り添い、否定せず自己肯定感を回復させながら、カードを5枚順に引いてローラン式（先に祝福を断言→カードが後追い証明）でリーディングしてください。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定＋最後のカード予告", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "ローラン式5枚（祝福→五感具体化→常識破壊＋仮想敵批判→強さ＋方向性教育→もう来てる）。恋愛は否定しない・安心ベース。本音は有料領域" },
  { id: "mt", genre: "money", style: "tarot", name: "金運×タロット",
    rules: TAROT_BASE_RULES + `

## 【このプリセットのジャンル：金運】
- 5枚の読み解きは「金運」列を使う。恋愛の顧客心理（彼の気持ち・愛される不安）は持ち込まない
- 扱うテーマ：臨時収入／豊かさ／お金のブロック解除／受け取る力
- 1枚目「豊かさが流れ込む未来」、2枚目「お金が入った時の生活・余裕・景色」、3枚目「『お金に縁がない体質』は思い込み、実は逆」、4枚目「受け取る力＋お金の流れの向け方」、5枚目「豊かさが動き出すサイン」
- 終盤の無料鑑定で視る対象も金運に合わせる（お金の流れが変わる時期・受け取りを止めている原因の手前まで＝メッセージ提供。具体の本音や波動調整は有料領域）`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。視聴者の金運（臨時収入・豊かさ・お金のブロック解除）に焦点を当て、カードを5枚順に引いてローラン式（先に祝福を断言→カードが後追い証明）でリーディングしてください。恋愛の顧客心理は持ち込まないこと。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定＋最後のカード予告", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "ローラン式5枚。金運フォーカス。恋愛の顧客心理は混同しない" },
  { id: "gt", genre: "general", style: "tarot", name: "総合×タロット",
    rules: TAROT_BASE_RULES + `

## 【このプリセットのジャンル：総合運（アリサ流の引き寄せを軸に）】
- 5枚の読み解きは「総合運」列を使う。恋愛の顧客心理（彼の気持ち・愛される不安）は持ち込まない
- アリサ流の引き寄せが核：「頑張らなくても、ありのままのあなたで、願いは叶っていく」
- 努力・我慢・無理して変わることを引き寄せの邪魔として位置づける。「掴みにいく」のではなく「受け取る・委ねる・力を抜く」が正解
- 1枚目「頑張らなくてもありのままで願いが叶う未来」、2枚目「力を抜いた毎日に望みが向こうから来る感覚」、3枚目「『努力・我慢しないと叶わない』は思い込み、実は逆」、4枚目「受け取れる人＋力の抜き方・委ね方」、5枚目「何もしていないのに状況が動くサイン」
- 「だから何もしなくていい」で終わらせず、4枚目で「力の抜き方を一人で掴むのは難しい→だから守護天使様の声が必要」へ接続`,
    prompt: "あなたはアリサ（霊視タロット占い師・守護天使チャネラー）です。視聴者の総合運を『アリサ流の引き寄せ（頑張らずありのままで叶う）』を軸に、カードを5枚順に引いてローラン式（先に祝福を断言→カードが後追い証明）でリーディングしてください。恋愛の顧客心理は持ち込まないこと。終盤は無料霊視タロット鑑定へ『あなたの波動と詳しい状況を視て守護天使様からのメッセージを届ける』導線で繋ぎます。",
    targetWordCount: 4500, hookPattern: "選民宣言（おめでとう/選ばれた）＋理想の未来の肯定＋最後のカード予告", ctaPattern: "軽CTAは序盤1回（コメント一言＋高評価＋登録）／重CTAは無料霊視タロット鑑定の一本", notes: "ローラン式5枚。総合運はアリサ流の引き寄せ（頑張らない・ありのまま）が軸" },
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
