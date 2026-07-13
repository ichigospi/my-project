import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getSetting } from "@/lib/settings";
import { buildAuthorizeUrl } from "@/lib/base";

// BASE接続開始: 認可画面へリダイレクト
export async function GET(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = await getSetting("base_client_id");
  if (!clientId) {
    return NextResponse.json({ error: "先に client_id を保存してください" }, { status: 400 });
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/base/callback`;
  return NextResponse.redirect(buildAuthorizeUrl(clientId, redirectUri));
}
