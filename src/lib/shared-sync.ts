// 共有設定の同期（localStorageとサーバーDBを統合）
// アプリ起動時にサーバーから取得し、localStorageが空ならサーバーのデータを使う

import { getApiKey, setApiKey, getChannels, saveChannels } from "./channel-store";
import { getProfile, saveProfile } from "./script-analysis-store";
import { getHooks, getCTAs, getThumbnailWords, getTitles } from "./project-store";
import { getWinningPatterns, saveWinningPatterns } from "./winning-patterns-store";

export async function pullSharedSettings(): Promise<void> {
  try {
    const res = await fetch("/api/shared-settings");
    if (!res.ok) return;
    const data = await res.json();

    // APIキー: ローカルが空ならサーバーから復元
    if (!getApiKey("yt_api_key") && data.yt_api_key) {
      setApiKey("yt_api_key", data.yt_api_key);
    }
    if (!getApiKey("ai_api_key") && data.ai_api_key) {
      setApiKey("ai_api_key", data.ai_api_key);
    }

    // チャンネル: ローカルが空ならサーバーから復元
    if (getChannels().length === 0 && data.channels?.length > 0) {
      saveChannels(data.channels);
    }

    // フック/CTA/サムネワード/タイトル: ローカルが空ならサーバーから復元
    if (getHooks().length === 0 && data.hooks?.length > 0) {
      localStorage.setItem("fortune_yt_hooks", JSON.stringify(data.hooks));
    }
    if (getCTAs().length === 0 && data.ctas?.length > 0) {
      localStorage.setItem("fortune_yt_ctas", JSON.stringify(data.ctas));
    }
    if (getThumbnailWords().length === 0 && data.thumbnailWords?.length > 0) {
      localStorage.setItem("fortune_yt_thumbnail_words", JSON.stringify(data.thumbnailWords));
    }
    if (getTitles().length === 0 && data.titles?.length > 0) {
      localStorage.setItem("fortune_yt_titles", JSON.stringify(data.titles));
    }

    // プロフィール
    const profile = getProfile();
    if (!profile.channelName && data.profile?.channelName) {
      saveProfile(data.profile);
    }

    // 勝ちパターン
    if (!getWinningPatterns() && data.winningPatterns) {
      saveWinningPatterns(data.winningPatterns);
    }

    console.log("[shared-sync] pulled settings from server");
  } catch (e) {
    console.error("[shared-sync] pull failed:", e);
  }
}

export async function pushSharedSettings(): Promise<{ ok: boolean; error?: string }> {
  try {
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
        winningPatterns: getWinningPatterns(),
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { ok: false, error: err.error };
    }
    console.log("[shared-sync] pushed settings to server");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
