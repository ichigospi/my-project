// チャンネルストア - localStorage ベースのチャンネル管理

export interface RegisteredChannel {
  url: string;
  handle?: string;    // @handle
  channelId?: string; // UCxxxx
  name?: string;
  subscribers?: number;
  totalViews?: number;
  videoCount?: number;
  description?: string;
  thumbnailUrl?: string;
  lastFetched?: string;
}

// 初期登録チャンネル
export const DEFAULT_CHANNELS: RegisteredChannel[] = [
  { url: "https://www.youtube.com/@enmusubiuranaishie/videos", handle: "enmusubiuranaishie" },
  { url: "https://youtube.com/channel/UCfo8_CZrDyPobtvjEMkP86Q", channelId: "UCfo8_CZrDyPobtvjEMkP86Q" },
  { url: "https://youtube.com/@ryujin_miko", handle: "ryujin_miko" },
  { url: "https://youtube.com/@lakshmi-erisa", handle: "lakshmi-erisa" },
  { url: "https://youtube.com/channel/UCKaLVuaT6Vu7I03_dpAo71g", channelId: "UCKaLVuaT6Vu7I03_dpAo71g" },
  { url: "https://youtube.com/@user-kin-un-up", handle: "user-kin-un-up" },
  { url: "https://youtube.com/@shirohebibenzaiten", handle: "shirohebibenzaiten" },
  { url: "https://youtube.com/channel/UCokEXRm_m1n8lIMgTBLsM_A", channelId: "UCokEXRm_m1n8lIMgTBLsM_A" },
  { url: "https://youtube.com/@kinunhadou", handle: "kinunhadou" },
  { url: "https://youtube.com/channel/UCM4ASMcSi4FQSPBcwZesEtQ", channelId: "UCM4ASMcSi4FQSPBcwZesEtQ" },
  { url: "https://youtube.com/@kaiun-shu", handle: "kaiun-shu" },
  { url: "https://youtube.com/channel/UCtK9NN_to86Hdm89EmgkGVQ", channelId: "UCtK9NN_to86Hdm89EmgkGVQ" },
  { url: "https://youtube.com/channel/UCc0haAzUsjvL9BL72PlAGSQ", channelId: "UCc0haAzUsjvL9BL72PlAGSQ" },
  { url: "https://youtube.com/@yotsuba.happychallenge", handle: "yotsuba.happychallenge" },
  { url: "https://youtube.com/@tokujiro7kinun", handle: "tokujiro7kinun" },
  { url: "https://youtube.com/@hisuikotaro", handle: "hisuikotaro" },
  { url: "https://youtube.com/@aoi-happywave", handle: "aoi-happywave" },
];

const STORAGE_KEY = "fortune_yt_channels";

export function getChannels(): RegisteredChannel[] {
  if (typeof window === "undefined") return DEFAULT_CHANNELS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CHANNELS));
    return DEFAULT_CHANNELS;
  }
  return JSON.parse(stored);
}

export function saveChannels(channels: RegisteredChannel[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
}

export function addChannel(url: string): RegisteredChannel[] {
  const channels = getChannels();
  const parsed = parseYouTubeUrl(url);
  if (!parsed) return channels;

  // 重複チェック
  const exists = channels.some(
    (ch) =>
      (parsed.handle && ch.handle === parsed.handle) ||
      (parsed.channelId && ch.channelId === parsed.channelId) ||
      ch.url === url
  );
  if (exists) return channels;

  channels.push({ url, ...parsed });
  saveChannels(channels);
  return channels;
}

export function removeChannel(url: string): RegisteredChannel[] {
  const channels = getChannels().filter((ch) => ch.url !== url);
  saveChannels(channels);
  return channels;
}

export function updateChannel(url: string, data: Partial<RegisteredChannel>): RegisteredChannel[] {
  const channels = getChannels().map((ch) =>
    ch.url === url ? { ...ch, ...data, lastFetched: new Date().toISOString() } : ch
  );
  saveChannels(channels);
  return channels;
}

export function parseYouTubeUrl(url: string): { handle?: string; channelId?: string } | null {
  try {
    const cleaned = url.split("?")[0].replace(/\/+$/, "");

    // @handle 形式
    const handleMatch = cleaned.match(/@([\w.-]+)/);
    if (handleMatch) {
      return { handle: handleMatch[1] };
    }

    // /channel/UCxxx 形式
    const channelMatch = cleaned.match(/\/channel\/(UC[\w-]+)/);
    if (channelMatch) {
      return { channelId: channelMatch[1] };
    }

    // /c/name or /user/name 形式
    const userMatch = cleaned.match(/\/(c|user)\/([\w.-]+)/);
    if (userMatch) {
      return { handle: userMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

// APIキー管理
export function getApiKey(key: "yt_api_key" | "ai_api_key"): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) || "";
}

export function setApiKey(key: "yt_api_key" | "ai_api_key", value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}
