// 共有設定の同期（localStorageとサーバーDBをマージ）
// ルール: サーバーとローカルの両方を保持。どちらかにしかないデータは追加。

import { getApiKey, setApiKey, getChannels, saveChannels } from "./channel-store";
import { getProfile, saveProfile, type ChannelProfile } from "./script-analysis-store";
import {
  getHooks, getCTAs, getThumbnailWords, getTitles,
  getPresets, savePreset,
  getProjects, getTasks, getMembers, getMyChannel, saveMyChannel,
  getAnalysisLogs, getWeeklySnapshots, getPerformanceRecords,
  type HookEntry, type CTAEntry, type ThumbnailWordEntry, type TitleEntry,
  type ScriptProject, type ProductionTask, type MyChannelData,
  type AnalysisLog, type WeeklySnapshot, type PerformanceRecord,
} from "./project-store";
import { getWinningPatterns, saveWinningPatterns } from "./winning-patterns-store";
import { getIdeas, getIdeaRules, saveIdeaRules, type IdeaEntry, type IdeaRules } from "./idea-store";
import type { RegisteredChannel } from "./channel-store";

// IDベースでマージ（既存を消さない、サーバーにしかないものを追加）
function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of server) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

// 更新日時ベースでマージ（新しい方を採用）
function mergeByUpdatedAt<T extends { id: string; updatedAt?: string; createdAt?: string }>(local: T[], server: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of server) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const serverTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (serverTime > existingTime) map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

// URLベースでチャンネルをマージ
function mergeChannels(local: RegisteredChannel[], server: RegisteredChannel[]): RegisteredChannel[] {
  const map = new Map<string, RegisteredChannel>();
  for (const ch of local) map.set(ch.url, ch);
  for (const ch of server) {
    if (!map.has(ch.url)) map.set(ch.url, ch);
  }
  return Array.from(map.values());
}

// プロフィールをマージ（ローカル優先、ローカルが空ならサーバーの値を採用）
function mergeProfile(local: ChannelProfile, server: ChannelProfile | null): ChannelProfile {
  if (!server) return local;
  return {
    channelName: local.channelName || server.channelName || "",
    concept: local.concept || server.concept || "",
    tone: local.tone || server.tone || "",
    target: local.target || server.target || "",
    genres: local.genres?.length > 0 ? local.genres : server.genres || [],
    mainStyle: local.mainStyle || server.mainStyle || "healing",
    characteristics: local.characteristics || server.characteristics || "",
    commonRules: local.commonRules || server.commonRules || "",
    ngExpressions: local.ngExpressions || server.ngExpressions || "",
    referenceAnalysisIds: [...new Set([...(local.referenceAnalysisIds || []), ...(server.referenceAnalysisIds || [])])],
  };
}

