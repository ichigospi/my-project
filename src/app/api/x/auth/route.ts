import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/x-client";
import crypto from "crypto";

// OAuth 2.0 PKCE 認証URL生成
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientIdが必要です" }, { status: 400 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/x/auth/callback`;

  // PKCE: code_verifier と code_challenge を生成
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = buildAuthUrl(clientId, redirectUri, state, codeChallenge);

  return NextResponse.json({
    authUrl,
    redirectUri,
    codeVerifier,
    state,
  });
}

// トークン交換
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code, clientId, clientSecret, codeVerifier } = body;

  if (!code || !clientId || !clientSecret || !codeVerifier) {
    return NextResponse.json(
      { error: "code, clientId, clientSecret, codeVerifier が必要です" },
      { status: 400 }
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/x/auth/callback`;

  const { exchangeToken } = await import("@/lib/x-client");
  const result = await exchangeToken(code, clientId, clientSecret, redirectUri, codeVerifier);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
