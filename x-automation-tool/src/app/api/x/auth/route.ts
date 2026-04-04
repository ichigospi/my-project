import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, exchangeToken } from "@/lib/x-client";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientIdが必要です" }, { status: 400 });

  const redirectUri = `${request.nextUrl.origin}/api/x/auth/callback`;
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  return NextResponse.json({ authUrl: buildAuthUrl(clientId, redirectUri, state, codeChallenge), redirectUri, codeVerifier, state });
}

export async function POST(request: NextRequest) {
  const { code, clientId, clientSecret, codeVerifier } = await request.json();
  if (!code || !clientId || !clientSecret || !codeVerifier) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }
  const redirectUri = `${request.nextUrl.origin}/api/x/auth/callback`;
  const result = await exchangeToken(code, clientId, clientSecret, redirectUri, codeVerifier);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
