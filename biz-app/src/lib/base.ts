// BASE API連携（OAuth 2.0 + 注文同期）
// https://docs.thebase.in/api/ 参照。access_tokenは約1時間で失効、refresh_tokenで更新する
import { prisma } from "./prisma";
import { getSetting, setSetting, getJsonSetting } from "./settings";
import type { SaleCategoryKey } from "./domain";

const AUTHORIZE_URL = "https://api.thebase.in/1/oauth/authorize";
const TOKEN_URL = "https://api.thebase.in/1/oauth/token";
const API_BASE = "https://api.thebase.in/1";

export type CategoryRule = { keyword: string; category: SaleCategoryKey };

export type BaseConfig = {
  clientId: string | null;
  clientSecret: string | null;
  connected: boolean;
  defaultAccountId: string | null;
  defaultCategory: SaleCategoryKey;
  rules: CategoryRule[];
  lastSyncAt: string | null;
  lastSyncResult: string | null;
};

export async function getBaseConfig(): Promise<BaseConfig> {
  const [clientId, clientSecret, refreshToken, defaultAccountId, defaultCategory, lastSyncAt, lastSyncResult] =
    await Promise.all([
      getSetting("base_client_id"),
      getSetting("base_client_secret"),
      getSetting("base_refresh_token"),
      getSetting("base_default_account"),
      getSetting("base_default_category"),
      getSetting("base_last_sync_at"),
      getSetting("base_last_sync_result"),
    ]);
  const rules = await getJsonSetting<CategoryRule[]>("base_category_rules", []);
  return {
    clientId,
    clientSecret,
    connected: !!refreshToken,
    defaultAccountId,
    defaultCategory: (defaultCategory as SaleCategoryKey) || "paid_reading",
    rules,
    lastSyncAt,
    lastSyncResult,
  };
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read_orders",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string | null> {
  const clientId = await getSetting("base_client_id");
  const clientSecret = await getSetting("base_client_secret");
  if (!clientId || !clientSecret) return "client_id / client_secret が未設定です";

  const data = await requestToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  if (!data.access_token || !data.refresh_token) {
    return data.error_description || data.error || "トークン取得に失敗しました";
  }
  await setSetting("base_access_token", data.access_token);
  await setSetting("base_refresh_token", data.refresh_token);
  return null;
}

async function refreshAccessToken(redirectUri: string): Promise<string | null> {
  const clientId = await getSetting("base_client_id");
  const clientSecret = await getSetting("base_client_secret");
  const refreshToken = await getSetting("base_refresh_token");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const data = await requestToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
  });
  if (!data.access_token) return null;
  await setSetting("base_access_token", data.access_token);
  if (data.refresh_token) await setSetting("base_refresh_token", data.refresh_token);
  return data.access_token;
}

async function apiGet(path: string, accessToken: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function pickCategory(title: string, rules: CategoryRule[], fallback: SaleCategoryKey): SaleCategoryKey {
  for (const r of rules) {
    if (r.keyword && title.includes(r.keyword)) return r.category;
  }
  return fallback;
}

type BaseOrderListItem = { unique_key: string; ordered_at: number };
type BaseOrderDetail = {
  order?: {
    unique_key: string;
    ordered_at: number;
    order_items?: { order_item_id?: number; item_id?: number; title?: string; price?: number; amount?: number }[];
  };
};

// 注文同期本体。新規注文をSaleとして取り込む（externalIdで重複防止）
export async function syncBaseOrders(redirectUri: string): Promise<{ ok: boolean; message: string }> {
  const config = await getBaseConfig();
  if (!config.connected) return { ok: false, message: "BASEが未接続です" };
  if (!config.defaultAccountId) return { ok: false, message: "同期先アカウントが未設定です" };

  let accessToken = (await getSetting("base_access_token")) || "";

  // まず注文一覧を取得。401ならリフレッシュして1回だけ再試行
  let listRes = await apiGet("/orders?limit=100", accessToken);
  if (listRes.status === 401) {
    const refreshed = await refreshAccessToken(redirectUri);
    if (!refreshed) {
      return { ok: false, message: "トークン更新に失敗しました。BASEと再接続してください" };
    }
    accessToken = refreshed;
    listRes = await apiGet("/orders?limit=100", accessToken);
  }
  if (listRes.status !== 200) {
    return { ok: false, message: `注文一覧の取得に失敗しました（HTTP ${listRes.status}）` };
  }

  const orders = ((listRes.json as { orders?: BaseOrderListItem[] })?.orders ?? []).slice(0, 100);
  let created = 0;
  let skipped = 0;

  for (const o of orders) {
    // 取込済みならスキップ（明細取得APIの節約）
    const exists = await prisma.sale.findFirst({
      where: { ingestedVia: "base_sync", externalId: { startsWith: o.unique_key } },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    const detailRes = await apiGet(`/orders/detail/${o.unique_key}`, accessToken);
    if (detailRes.status !== 200) continue;
    const order = (detailRes.json as BaseOrderDetail)?.order;
    if (!order) continue;

    const occurredOn = new Date((order.ordered_at ?? o.ordered_at) * 1000).toISOString().slice(0, 10);
    const items = order.order_items ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.title ?? "";
      const quantity = Math.max(1, item.amount ?? 1);
      const amount = (item.price ?? 0) * quantity;
      if (amount <= 0) continue;
      try {
        await prisma.sale.create({
          data: {
            accountId: config.defaultAccountId,
            category: pickCategory(title, config.rules, config.defaultCategory),
            productName: title,
            amount,
            quantity,
            occurredOn,
            externalId: `${order.unique_key}:${item.order_item_id ?? i}`,
            ingestedVia: "base_sync",
          },
        });
        created++;
      } catch {
        skipped++; // ユニーク制約（取込済み）
      }
    }
  }

  const message = `同期完了: 新規${created}件 / スキップ${skipped}件（直近${orders.length}注文を確認）`;
  await setSetting("base_last_sync_at", new Date().toISOString());
  await setSetting("base_last_sync_result", message);
  return { ok: true, message };
}
