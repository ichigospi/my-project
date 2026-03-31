import { NextRequest, NextResponse } from "next/server";

// OAuthコールバック: 認証コードをトークンに交換
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?auth_error=${error}`, request.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?auth_error=no_code", request.nextUrl.origin));
  }

  // コードをフロントエンドに渡す（トークン交換はフロント側で行う）
  return NextResponse.redirect(new URL(`/settings?auth_code=${code}`, request.nextUrl.origin));
}
