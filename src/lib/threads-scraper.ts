// Apifyスクレイパー連携（サーバー側のみ）
// 運用アカウントのログイン情報は一切使わない。公開ページの収集のみ。
// Actorごとに出力スキーマが異なるため、正規化層で共通形式に吸収する。

export const DEFAULT_ACTOR_ID = "apify/threads-scraper";

const APIFY_BASE = "https://api.apify.com/v2";

export interface NormalizedScrapedPost {
  authorHandle: string;
  content: string;
  postUrl: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
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
export async function runActorAndGetItems(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 240000,
): Promise<{ items: unknown[]; error?: string }> {
  try {
    // Actor IDの "user/actor-name" は "user~actor-name" 形式に変換
    const escaped = actorId.replace("/", "~");
    const startRes = await apifyFetch(token, `/acts/${escaped}/runs`, {
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
export function buildActorInput(handles: string[], limitPerHandle = 25): Record<string, unknown> {
  const urls = handles.map((h) => `https://www.threads.net/@${h}`);
  return {
    usernames: handles,
    urls,
    startUrls: urls.map((url) => ({ url })),
    resultsLimit: limitPerHandle,
    maxItems: limitPerHandle * handles.length,
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

// Actorの生アイテムを共通形式へ。本文が取れないものは捨てる
export function normalizeItems(raw: unknown[]): NormalizedScrapedPost[] {
  const results: NormalizedScrapedPost[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
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
