// Apifyスクレイパー連携（サーバー側のみ）
// 運用アカウントのログイン情報は一切使わない。公開ページの収集のみ。
// Actorごとに出力スキーマが異なるため、正規化層で共通形式に吸収する。

export const DEFAULT_ACTOR_ID = "apify/threads-scraper";

// Actor候補（上から順に存在チェック→実行を試す。動いたものが設定に保存される）
export const ACTOR_CANDIDATES = [
  "apify/threads-scraper",
  "curious_coder/threads-scraper",
  "epctex/threads-scraper",
];

const APIFY_BASE = "https://api.apify.com/v2";

export interface NormalizedScrapedPost {
  authorHandle: string;
  content: string;
  postUrl: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  views: number;
  postedAt: Date | null;
}

export interface ApifyRunResult {
  items: NormalizedScrapedPost[];
  rawCount: number;
  error?: string;
}

async function apifyFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${APIFY_BASE}${path}${sep}token=${encodeURIComponent(token)}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// 接続テスト: トークンが有効か確認
export async function testApifyConnection(token: string): Promise<{ ok: boolean; username?: string; plan?: string; error?: string }> {
  try {
    const res = await apifyFetch(token, "/users/me");
    const data = (await res.json().catch(() => ({}))) as {
      data?: { username?: string; plan?: { id?: string } };
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}（トークンが正しいか確認してください）` };
    }
    return { ok: true, username: data.data?.username, plan: data.data?.plan?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Actorを起動し、完了を待ってデータセットを取得する
// runTimeoutSecs: Apify側の実行タイムアウト（短いとTIMED-OUTで途中終了する）
// memoryMbytes: 割り当てメモリ（大きいほどCPUが増えて速く終わる＝タイムアウトしにくい）
export async function runActorAndGetItems(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 360000,
  runTimeoutSecs = 300,
  memoryMbytes = 2048,
): Promise<{ items: unknown[]; error?: string }> {
  try {
    // Actor IDの "user/actor-name" は "user~actor-name" 形式に変換
    const escaped = actorId.replace("/", "~");
    // Apifyの実行タイムアウト・メモリをクエリで明示（既定が短いActorのTIMED-OUT対策）
    const startRes = await apifyFetch(token, `/acts/${escaped}/runs?timeout=${runTimeoutSecs}&memory=${memoryMbytes}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const startData = (await startRes.json().catch(() => ({}))) as {
      data?: { id?: string; defaultDatasetId?: string };
      error?: { message?: string };
    };
    if (!startRes.ok || !startData.data?.id) {
      return { items: [], error: `Actor起動失敗: ${startData.error?.message ?? `HTTP ${startRes.status}`}` };
    }
    const runId = startData.data.id;

    // 完了までポーリング
    const deadline = Date.now() + timeoutMs;
    let datasetId = startData.data.defaultDatasetId ?? "";
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      const runRes = await apifyFetch(token, `/actor-runs/${runId}`);
      const runData = (await runRes.json().catch(() => ({}))) as {
        data?: { status?: string; defaultDatasetId?: string; statusMessage?: string };
      };
      const status = runData.data?.status ?? "";
      datasetId = runData.data?.defaultDatasetId ?? datasetId;
      if (status === "SUCCEEDED") break;
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
        return { items: [], error: `Actor実行が${status}: ${runData.data?.statusMessage ?? ""}` };
      }
      if (Date.now() > deadline) {
        // 打ち切り（Apify側の実行は続くが、今回の結果としてはタイムアウト）
        return { items: [], error: "Actor実行がタイムアウトしました。収集件数を減らすか、時間をおいて再実行してください" };
      }
    }

    const itemsRes = await apifyFetch(token, `/datasets/${datasetId}/items?clean=1&format=json&limit=1000`);
    if (!itemsRes.ok) {
      return { items: [], error: `結果取得失敗: HTTP ${itemsRes.status}` };
    }
    const items = (await itemsRes.json().catch(() => [])) as unknown[];
    return { items: Array.isArray(items) ? items : [] };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// 一般的なThreadsスクレイパーActorの入力形式をまとめてカバー
// includeReplies=false のとき、Actorごとに異なるリプライ除外フラグをまとめて渡す（未知フィールドは無視される）
// 件数指定のフィールド名はActor作者ごとにバラバラなので、当たりそうな名前を総当たりで入れる
// （未知フィールドはActor側で無視されるため害はない）
function limitFields(limit: number, handleCount: number): Record<string, number> {
  return {
    resultsLimit: limit,
    postsPerSource: limit,
    maxPosts: limit,
    maxResults: limit,
    limit: limit,
    postLimit: limit,
    maxPostsPerProfile: limit,
    maxPostsPerUser: limit,
    resultsPerPage: limit,
    maxItems: limit * Math.max(1, handleCount),
  };
}

