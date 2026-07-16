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
  type ScriptProject, type ProductionTask, type MyChannelData, type ScriptRulePreset,
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
  // まず同一IDの重複を解消する。
  // リネーム（例: 金華→きん婆）すると、他端末では「旧名(ID:X)」と「新名(ID:X)」が
  // 同じIDで並んでしまい、セレクタで新名を選んでも旧名が表示される不具合になる。
  // 同じIDは同じチャンネルなので1つに統一する。優先順位は
  //   1. updatedAt（リネーム時刻）が新しい方 … 古いリストを持つ端末のpushで巻き戻らないように
  //   2. どちらも無ければサーバー側
  const byId = new Map<string, MyChannel>();
  for (const ch of [...server, ...local]) {
    const prev = byId.get(ch.id);
    if (!prev) { byId.set(ch.id, ch); continue; }
    if ((ch.updatedAt || "") > (prev.updatedAt || "")) byId.set(ch.id, ch);
  }
  const all = [...byId.values()];
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

// 直近の成功した pull の時刻 / 進行中の pull Promise を保持し、
// 短時間内の重複呼び出しを抑止する（複数ページがマウント時に pull するため）
let lastPullAt = 0;
let inFlightPull: Promise<void> | null = null;
const PULL_CACHE_MS = 30_000; // 30秒以内の再pullはスキップ

