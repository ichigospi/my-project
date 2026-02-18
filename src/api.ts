import { getBearerToken } from "./config.js";
import type { ApiResponse, Tweet, User, CollectOptions, SearchOptions } from "./types.js";

const BASE_URL = "https://api.twitter.com/2";

const TWEET_FIELDS = "created_at,public_metrics,entities,author_id";
const USER_FIELDS = "description,public_metrics";

async function request<T>(endpoint: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  const token = getBearerToken();
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset ? Math.ceil(Number(reset) - Date.now() / 1000) : 60;
    console.error(`レート制限に達しました。${waitSec}秒後にリトライしてください。`);
    throw new Error(`Rate limited. Retry after ${waitSec}s`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<ApiResponse<T>>;
}

export async function lookupUser(username: string): Promise<User> {
  const clean = username.replace(/^@/, "");
  const res = await request<User>(`/users/by/username/${clean}`, {
    "user.fields": USER_FIELDS,
  });

  if (!res.data) {
    throw new Error(`ユーザー @${clean} が見つかりませんでした。`);
  }
  return res.data;
}

export async function getUserTweets(
  userId: string,
  options: CollectOptions = {}
): Promise<{ tweets: Tweet[]; nextToken?: string }> {
  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "max_results": String(Math.min(options.max || 100, 100)),
  };

  if (options.sinceId) params.since_id = options.sinceId;
  if (options.untilId) params.until_id = options.untilId;
  if (options.startTime) params.start_time = options.startTime;
  if (options.endTime) params.end_time = options.endTime;

  const res = await request<Tweet[]>(`/users/${userId}/tweets`, params);

  return {
    tweets: res.data || [],
    nextToken: res.meta?.next_token,
  };
}

export async function collectAllUserTweets(
  userId: string,
  options: CollectOptions = {}
): Promise<Tweet[]> {
  const maxTotal = options.max || 100;
  const allTweets: Tweet[] = [];
  let nextToken: string | undefined;

  while (allTweets.length < maxTotal) {
    const perPage = Math.min(maxTotal - allTweets.length, 100);
    const params: Record<string, string> = {
      "tweet.fields": TWEET_FIELDS,
      "max_results": String(perPage),
    };

    if (options.sinceId) params.since_id = options.sinceId;
    if (options.untilId) params.until_id = options.untilId;
    if (options.startTime) params.start_time = options.startTime;
    if (options.endTime) params.end_time = options.endTime;
    if (nextToken) params.pagination_token = nextToken;

    const res = await request<Tweet[]>(`/users/${userId}/tweets`, params);

    if (res.data) {
      allTweets.push(...res.data);
    }

    nextToken = res.meta?.next_token;
    if (!nextToken || !res.data?.length) break;
  }

  return allTweets.slice(0, maxTotal);
}

export async function searchRecentTweets(
  options: SearchOptions
): Promise<{ tweets: Tweet[]; users: User[] }> {
  const maxTotal = options.max || 100;
  const allTweets: Tweet[] = [];
  let allUsers: User[] = [];
  let nextToken: string | undefined;

  while (allTweets.length < maxTotal) {
    const perPage = Math.min(maxTotal - allTweets.length, 100);
    const params: Record<string, string> = {
      query: options.query,
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      expansions: "author_id",
      "max_results": String(Math.max(perPage, 10)),
    };

    if (options.sinceId) params.since_id = options.sinceId;
    if (options.untilId) params.until_id = options.untilId;
    if (options.startTime) params.start_time = options.startTime;
    if (options.endTime) params.end_time = options.endTime;
    if (nextToken) params.next_token = nextToken;

    const res = await request<Tweet[]>(`/tweets/search/recent`, params);

    if (res.data) {
      allTweets.push(...res.data);
    }
    if (res.includes?.users) {
      allUsers = [...allUsers, ...res.includes.users];
    }

    nextToken = res.meta?.next_token;
    if (!nextToken || !res.data?.length) break;
  }

  // dedupe users
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  return {
    tweets: allTweets.slice(0, maxTotal),
    users: [...userMap.values()],
  };
}
