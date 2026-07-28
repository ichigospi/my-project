import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const maxDuration = 300;

// LitMedia (LitVideo) のOAuthデバイス認証フロー(公式skillのauth.pyと同じ手順)
// init: 認証URL発行 → ユーザーがブラウザで承認 → poll: APIキー取得
const OAUTH_BASE_URL = "https://litvideo-api.litmedia.ai";
const HEADERS = { "Content-Type": "application/json", "Monimaster-Device-Type": "110" };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    if (action === "init") {
      const clientId = `litmedia-skill-${randomBytes(8).toString("hex")}`;
      const res = await fetch(`${OAUTH_BASE_URL}/oauth/api/device/init`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ client_id: clientId }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: `LitMedia認証の開始に失敗 (${res.status})` }, { status: 502 });
      }
      const json = await res.json();
      const data = json?.data ?? json;
      const deviceCode = data?.device_code;
      const verificationUrl = data?.verification_uri_complete || data?.verification_uri || "";
      const tokenEndpoint = data?.token_endpoint || `${OAUTH_BASE_URL}/oauth/api/device/token`;
      if (!deviceCode || !verificationUrl) {
        return NextResponse.json(
          { error: `LitMedia認証の応答が不正です: ${JSON.stringify(json).slice(0, 300)}` },
          { status: 502 },
        );
      }
      return NextResponse.json({
        deviceCode,
        verificationUrl,
        tokenEndpoint,
        interval: Number(data?.interval) || 2,
      });
    }

    if (action === "poll") {
      const { deviceCode, tokenEndpoint } = body;
      if (!deviceCode) return NextResponse.json({ error: "deviceCode が必要です" }, { status: 400 });
      // SSRF防止: ポーリング先はLitMediaのAPIドメインに限定する
      const endpoint = String(tokenEndpoint || `${OAUTH_BASE_URL}/oauth/api/device/token`);
      if (!endpoint.startsWith(`${OAUTH_BASE_URL}/`)) {
        return NextResponse.json({ error: "不正なtokenEndpointです" }, { status: 400 });
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ token: deviceCode }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: `LitMedia認証の確認に失敗 (${res.status})` }, { status: 502 });
      }
      const json = await res.json();
      const data = json?.data ?? json;
      const status = String(data?.status ?? json?.status ?? "");
      if (status === "APPROVED") {
        const apiKeys = data?.api_keys;
        const apiKey = Array.isArray(apiKeys) && apiKeys.length > 0 ? apiKeys[0] : "";
        if (!apiKey) {
          return NextResponse.json(
            { error: "承認されましたがAPIキーが取得できませんでした。LitMedia側のプランをご確認ください" },
            { status: 502 },
          );
        }
        return NextResponse.json({ status: "approved", apiKey, uid: data?.uid || "" });
      }
      if (status === "DENIED" || status === "EXPIRED") {
        return NextResponse.json({ status: "error", error: `認証が${status === "DENIED" ? "拒否" : "期限切れに"}なりました` });
      }
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json({ error: `不明なaction: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("POST /api/video/litmedia-auth", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
