import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/?auth_error=${error}`, request.nextUrl.origin));
  if (!code) return NextResponse.redirect(new URL("/?auth_error=no_code", request.nextUrl.origin));

  const params = new URLSearchParams({ auth_code: code });
  if (state) params.set("state", state);
  return NextResponse.redirect(new URL(`/?${params.toString()}`, request.nextUrl.origin));
}
