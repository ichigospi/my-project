// 共有設定の同期（localStorageとサーバーDBをマージ）
// ルール: サーバーとローカルの両方を保持。どちらかにしかないデータは追加。

import { getApiKey, setApiKey, getChannels, saveChannels } from "./channel-store";
import { getProfile, saveProfile, type ChannelProfile } from "./script-analysis-store";
import {
  getHooks, getCTAs, getThumbnailWords, getTitles,
  getPresets, savePreset,
  type HookEntry, type CTAEntry, type ThumbnailWordEntry, type TitleEntry,
} from "./project-store";
import { getWinningPatterns, saveWinningPatterns } from "./winning-patterns-store";
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

    // 勝ちパターン: サーバーの方が新しければ採用
    if (data.winningPatterns) {
      const local = getWinningPatterns();
      if (!local || (data.winningPatterns.updatedAt && (!local.updatedAt || data.winningPatterns.updatedAt > local.updatedAt))) {
        saveWinningPatterns(data.winningPatterns);
      }
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
        winningPatterns: getWinningPatterns(),
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
