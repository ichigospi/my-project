import { NextRequest, NextResponse } from "next/server";

// 認証コードをアクセストークンに交換
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code, clientId, clientSecret, redirectUri } = body;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error_description || "トークン取得に失敗" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
  } catch {
    return NextResponse.json({ error: "トークン交換に失敗" }, { status: 500 });
  }
}
