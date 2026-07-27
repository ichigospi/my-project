// 動画編集プロジェクトのクライアント側ストア(localStorage)
// 台本プロジェクト(project-store)から生成したシーン構成・素材・書き出し結果を保持する。
// 素材/書き出しのURL(/api/video/assets/...)はサーバー再デプロイで無効になるため、
// 開いたときに 404 なら再生成を促す。

export type VideoAspect = "9:16" | "16:9" | "1:1";
export type AssetProvider = "openai_image" | "sora_video" | "litvideo_video" | "upload" | "none";
export type AssetStatus = "none" | "generating" | "ready" | "error";

export interface VideoTelop {
  text: string;
  start?: number;
  end?: number;
  style?: "title" | "caption" | "note";
}

export interface VideoScene {
  id: string;
  section: string;
  narration: string;
  duration: number;
  telops: VideoTelop[];
  visualPrompt: string;
  provider: AssetProvider;
  assetStatus: AssetStatus;
  assetUrl?: string;
  assetTaskId?: string;
  assetError?: string;
  mute?: boolean;
  zoom?: boolean; // 画像素材をゆっくりズームさせる(既定: 有効)
  narrationUrl?: string; // TTSで生成したナレーション音声
  narrationDuration?: number;
  narrationStatus?: "none" | "generating" | "ready" | "error";
  narrationError?: string;
}

export interface VideoProject {
  id: string;
  scriptProjectId?: string;
  title: string;
  aspect: VideoAspect;
  scenes: VideoScene[];
  bgmUrl?: string;
  bgmName?: string;
  bgmVolume: number;
  narrationVoice: string; // OpenAI TTSの声(nova / shimmer / alloy 等)
  narrationStyle?: string; // 話し方の指示(例: 低めのトーンでゆっくり癒すように)
  targetSeconds?: number; // 動画の目標尺(秒)。シーン構成生成に使う
  renderUrl?: string;
  renderSizeMb?: number;
  createdAt: string;
  updatedAt: string;
}

const VIDEOS_KEY = "fortune_yt_videos";

export function genVideoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getVideoProjects(): VideoProject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(VIDEOS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveVideoProject(project: VideoProject): VideoProject[] {
  const projects = getVideoProjects();
  project.updatedAt = new Date().toISOString();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) projects[idx] = project;
  else projects.unshift(project);
  localStorage.setItem(VIDEOS_KEY, JSON.stringify(projects));
  return projects;
}

export function deleteVideoProject(id: string): VideoProject[] {
  const projects = getVideoProjects().filter((p) => p.id !== id);
  localStorage.setItem(VIDEOS_KEY, JSON.stringify(projects));
  return projects;
}

export function createVideoProject(opts: {
  title: string;
  aspect?: VideoAspect;
  scriptProjectId?: string;
}): VideoProject {
  return {
    id: genVideoId(),
    scriptProjectId: opts.scriptProjectId,
    title: opts.title,
    aspect: opts.aspect || "9:16",
    scenes: [],
    bgmVolume: 0.15,
    narrationVoice: "nova",
    targetSeconds: 600,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