export function buildActorInput(handles: string[], limitPerHandle = 25, includeReplies = false): Record<string, unknown> {
  const urls = handles.map((h) => `https://www.threads.net/@${h}`);
  const base: Record<string, unknown> = {
    usernames: handles,
    urls,
    startUrls: urls.map((url) => ({ url })),
    ...limitFields(limitPerHandle, handles.length),
  };
  if (!includeReplies) {
    base.onlyPosts = true;
    base.includeReplies = false;
    base.scrapeReplies = false;
    base.replies = false;
  }
  return base;
}

// Actorが存在するか（メタデータ取得は無料）
async function actorExists(token: string, actorId: string): Promise<boolean> {
  try {
    const res = await apifyFetch(token, `/acts/${actorId.replace("/", "~")}`);
    return res.ok;
  } catch {
    return false;
  }
}

// Actorのinput schemaをApify APIから取得し、件数指定フィールド名を特定する
// （Actorごとにフィールド名が違うため、推測ではなく実際のスキーマから読む）
async function fetchActorSchemaInfo(
  token: string,
  actorId: string,
): Promise<{ exists: boolean; limitField?: string; integerFields: string[] }> {
  try {
    const escaped = actorId.replace("/", "~");
    const actRes = await apifyFetch(token, `/acts/${escaped}`);
    if (!actRes.ok) return { exists: false, integerFields: [] };
    const actData = (await actRes.json()) as {
      data?: { taggedBuilds?: { latest?: { buildId?: string } } };
    };
    const buildId = actData.data?.taggedBuilds?.latest?.buildId;
    if (!buildId) return { exists: true, integerFields: [] };

    const buildRes = await apifyFetch(token, `/acts/${escaped}/builds/${buildId}`);
    if (!buildRes.ok) return { exists: true, integerFields: [] };
    const buildData = (await buildRes.json()) as { data?: { inputSchema?: unknown } };
    let schema = buildData.data?.inputSchema;
    if (typeof schema === "string") {
      try {
        schema = JSON.parse(schema);
      } catch {
        return { exists: true, integerFields: [] };
      }
    }
    const props = (schema as { properties?: Record<string, { type?: string }> })?.properties ?? {};
    const integerFields = Object.entries(props)
      .filter(([, def]) => def.type === "integer" || def.type === "number")
      .map(([key]) => key);
    // 件数っぽい名前を優先度順に探す
    const limitField =
      integerFields.find((k) => /resultslimit|maxposts|maxresults|postlimit|postspersource/i.test(k)) ??
      integerFields.find((k) => /limit|max|count|results|per.?source/i.test(k)) ??
      undefined;
    return { exists: true, limitField, integerFields };
  } catch {
    return { exists: false, integerFields: [] };
  }
}

export interface ScrapeAttemptResult {
  items: NormalizedScrapedPost[];
  actorUsed: string | null;
  error?: string;
  log: string[];
}

// Actor候補と入力バリエーションを順に試し、投稿が取れた組み合わせを返す。
// どのActor・入力で失敗したかを log に残す（画面に出してデバッグ可能にする）
export async function runThreadsScrapeWithFallback(
  token: string,
  preferredActorId: string | null,
  handles: string[],
  limitPerHandle = 25,
  includeReplies = false,
): Promise<ScrapeAttemptResult> {
  const log: string[] = [];
  const candidates = Array.from(
    new Set([preferredActorId, ...ACTOR_CANDIDATES].filter((a): a is string => Boolean(a))),
  );
  const urls = handles.map((h) => `https://www.threads.net/@${h}`);
  const replyFlags = includeReplies ? {} : { onlyPosts: true, includeReplies: false, scrapeReplies: false };
  const limits = limitFields(limitPerHandle, handles.length);

  for (const actorId of candidates) {
    // Actorの入力仕様をAPIから読み、正しい件数フィールドを特定する
    const schemaInfo = await fetchActorSchemaInfo(token, actorId);
    if (!schemaInfo.exists) {
      log.push(`${actorId}: 存在しない（スキップ）`);
      continue;
    }
    // スキーマで見つけた件数フィールドを最優先で反映（総当たりの名前も保険で残す）
    const schemaLimits: Record<string, number> = { ...limits };
    if (schemaInfo.limitField) {
      schemaLimits[schemaInfo.limitField] = limitPerHandle;
      log.push(`${actorId}: 件数フィールド=${schemaInfo.limitField} に${limitPerHandle}を指定`);
    } else if (schemaInfo.integerFields.length > 0) {
      log.push(`${actorId}: 件数フィールド不明（整数項目: ${schemaInfo.integerFields.join(",")}）`);
    }
    const inputVariants: { label: string; input: Record<string, unknown> }[] = [
      { label: "combined", input: { ...buildActorInput(handles, limitPerHandle, includeReplies), ...schemaLimits } },
      { label: "urls", input: { urls, ...schemaLimits, ...replyFlags } },
      { label: "startUrls", input: { startUrls: urls.map((url) => ({ url })), ...schemaLimits, ...replyFlags } },
      { label: "usernames", input: { usernames: handles, ...schemaLimits, ...replyFlags } },
    ];
    for (const variant of inputVariants) {
      const run = await runActorAndGetItems(token, actorId, variant.input);
      if (run.error) {
        log.push(`${actorId} (${variant.label}): ${run.error}`);
        // 入力形式の問題なら次のバリエーションを試す。それ以外（課金・権限等）は次のActorへ
        if (/input|schema|invalid|required/i.test(run.error)) continue;
        break;
      }
      const items = normalizeItems(run.items, includeReplies);
      if (items.length > 0) {
        log.push(`${actorId} (${variant.label}): 生${run.items.length}件→有効${items.length}件 ✅`);
        // 診断: Actorが返す生データのフィールド名一覧（views取得可否の確認用）
        const firstRaw = run.items.find((r) => r && typeof r === "object");
        if (firstRaw) {
          const keys = Object.keys(firstRaw as Record<string, unknown>);
          log.push(`Actorの返却フィールド: ${keys.join(", ")}`);
          // views系の値があれば具体値も出す
          const obj = firstRaw as Record<string, unknown>;
          const viewLike = keys.filter((k) => /view|impress|play|reach|seen/i.test(k));
          if (viewLike.length > 0) {
            log.push(`閲覧数っぽい項目: ${viewLike.map((k) => `${k}=${JSON.stringify(obj[k])}`).join(", ")}`);
          } else {
            log.push("閲覧数っぽい項目: なし（このActorは閲覧数を返していません）");
          }
        }
        return { items, actorUsed: actorId, log };
      }
      log.push(`${actorId} (${variant.label}): 実行成功したが0件（生${run.items.length}件）`);
      // 0件は入力が効いていない可能性 → 次のバリエーションへ
    }
  }
  return {
    items: [],
    actorUsed: null,
    error: `投稿を取得できませんでした。試行ログ: ${log.join(" / ") || "候補Actorなし"}`,
    log,
  };
}

