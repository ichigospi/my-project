import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getOrCreateIngestSecret, setSetting } from "@/lib/settings";
import { getBaseConfig, type CategoryRule } from "@/lib/base";
import { SALE_CATEGORIES } from "@/lib/domain";

// 連携設定の取得（設定画面用）
export async function GET(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const secret = await getOrCreateIngestSecret();
  const base = await getBaseConfig();

  return NextResponse.json({
    ingest: {
      secret,
      webhookUrl: `${url.origin}/api/ingest/utage?key=${secret}`,
    },
    base: {
      clientId: base.clientId,
      hasClientSecret: !!base.clientSecret,
      connected: base.connected,
      defaultAccountId: base.defaultAccountId,
      defaultCategory: base.defaultCategory,
      rules: base.rules,
      lastSyncAt: base.lastSyncAt,
      lastSyncResult: base.lastSyncResult,
      redirectUri: `${url.origin}/api/base/callback`,
    },
  });
}

// BASE設定の保存
export async function POST(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { clientId, clientSecret, defaultAccountId, defaultCategory, rules } = await req.json();

  if (clientId !== undefined) await setSetting("base_client_id", String(clientId).trim());
  if (clientSecret) await setSetting("base_client_secret", String(clientSecret).trim());
  if (defaultAccountId !== undefined) await setSetting("base_default_account", String(defaultAccountId));
  if (defaultCategory !== undefined) {
    if (!SALE_CATEGORIES.some((c) => c.key === defaultCategory)) {
      return NextResponse.json({ error: "カテゴリが不正です" }, { status: 400 });
    }
    await setSetting("base_default_category", defaultCategory);
  }
  if (Array.isArray(rules)) {
    const cleaned: CategoryRule[] = rules
      .filter((r: CategoryRule) => r.keyword?.trim() && SALE_CATEGORIES.some((c) => c.key === r.category))
      .map((r: CategoryRule) => ({ keyword: r.keyword.trim(), category: r.category }));
    await setSetting("base_category_rules", JSON.stringify(cleaned));
  }

  return NextResponse.json({ ok: true });
}