export async function pullSharedSettings(opts?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  // 進行中の pull があればそれを待つ（重複fetchの完全抑止）
  if (inFlightPull) return inFlightPull;
  // 直近 PULL_CACHE_MS 内に成功していたらスキップ（明示 force のときだけ無視）
  if (!opts?.force && now - lastPullAt < PULL_CACHE_MS) return;

  inFlightPull = (async () => {
    try {
      notifySync("syncing");
      // 一時的な失敗（5xx・通信断）は最大3回リトライ
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch("/api/shared-settings");
          if (res.ok || res.status < 500) break;
        } catch { res = null; }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
      if (!res || !res.ok) {
        const errBody = res ? await res.text().catch(() => "") : "(接続できません)";
        notifySync("error", `pull失敗: GET /api/shared-settings ${res ? `HTTP ${res.status}` : ""} ${errBody.slice(0, 120)}（3回再試行済み）`);
        return;
    }
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
      const prevJson = localStorage.getItem(MY_CHANNELS_KEY) || "[]";
      const localMyCh: MyChannel[] = JSON.parse(prevJson);
      const { merged: mergedCh, idMigrations } = mergeMyChannelsByName(localMyCh, data.myChannels);
      const mergedJson = JSON.stringify(mergedCh);
      localStorage.setItem(MY_CHANNELS_KEY, mergedJson);
      channelMigrations = idMigrations;
      // リスト内容が変わった場合（ID重複の解消・リネーム反映など）は、
      // ID移行が無くてもChannelProviderに再読込を促す
      if (mergedJson !== prevJson && Object.keys(channelMigrations).length === 0) {
        window.dispatchEvent(new Event("fortune_yt_my_channels_updated"));
      }

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
          // チャンネル設計（プロフィール）。ここが漏れているとID統一後に
          // getProfileByChannel が空を返し、台本生成が参考動画の人物像に乗っ取られる
          "fortune_yt_profiles",
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
    // 受信側にもID統一の書き換えを適用する（サーバーに古いIDで保存された
    // プロフィールが、統一後のIDと別枠で残り続けるのを防ぐ）
    if (Array.isArray(data.profilesList) && data.profilesList.length > 0) {
      for (const incoming of migrate(data.profilesList as ChannelProfile[])) {
        const key = incoming.channelId || "";
        const existing = getAllProfiles().find((p) => (p.channelId || "") === key);
        const merged = mergeProfile(existing || incoming, incoming);
        saveProfileByChannel({ ...merged, channelId: key });
      }
    }

    // プロフィールの重複行を整理（ID統一の結果、同じchannelIdが複数行になった場合、
    // 中身が埋まっている方を残す）
    {
      const all = getAllProfiles();
      const byKey = new Map<string, ChannelProfile>();
      for (const p of all) {
        const key = p.channelId || "";
        const prev = byKey.get(key);
        if (!prev) { byKey.set(key, p); continue; }
        const filled = (x: ChannelProfile) => [x.channelName, x.concept, x.tone, x.commonRules].filter(Boolean).length;
        byKey.set(key, filled(p) > filled(prev) ? p : prev);
      }
      if (byKey.size !== all.length) {
        localStorage.setItem("fortune_yt_profiles", JSON.stringify([...byKey.values()]));
      }
    }

    // プリセット: マージ（受信側もID統一を適用）
    if (data.presets?.length > 0) {
      const localPresets = getPresets();
      for (const sp of migrate(data.presets as ScriptRulePreset[])) {
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
    const incomingMyChDataRaw: MyChannelData[] = Array.isArray(data.myChannelDataList)
      ? data.myChannelDataList
      : data.myChannel ? [data.myChannel] : [];
    // internalChannelId にもID統一を適用
    const incomingMyChData = incomingMyChDataRaw.map((d) =>
      d.internalChannelId && channelMigrations[d.internalChannelId]
        ? { ...d, internalChannelId: channelMigrations[d.internalChannelId] }
        : d
    );
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
    const incomingWP: WinningPatterns[] = migrate(
      Array.isArray(data.winningPatternsList)
        ? data.winningPatternsList
        : data.winningPatterns ? [data.winningPatterns] : []
    );
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
    const incomingIR: IdeaRules[] = migrate(
      Array.isArray(data.ideaRulesList)
        ? data.ideaRulesList
        : data.ideaRules ? [data.ideaRules] : []
    );
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
      lastPullAt = Date.now();
    } catch (e) {
      notifySync("error", `pull例外: ${String(e).slice(0, 200)}`);
      console.error("[shared-sync] pull failed:", e);
    } finally {
      inFlightPull = null;
    }
  })();
  return inFlightPull;
}

// 同期ステータス通知
type SyncListener = (status: "syncing" | "synced" | "error") => void;
const syncListeners = new Set<SyncListener>();
export function onSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
// 直近のエラー詳細を保持（UI に表示するため）
let lastSyncError: string = "";
export function getLastSyncError(): string {
  return lastSyncError;
}
function notifySync(status: "syncing" | "synced" | "error", errorDetail?: string) {
  if (status === "error" && errorDetail) {
    lastSyncError = errorDetail;
    console.error("[shared-sync] error:", errorDetail);
  } else if (status === "synced") {
    lastSyncError = "";
  }
  syncListeners.forEach((l) => l(status));
}

// ===== push の堅牢化 =====
// 前回push成功時の内容ハッシュ。変更が無いキーはスキップして
// リクエスト数を減らし、同期失敗の確率とサーバー負荷を下げる。
const PUSH_HASH_PREFIX = "sync_push_hash_";
function contentHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}_${h}`;
}

// POSTを最大3回リトライ（5xx・通信エラーのみ）。401は即中断シグナルとして返す。
async function postWithRetry(
  url: string,
  body: string,
  attempts = 3
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; error?: string }> {
  let lastErr = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (r.status === 401) {
        return { ok: false, status: 401, data: {}, error: "セッション切れ（再ログインが必要）" };
      }
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.ok) return { ok: true, status: r.status, data: d };
      lastErr = (d as { error?: string }).error || `HTTP ${r.status}`;
      if (r.status < 500) return { ok: false, status: r.status, data: d, error: lastErr }; // 4xxは再試行しない
    } catch (e) {
      lastErr = `通信エラー: ${String(e).slice(0, 120)}`;
    }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  return { ok: false, status: 0, data: {}, error: lastErr };
}

export async function pushSharedSettings(): Promise<{ ok: boolean; error?: string }> {
  try {
    notifySync("syncing");

    // 全データを「キー単位の独立リクエスト」で送る。
    // 1回にまとめると aiInsights / analysisLogs 等が肥大して
    // "Failed to fetch" (proxy切断) を引き起こすため、項目ごとに分割。
    const payloadParts: Record<string, unknown> = {
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
    };

    const failedKeys: { key: string; size: number; error: string }[] = [];
    for (const [key, value] of Object.entries(payloadParts)) {
      // 空のAPIキーは送らない（サーバーの共有キーを空文字で潰さない）
      if ((key === "yt_api_key" || key === "ai_api_key" || key === "openai_api_key") && !value) continue;
      const body = JSON.stringify({ [key]: value });
      // 前回push成功時から変更が無いキーはスキップ（差分push）
      const hashKey = PUSH_HASH_PREFIX + key;
      const h = contentHash(body);
      if (localStorage.getItem(hashKey) === h) continue;

      const r = await postWithRetry("/api/shared-settings", body);
      if (r.status === 401) {
        // 認証切れは以降のリクエストも全部失敗するため即中断し、原因を明示する
        const msg = "セッションが切れています。ページを再読み込みしてログインし直してください（同期は中断しました。データはこの端末に保存されています）";
        notifySync("error", msg);
        return { ok: false, error: msg };
      }
      if (!r.ok) {
        failedKeys.push({ key, size: body.length, error: r.error || "不明なエラー" });
        continue;
      }
      if (Array.isArray(r.data.failed) && (r.data.failed as unknown[]).length > 0) {
        failedKeys.push(...(r.data.failed as { key: string; size: number; error: string }[]));
        continue;
      }
      localStorage.setItem(hashKey, h);
    }

    if (failedKeys.length > 0) {
      // 「なぜ」失敗したかを必ず表示する（原因調査のため）
      const detail = failedKeys
        .slice(0, 2)
        .map((f) => `${f.key}(${Math.round(f.size / 1024)}KB): ${f.error}`)
        .join(" / ");
      const more = failedKeys.length > 2 ? ` 他${failedKeys.length - 2}件` : "";
      const msg = `${failedKeys.length}個の項目で同期失敗: ${detail}${more}（自動で3回まで再試行済み。次回のpushで再送されます）`;
      notifySync("error", msg);
      return { ok: false, error: msg };
    }

    // プロジェクト（台本）は専用エンドポイント /api/projects に
    // **チャンク分割**して送る（リクエストボディが巨大化して経路で潰されるのを防ぐ）。
    // 旧実装は全プロジェクトを1リクエストにまとめており、台本が貯まると
    // proxy で切られて "Failed to fetch" になっていた。
    try {
      // 前回push成功時から変更が無いプロジェクトはスキップ（差分push）。
      // 台本が貯まるほどリクエストが膨らみ同期失敗の主因になっていたため、
      // 変更分だけ送ることで通常時は0〜数件に抑える。
      const allProjects = getProjects();
      const projectHashes = new Map<string, string>();
      const changedProjects = allProjects.filter((p) => {
        const h = contentHash(JSON.stringify(p));
        projectHashes.set(p.id, h);
        return localStorage.getItem(PUSH_HASH_PREFIX + "project_" + p.id) !== h;
      });
      const CHUNK_SIZE = 3; // 1リクエストあたりのプロジェクト数（生成台本込みで安全な数）
      const failedProjects: { id: string; size: number; error: string }[] = [];

      for (let i = 0; i < changedProjects.length; i += CHUNK_SIZE) {
        const chunk = changedProjects.slice(i, i + CHUNK_SIZE);
        const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(changedProjects.length / CHUNK_SIZE);
        const r = await postWithRetry("/api/projects", JSON.stringify({ projects: chunk }));
        if (r.status === 401) {
          const msg = "セッションが切れています。ページを再読み込みしてログインし直してください（同期は中断しました）";
          notifySync("error", msg);
          return { ok: false, error: msg };
        }
        if (!r.ok) {
          const reason = r.error || "不明なエラー";
          console.error(`[shared-sync] project chunk ${chunkIdx}/${totalChunks} failed:`, reason);
          for (const p of chunk) {
            failedProjects.push({ id: p.id, size: JSON.stringify(p).length, error: reason });
          }
          continue;
        }
        const failedIds = new Set(
          Array.isArray(r.data.failed)
            ? (r.data.failed as { id: string }[]).map((f) => f.id)
            : []
        );
        if (Array.isArray(r.data.failed) && (r.data.failed as unknown[]).length > 0) {
          failedProjects.push(...(r.data.failed as { id: string; size: number; error: string }[]));
        }
        // 成功したプロジェクトだけハッシュを記録（失敗分は次回pushで再送される）
        for (const p of chunk) {
          if (!failedIds.has(p.id)) {
            localStorage.setItem(PUSH_HASH_PREFIX + "project_" + p.id, projectHashes.get(p.id) || "");
          }
        }
      }

      if (failedProjects.length > 0) {
        const detail = failedProjects
          .slice(0, 2) // エラーメッセージは長くなりすぎないように先頭2件のみ
          .map((f) => `${f.id}(${Math.round(f.size / 1024)}KB): ${f.error}`)
          .join(" / ");
        const more = failedProjects.length > 3 ? ` 他${failedProjects.length - 3}件` : "";
        const msg = `${failedProjects.length}件のプロジェクト同期に失敗: ${detail}${more}`;
        notifySync("error", msg);
        return { ok: false, error: msg };
      }
    } catch (e) {
      const msg = `プロジェクト同期例外: ${String(e).slice(0, 200)}`;
      notifySync("error", msg);
      return { ok: false, error: msg };
    }

    notifySync("synced");
    console.log("[shared-sync] pushed settings to server");
    return { ok: true };
  } catch (e) {
    const msg = `push例外: ${String(e).slice(0, 200)}`;
    notifySync("error", msg);
    return { ok: false, error: msg };
  }
}
