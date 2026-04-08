import { NextRequest, NextResponse } from "next/server";

// OAuthコールバック: 認証コードをトークンに交換
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(new URL(`/settings?auth_error=${error}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?auth_error=no_code", baseUrl));
  }

  // コードをフロントエンドに渡す（トークン交換はフロント側で行う）
  return NextResponse.redirect(new URL(`/settings?auth_code=${code}`, baseUrl));
}