// ===== 正規化層 =====

function pickNum(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  return 0;
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function pickNested(obj: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur;
  }
  return "";
}

function parsePostedAt(obj: Record<string, unknown>): Date | null {
  for (const k of ["publishedAt", "published_on", "timestamp", "createdAt", "created_at", "postedAt", "taken_at", "publish_date"]) {
    const v = obj[k];
    if (typeof v === "number") {
      // 秒 or ミリ秒を判定
      const d = new Date(v > 1e12 ? v : v * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof v === "string") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// このアイテムがリプライ（返信）投稿か判定
function isReplyItem(obj: Record<string, unknown>): boolean {
  for (const k of ["isReply", "is_reply", "isReplyPost"]) {
    if (obj[k] === true) return true;
  }
  for (const k of ["replyToId", "reply_to_id", "inReplyToId", "in_reply_to", "parentPostId", "parent_post_id", "replyTo", "reply_to"]) {
    const v = obj[k];
    if (v && v !== "" && v !== "0") return true;
  }
  const type = obj.postType ?? obj.post_type ?? obj.type;
  if (typeof type === "string" && /reply|comment/i.test(type)) return true;
  return false;
}

// Actorの生アイテムを共通形式へ。本文が取れないものは捨てる。includeReplies=false ならリプライを除外
export function normalizeItems(raw: unknown[], includeReplies = true): NormalizedScrapedPost[] {
  const results: NormalizedScrapedPost[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    if (!includeReplies && isReplyItem(obj)) continue;
    const content =
      pickStr(obj, ["text", "content", "caption", "body"]) ||
      pickNested(obj, [["post", "caption", "text"], ["caption", "text"], ["thread", "text"]]);
    if (!content) continue;
    const authorHandle = (
      pickStr(obj, ["username", "ownerUsername", "authorUsername", "handle", "user_name"]) ||
      pickNested(obj, [["user", "username"], ["author", "username"], ["owner", "username"]])
    ).replace(/^@/, "");
    results.push({
      authorHandle,
      content,
      postUrl: pickStr(obj, ["url", "postUrl", "link", "permalink", "threadUrl"]),
      likes: pickNum(obj, ["likesCount", "likes", "likeCount", "like_count"]),
      replies: pickNum(obj, ["repliesCount", "commentsCount", "replies", "comments", "replyCount", "reply_count"]),
      reposts: pickNum(obj, ["repostsCount", "reposts", "repostCount", "repost_count", "reshareCount"]),
      quotes: pickNum(obj, ["quotesCount", "quotes", "quoteCount", "quote_count"]),
      views: pickNum(obj, ["viewsCount", "views", "viewCount", "view_count", "impressions", "impressionsCount", "playCount", "reach"]),
      postedAt: parsePostedAt(obj),
    });
  }
  return results;
}

// 投稿URLから投稿コードを抽出（threads.net / threads.com 両対応の同一判定用）
export function extractPostCode(url: string): string | null {
  const m = url.match(/\/post\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
