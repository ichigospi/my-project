import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/base";

// BASE認可後のコールバック: コードをトークンに交換して設定画面へ戻す
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${url.origin}/settings?base=error`);
  }

  const redirectUri = `${url.origin}/api/base/callback`;
  const error = await exchangeCode(code, redirectUri);
  return NextResponse.redirect(`${url.origin}/settings?base=${error ? "error" : "connected"}`);
}
