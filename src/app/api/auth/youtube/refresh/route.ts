import { NextRequest, NextResponse } from "next/server";

// リフレッシュトークンでアクセストークンを更新
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { refreshToken, clientId, clientSecret } = body;

  if (!refreshToken || !clientId || !clientSecret) {
    return NextResponse.json({ error: "必要なパラメータが不足" }, { status: 400 });
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error_description || "更新失敗" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in });
  } catch {
    return NextResponse.json({ error: "トークン更新に失敗" }, { status: 500 });
  }
}
