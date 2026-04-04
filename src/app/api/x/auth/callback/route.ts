import { NextRequest, NextResponse } from "next/server";

// X OAuth2.0 コールバック
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/x-automation?auth_error=${error}`, request.nextUrl.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/x-automation?auth_error=no_code", request.nextUrl.origin)
    );
  }

  // コードをフロントエンドに渡す（トークン交換はフロント側で実行）
  const params = new URLSearchParams({ auth_code: code });
  if (state) params.set("state", state);

  return NextResponse.redirect(
    new URL(`/x-automation?${params.toString()}`, request.nextUrl.origin)
  );
}
