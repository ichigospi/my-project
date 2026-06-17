// 共有設定の同期（localStorageとサーバーDBをマージ）
// ルール: サーバーとローカルの両方を保持。どちらかにしかないデータは追加。

import { getApiKey, setApiKey, getChannels, saveChannels } from "./channel-store";
import {
  getProfile, saveProfile,
  getAllProfiles, saveProfileByChannel,
  getAIInsights, saveAIInsight,
  type ChannelProfile, type AIAnalysisInsight,
} from "./script-analysis-store";
import {
  getHooks, getCTAs, getThumbnailWords, getTitles,
  getPresets, savePreset,
  getProjects, getTasks, getMembers,
  getMyChannelDataList, saveMyChannelData,
  getAnalysisLogs, getWeeklySnapshots, getPerformanceRecords,
  type HookEntry, type CTAEntry, type ThumbnailWordEntry, type TitleEntry,
  type ScriptProject, type ProductionTask, type MyChannelData,
  type AnalysisLog, type WeeklySnapshot, type PerformanceRecord,
} from "./project-store";
import {
  getWinningPatternsList, saveWinningPatternsByChannel,
  type WinningPatterns,
} from "./winning-patterns-store";
import {
  getIdeas,
  getIdeaRulesList, saveIdeaRulesByChannel,
  type IdeaEntry, type IdeaRules,
} from "./idea-store";
import type { RegisteredChannel } from "./channel-store";
import type { MyChannel } from "./channel-context";

const MY_CHANNELS_KEY = "fortune_yt_my_channels";
const ACTIVE_CHANNEL_KEY = "fortune_yt_active_channel";

// MyChannel を「同じ名前なら同一」とみなしてマージし、id統一に必要な書き換えマップを返す
function mergeMyChannelsByName(
  local: MyChannel[],
  server: MyChannel[]
): { merged: MyChannel[]; idMigrations: Record<string, string> } {
  const all = [...local, ...server];
  const byName = new Map<string, MyChannel[]>();
  for (const ch of all) {
    const key = ch.name || "";
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(ch);
  }
  const merged: MyChannel[] = [];
  const idMigrations: Record<string, string> = {};
  for (const group of byName.values()) {
    // createdAt 昇順で先に作られた方をcanonicalにする
    const sorted = group.slice().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    const canonical = sorted[0];
    merged.push(canonical);
    for (const dupe of sorted.slice(1)) {
      if (dupe.id !== canonical.id) idMigrations[dupe.id] = canonical.id;
    }
  }
  return { merged, idMigrations };
}

// channelIdを持つアイテム配列に対して書き換えを適用
function migrateChannelIds<T extends { channelId?: string }>(
  items: T[],
  migrations: Record<string, string>
): { items: T[]; changed: boolean } {
  let changed = false;
  const next = items.map((it) => {
    if (it.channelId && migrations[it.channelId]) {
      changed = true;
      return { ...it, channelId: migrations[it.channelId] };
    }
    return it;
  });
  return { items: next, changed };
}

// ローカルストレージのキーを書き換えるヘルパー（channelIdフィールド対象）
function applyMigrationToStorageKey(key: string, migrations: Record<string, string>) {
  applyMigrationToStorageKeyByField(key, "channelId", migrations);
}