export async function pullSharedSettings(): Promise<void> {
  try {
    notifySync("syncing");
    const res = await fetch("/api/shared-settings");
    if (!res.ok) { notifySync("error"); return; }
    const data = await res.json();

    // APIキー: ローカルが空ならサーバーから、サーバーの方が新しければサーバーから
    if (data.yt_api_key && !getApiKey("yt_api_key")) {
      setApiKey("yt_api_key", data.yt_api_key);
    }
    if (data.ai_api_key && !getApiKey("ai_api_key")) {
      setApiKey("ai_api_key", data.ai_api_key);
    }

    // チャンネル: マージ
    if (data.channels?.length > 0) {
      const merged = mergeChannels(getChannels(), data.channels);
      saveChannels(merged);
    }

    // フック: マージ
    if (data.hooks?.length > 0) {
      const merged = mergeById(getHooks(), data.hooks as HookEntry[]);
      localStorage.setItem("fortune_yt_hooks", JSON.stringify(merged));
    }

    // CTA: マージ
    if (data.ctas?.length > 0) {
      const merged = mergeById(getCTAs(), data.ctas as CTAEntry[]);
      localStorage.setItem("fortune_yt_ctas", JSON.stringify(merged));
    }

    // サムネワード: マージ
    if (data.thumbnailWords?.length > 0) {
      const merged = mergeById(getThumbnailWords(), data.thumbnailWords as ThumbnailWordEntry[]);
      localStorage.setItem("fortune_yt_thumbnail_words", JSON.stringify(merged));
    }

    // タイトル: マージ
    if (data.titles?.length > 0) {
      const merged = mergeById(getTitles(), data.titles as TitleEntry[]);
      localStorage.setItem("fortune_yt_titles", JSON.stringify(merged));
    }

    // プロフィール: マージ
    if (data.profile) {
      const merged = mergeProfile(getProfile(), data.profile);
      saveProfile(merged);
    }

    // プリセット: マージ
    if (data.presets?.length > 0) {
      const localPresets = getPresets();
      for (const sp of data.presets) {
        if (!localPresets.some((lp) => lp.id === sp.id)) {
          savePreset(sp);
        }
      }
    }

    // プロジェクト（台本作成）: 更新日時ベースでマージ
    if (data.projects?.length > 0) {
      const local: ScriptProject[] = JSON.parse(localStorage.getItem("fortune_yt_projects") || "[]");
      const merged = mergeByUpdatedAt(local, data.projects);
      localStorage.setItem("fortune_yt_projects", JSON.stringify(merged));
    }

    // 工程表タスク: 更新日時ベースでマージ
    if (data.tasks?.length > 0) {
      const local: ProductionTask[] = JSON.parse(localStorage.getItem("fortune_yt_tasks") || "[]");
      const merged = mergeByUpdatedAt(local, data.tasks);
      localStorage.setItem("fortune_yt_tasks", JSON.stringify(merged));
    }

    // メンバー: マージ
    if (data.members?.length > 0) {
      const local: string[] = JSON.parse(localStorage.getItem("fortune_yt_members") || "[]");
      const merged = [...new Set([...local, ...data.members])];
      localStorage.setItem("fortune_yt_members", JSON.stringify(merged));
    }

    // 自チャンネルデータ: ローカルが空ならサーバーから
    if (data.myChannel && !getMyChannel()) {
      saveMyChannel(data.myChannel);
    }

    // 分析ログ: マージ
    if (data.analysisLogs?.length > 0) {
      const local: AnalysisLog[] = JSON.parse(localStorage.getItem("fortune_yt_analysis_log") || "[]");
      const merged = mergeById(local, data.analysisLogs);
      localStorage.setItem("fortune_yt_analysis_log", JSON.stringify(merged));
    }

    // 週次スナップショット: weekStartでマージ
    if (data.weeklySnapshots?.length > 0) {
      const local: WeeklySnapshot[] = JSON.parse(localStorage.getItem("fortune_yt_weekly") || "[]");
      const map = new Map<string, WeeklySnapshot>();
      for (const s of local) map.set(s.weekStart, s);
      for (const s of data.weeklySnapshots as WeeklySnapshot[]) {
        if (!map.has(s.weekStart)) map.set(s.weekStart, s);
      }
      localStorage.setItem("fortune_yt_weekly", JSON.stringify(Array.from(map.values())));
    }

    // パフォーマンス記録: マージ
    if (data.performanceRecords?.length > 0) {
      const local: PerformanceRecord[] = JSON.parse(localStorage.getItem("fortune_yt_performance") || "[]");
      const merged = mergeById(local, data.performanceRecords);
      localStorage.setItem("fortune_yt_performance", JSON.stringify(merged));
    }

    // 勝ちパターン: サーバーの方が新しければ採用
    if (data.winningPatterns) {
      const local = getWinningPatterns();
      if (!local || (data.winningPatterns.updatedAt && (!local.updatedAt || data.winningPatterns.updatedAt > local.updatedAt))) {
        saveWinningPatterns(data.winningPatterns);
      }
    }

    // 企画: マージ
    if (data.ideas?.length > 0) {
      const local: IdeaEntry[] = JSON.parse(localStorage.getItem("fortune_yt_ideas") || "[]");
      const merged = mergeById(local, data.ideas);
      localStorage.setItem("fortune_yt_ideas", JSON.stringify(merged));
    }

    // 企画ルール: ローカルが空ならサーバーから
    if (data.ideaRules) {
      const local = getIdeaRules();
      if (!local.direction && !local.constraints) saveIdeaRules(data.ideaRules);
    }

    notifySync("synced");
    console.log("[shared-sync] pulled & merged settings from server");
  } catch (e) {
    notifySync("error");
    console.error("[shared-sync] pull failed:", e);
  }
}

// 同期ステータス通知
type SyncListener = (status: "syncing" | "synced" | "error") => void;
const syncListeners = new Set<SyncListener>();
export function onSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
function notifySync(status: "syncing" | "synced" | "error") {
  syncListeners.forEach((l) => l(status));
}

export async function pushSharedSettings(): Promise<{ ok: boolean; error?: string }> {
  try {
    notifySync("syncing");
    const res = await fetch("/api/shared-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yt_api_key: getApiKey("yt_api_key"),
        ai_api_key: getApiKey("ai_api_key"),
        channels: getChannels(),
        hooks: getHooks(),
        ctas: getCTAs(),
        thumbnailWords: getThumbnailWords(),
        titles: getTitles(),
        profile: getProfile(),
        presets: getPresets(),
        projects: getProjects(),
        tasks: getTasks(),
        members: getMembers(),
        myChannel: getMyChannel(),
        analysisLogs: getAnalysisLogs(),
        weeklySnapshots: getWeeklySnapshots(),
        performanceRecords: getPerformanceRecords(),
        winningPatterns: getWinningPatterns(),
        ideas: getIdeas(),
        ideaRules: getIdeaRules(),
      }),
    });
    if (!res.ok) {
      notifySync("error");
      const err = await res.json();
      return { ok: false, error: err.error };
    }
    notifySync("synced");
    console.log("[shared-sync] pushed settings to server");
    return { ok: true };
  } catch (e) {
    notifySync("error");
    return { ok: false, error: String(e) };
  }
}
