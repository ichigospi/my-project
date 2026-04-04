// X API v2 クライアントラッパー

const X_API_BASE = "https://api.twitter.com/2";

interface XApiResponse<T> {
  data?: T;
  error?: string;
}

async function xFetch<T>(
  endpoint: string,
  bearerToken: string,
  options?: RequestInit
): Promise<XApiResponse<T>> {
  try {
    const res = await fetch(`${X_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      return { error: errorBody?.detail || errorBody?.errors?.[0]?.message || `X API Error: ${res.status}` };
    }

    const data = await res.json();
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "X APIリクエストに失敗しました" };
  }
}

// ===== OAuth 2.0 PKCE =====
export function buildAuthUrl(clientId: string, redirectUri: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeToken(
  code: string, clientId: string, clientSecret: string, redirectUri: string, codeVerifier: string
): Promise<XApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>> {
  try {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); return { error: err?.error_description || "トークン交換に失敗しました" }; }
    return { data: await res.json() };
  } catch (err) { return { error: err instanceof Error ? err.message : "トークン交換エラー" }; }
}

// ===== ユーザー情報 =====
export interface XUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: { followers_count: number; following_count: number; tweet_count: number; listed_count: number };
}

export async function getMe(bearerToken: string): Promise<XApiResponse<XUser>> {
  const result = await xFetch<{ data: XUser }>("/users/me?user.fields=public_metrics", bearerToken);
  if (result.error) return { error: result.error };
  return { data: result.data?.data };
}

// ===== ツイート投稿 =====
export async function postTweet(
  bearerToken: string, params: { text: string; reply_to?: string; quote_tweet_id?: string }
): Promise<XApiResponse<{ id: string; text: string }>> {
  const body: Record<string, unknown> = { text: params.text };
  if (params.reply_to) body.reply = { in_reply_to_tweet_id: params.reply_to };
  if (params.quote_tweet_id) body.quote_tweet_id = params.quote_tweet_id;
  const result = await xFetch<{ data: { id: string; text: string } }>("/tweets", bearerToken, { method: "POST", body: JSON.stringify(body) });
  if (result.error) return { error: result.error };
  return { data: result.data?.data };
}

// ===== ツイート検索 =====
export interface SearchTweet {
  id: string; text: string; author_id: string; created_at: string;
  public_metrics?: { retweet_count: number; reply_count: number; like_count: number; quote_count: number; impression_count: number };
}

export async function searchRecentTweets(
  bearerToken: string, query: string, maxResults = 20
): Promise<XApiResponse<SearchTweet[]>> {
  const params = new URLSearchParams({ query, max_results: String(maxResults), "tweet.fields": "created_at,public_metrics,author_id", sort_order: "relevancy" });
  const result = await xFetch<{ data: SearchTweet[] }>(`/tweets/search/recent?${params.toString()}`, bearerToken);
  if (result.error) return { error: result.error };
  return { data: result.data?.data || [] };
}

// ===== ユーザーのツイート取得 =====
export async function getUserTweets(bearerToken: string, userId: string, maxResults = 20): Promise<XApiResponse<SearchTweet[]>> {
  const params = new URLSearchParams({ max_results: String(maxResults), "tweet.fields": "created_at,public_metrics" });
  const result = await xFetch<{ data: SearchTweet[] }>(`/users/${userId}/tweets?${params.toString()}`, bearerToken);
  if (result.error) return { error: result.error };
  return { data: result.data?.data || [] };
}

// ===== トレンド（日本） =====
export async function getJapanTrends(bearerToken: string): Promise<XApiResponse<{ name: string; tweet_volume: number | null }[]>> {
  try {
    const res = await fetch("https://api.twitter.com/1.1/trends/place.json?id=23424856", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) return { error: "トレンド取得に失敗しました" };
    const data = await res.json();
    return { data: (data[0]?.trends || []).map((t: { name: string; tweet_volume: number | null }) => ({ name: t.name, tweet_volume: t.tweet_volume })) };
  } catch { return { error: "トレンドAPIエラー" }; }
}