// 任意のフィールド名で書き換え（MyChannelData の internalChannelId など）
function applyMigrationToStorageKeyByField(
  key: string,
  fieldName: string,
  migrations: Record<string, string>
) {
  const stored = localStorage.getItem(key);
  if (!stored) return;
  try {
    const items = JSON.parse(stored);
    if (!Array.isArray(items)) return;
    let changed = false;
    const next = items.map((it) => {
      const cur = it[fieldName];
      if (typeof cur === "string" && migrations[cur]) {
        changed = true;
        return { ...it, [fieldName]: migrations[cur] };
      }
      return it;
    });
    if (changed) localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

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
  // チャンネル設定は「オーナーが管理しメンバーが参照する」性質のため、
  // サーバー値を優先する。サーバーが空の項目だけローカル値を残す。
  // (admin 側で個別編集→未push の状態が pull に潰されることはあるが、
  //  通常は保存=即push なので問題にならない)
  return {
    channelName: server.channelName || local.channelName || "",
    concept: server.concept || local.concept || "",
    tone: server.tone || local.tone || "",
    target: server.target || local.target || "",
    genres: server.genres?.length > 0 ? server.genres : local.genres || [],
    mainStyle: server.mainStyle || local.mainStyle || "healing",
    characteristics: server.characteristics || local.characteristics || "",
    commonRules: server.commonRules || local.commonRules || "",
    ngExpressions: server.ngExpressions || local.ngExpressions || "",
    referenceAnalysisIds: [...new Set([...(server.referenceAnalysisIds || []), ...(local.referenceAnalysisIds || [])])],
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
    if (data.openai_api_key && !getApiKey("openai_api_key")) {
      setApiKey("openai_api_key", data.openai_api_key);
    }

    // 自分のチャンネル(MyChannel): 同名マージ + id統一書き換え
    // ※ projects/tasks/hooks 等のマージ「前」に走らせる必要がある
    let channelMigrations: Record<string, string> = {};
    if (Array.isArray(data.myChannels) && data.myChannels.length > 0) {
      const localMyCh: MyChannel[] = JSON.parse(localStorage.getItem(MY_CHANNELS_KEY) || "[]");
      const { merged: mergedCh, idMigrations } = mergeMyChannelsByName(localMyCh, data.myChannels);
      localStorage.setItem(MY_CHANNELS_KEY, JSON.stringify(mergedCh));
      channelMigrations = idMigrations;

      // アクティブチャンネルが書き換え対象なら追従
      const activeId = localStorage.getItem(ACTIVE_CHANNEL_KEY) || "";
      if (channelMigrations[activeId]) {
        localStorage.setItem(ACTIVE_CHANNEL_KEY, channelMigrations[activeId]);
      }
      // 既存ローカルのchannelIdを書き換え
      if (Object.keys(channelMigrations).length > 0) {
        // channelIdフィールドを持つストア
        for (const k of [
          "fortune_yt_projects", "fortune_yt_tasks",
          "fortune_yt_hooks", "fortune_yt_ctas",
          "fortune_yt_thumbnail_words", "fortune_yt_titles",
          "fortune_yt_ideas",
          "fortune_yt_analysis_log",
          "fortune_yt_weekly",
          "fortune_yt_performance",
          "fortune_yt_winning_patterns_list",
          "fortune_yt_idea_rules_list",
          "fortune_yt_presets",
        ]) {
          applyMigrationToStorageKey(k, channelMigrations);
        }
        // MyChannelData は internalChannelId フィールドなので個別対応
        applyMigrationToStorageKeyByField(
          "fortune_yt_my_channel_data_list", "internalChannelId", channelMigrations
        );
        // ChannelProvider に再読込を促す
        window.dispatchEvent(new Event("fortune_yt_my_channels_updated"));
      }
    }

    // 受信データ側のchannelIdも書き換える小ヘルパー
    const migrate = <T extends { channelId?: string }>(arr: T[] | undefined): T[] =>
      arr ? migrateChannelIds(arr, channelMigrations).items : [];

    // チャンネル: マージ
    if (data.channels?.length > 0) {
      const merged = mergeChannels(getChannels(), data.channels);
      saveChannels(merged);
    }

    // フック: マージ
    if (data.hooks?.length > 0) {
      const merged = mergeById(getHooks(), migrate(data.hooks as HookEntry[]));
      localStorage.setItem("fortune_yt_hooks", JSON.stringify(merged));
    }

    // CTA: マージ
    if (data.ctas?.length > 0) {
      const merged = mergeById(getCTAs(), migrate(data.ctas as CTAEntry[]));
      localStorage.setItem("fortune_yt_ctas", JSON.stringify(merged));
    }

    // サムネワード: マージ
    if (data.thumbnailWords?.length > 0) {
      const merged = mergeById(getThumbnailWords(), migrate(data.thumbnailWords as ThumbnailWordEntry[]));
      localStorage.setItem("fortune_yt_thumbnail_words", JSON.stringify(merged));
    }

    // タイトル: マージ
    if (data.titles?.length > 0) {
      const merged = mergeById(getTitles(), migrate(data.titles as TitleEntry[]));
      localStorage.setItem("fortune_yt_titles", JSON.stringify(merged));
    }

    // プロフィール: 旧singleton (後方互換)
    if (data.profile) {
      const merged = mergeProfile(getProfile(), data.profile);
      saveProfile(merged);
    }

    // チャンネル別プロフィール: channelId毎にマージ
    if (Array.isArray(data.profilesList) && data.profilesList.length > 0) {
      const localList = getAllProfiles();
      for (const incoming of data.profilesList as ChannelProfile[]) {
        const key = incoming.channelId || "";
        const existing = localList.find((p) => (p.channelId || "") === key);
        const merged = mergeProfile(existing || incoming, incoming);
        saveProfileByChannel({ ...merged, channelId: key });
      }
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

    // プロジェクト（台本作成）: 専用エンドポイント /api/projects から取得（巨大ブロブ回避）
    try {
      const pjRes = await fetch("/api/projects");
      if (pjRes.ok) {
        const pjData = await pjRes.json();
        const remote = Array.isArray(pjData.projects) ? (pjData.projects as ScriptProject[]) : [];
        if (remote.length > 0) {
          const local: ScriptProject[] = JSON.parse(localStorage.getItem("fortune_yt_projects") || "[]");
          const merged = mergeByUpdatedAt(local, migrate(remote));
          localStorage.setItem("fortune_yt_projects", JSON.stringify(merged));
        }
      }
    } catch (e) {
      console.warn("[shared-sync] pull projects failed:", e);
    }

    // 工程表タスク: 更新日時ベースでマージ
    if (data.tasks?.length > 0) {
      const local: ProductionTask[] = JSON.parse(localStorage.getItem("fortune_yt_tasks") || "[]");
      const merged = mergeByUpdatedAt(local, migrate(data.tasks as ProductionTask[]));
      localStorage.setItem("fortune_yt_tasks", JSON.stringify(merged));
    }

    // メンバー: マージ
    if (data.members?.length > 0) {
      const local: string[] = JSON.parse(localStorage.getItem("fortune_yt_members") || "[]");
      const merged = [...new Set([...local, ...data.members])];
      localStorage.setItem("fortune_yt_members", JSON.stringify(merged));
    }

    // 自チャンネルデータ(YouTube情報): チャンネル毎にupsert
    // 新形式 myChannelDataList が優先、無ければ旧 myChannel(singular)を1件として扱う
    const incomingMyChData: MyChannelData[] = Array.isArray(data.myChannelDataList)
      ? data.myChannelDataList
      : data.myChannel ? [data.myChannel] : [];
    if (incomingMyChData.length > 0) {
      const localList = getMyChannelDataList();
      for (const incoming of incomingMyChData) {
        const key = incoming.internalChannelId || "";
        const existing = localList.find((d) => (d.internalChannelId || "") === key);
        // ローカルに無いか、サーバー側のlastFetchedの方が新しければ採用
        if (!existing || (incoming.lastFetched || "") > (existing.lastFetched || "")) {
          saveMyChannelData(incoming);
        }
      }
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

    // 勝ちパターン(チャンネル別): updatedAt新しい方を採用してチャンネル毎にupsert
    // 新形式 winningPatternsList が優先、無ければ旧 winningPatterns(singular)を1件として扱う
    const incomingWP: WinningPatterns[] = Array.isArray(data.winningPatternsList)
      ? data.winningPatternsList
      : data.winningPatterns ? [data.winningPatterns] : [];
    if (incomingWP.length > 0) {
      const localList = getWinningPatternsList();
      for (const incoming of incomingWP) {
        const key = incoming.channelId || "";
        const existing = localList.find((p) => (p.channelId || "") === key);
        if (!existing || (incoming.updatedAt || "") > (existing.updatedAt || "")) {
          saveWinningPatternsByChannel(incoming);
        }
      }
    }

    // 企画: マージ
    if (data.ideas?.length > 0) {
      const local: IdeaEntry[] = JSON.parse(localStorage.getItem("fortune_yt_ideas") || "[]");
      const merged = mergeById(local, migrate(data.ideas as IdeaEntry[]));
      localStorage.setItem("fortune_yt_ideas", JSON.stringify(merged));
    }

    // 企画ルール(チャンネル別): channelId毎にupsert（ローカル分が空っぽならサーバー優先）
    // 新形式 ideaRulesList が優先、無ければ旧 ideaRules(singular)を1件として扱う
    const incomingIR: IdeaRules[] = Array.isArray(data.ideaRulesList)
      ? data.ideaRulesList
      : data.ideaRules ? [data.ideaRules] : [];
    if (incomingIR.length > 0) {
      const localList = getIdeaRulesList();
      for (const incoming of incomingIR) {
        const key = incoming.channelId || "";
        const existing = localList.find((r) => (r.channelId || "") === key);
        if (!existing || (!existing.direction && !existing.constraints)) {
          saveIdeaRulesByChannel(incoming);
        }
      }
    }

    // AI分析の気づき: idベースでマージ
    if (Array.isArray(data.aiInsights) && data.aiInsights.length > 0) {
      const local = getAIInsights();
      const localIds = new Set(local.map((i) => i.id));
      for (const ins of data.aiInsights as AIAnalysisInsight[]) {
        if (!localIds.has(ins.id)) saveAIInsight(ins);
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
        openai_api_key: getApiKey("openai_api_key"),
        channels: getChannels(),
        hooks: getHooks(),
        ctas: getCTAs(),
        thumbnailWords: getThumbnailWords(),
        titles: getTitles(),
        profile: getProfile(),
        profilesList: getAllProfiles(),
        presets: getPresets(),
        // projects は別エンドポイント /api/projects で保存（巨大ブロブ防止）
        tasks: getTasks(),
        members: getMembers(),
        myChannelDataList: getMyChannelDataList(),
        analysisLogs: getAnalysisLogs(),
        weeklySnapshots: getWeeklySnapshots(),
        performanceRecords: getPerformanceRecords(),
        winningPatternsList: getWinningPatternsList(),
        ideas: getIdeas(),
        ideaRulesList: getIdeaRulesList(),
        aiInsights: getAIInsights(),
        myChannels: typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem(MY_CHANNELS_KEY) || "[]")
          : [],
      }),
    });
    if (!res.ok) {
      notifySync("error");
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || `保存に失敗しました (HTTP ${res.status})` };
    }
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.failed) && data.failed.length > 0) {
      notifySync("error");
      const detail = data.failed
        .map((f: { key: string; size: number; error: string }) => `${f.key}(${Math.round(f.size / 1024)}KB)`)
        .join(", ");
      console.error("[shared-sync] 一部のデータの同期に失敗:", data.failed);
      return { ok: false, error: `一部のデータが同期できませんでした: ${detail}` };
    }
    // プロジェクト（台本）は専用エンドポイント /api/projects に
    // **チャンク分割**して送る（リクエストボディが巨大化して経路で潰されるのを防ぐ）。
    // 旧実装は全プロジェクトを1リクエストにまとめており、台本が貯まると
    // proxy で切られて "Failed to fetch" になっていた。
    try {
      const allProjects = getProjects();
      const CHUNK_SIZE = 3; // 1リクエストあたりのプロジェクト数（生成台本込みで安全な数）
      const failedProjects: { id: string; size: number; error: string }[] = [];

      for (let i = 0; i < allProjects.length; i += CHUNK_SIZE) {
        const chunk = allProjects.slice(i, i + CHUNK_SIZE);
        const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(allProjects.length / CHUNK_SIZE);
        try {
          const pjRes = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projects: chunk }),
          });
          if (!pjRes.ok) {
            const err = await pjRes.json().catch(() => ({}));
            const reason = err.error || `HTTP ${pjRes.status}`;
            console.error(`[shared-sync] project chunk ${chunkIdx}/${totalChunks} failed:`, reason);
            for (const p of chunk) {
              failedProjects.push({ id: p.id, size: JSON.stringify(p).length, error: reason });
            }
            continue;
          }
          const pjData = await pjRes.json().catch(() => ({}));
          if (Array.isArray(pjData.failed) && pjData.failed.length > 0) {
            failedProjects.push(...pjData.failed);
          }
        } catch (e) {
          const reason = String(e).slice(0, 200);
          console.error(`[shared-sync] project chunk ${chunkIdx}/${totalChunks} threw:`, reason);
          for (const p of chunk) {
            failedProjects.push({ id: p.id, size: JSON.stringify(p).length, error: reason });
          }
        }
      }

      if (failedProjects.length > 0) {
        notifySync("error");
        const detail = failedProjects
          .slice(0, 3) // エラーメッセージは長くなりすぎないように先頭3件のみ
          .map((f) => `${f.id}(${Math.round(f.size / 1024)}KB)`)
          .join(", ");
        const more = failedProjects.length > 3 ? ` 他${failedProjects.length - 3}件` : "";
        return { ok: false, error: `${failedProjects.length}件のプロジェクト同期に失敗: ${detail}${more}` };
      }
    } catch (e) {
      notifySync("error");
      return { ok: false, error: `プロジェクト同期に失敗: ${String(e)}` };
    }

    notifySync("synced");
    console.log("[shared-sync] pushed settings to server");
    return { ok: true };
  } catch (e) {
    notifySync("error");
    return { ok: false, error: String(e) };
  }
}
