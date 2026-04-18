import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup", "/register", "/api/auth", "/api/setup", "/api/users/register", "/api/health", "/sales", "/api/sales", "/notif"];

const PRODUCTION_HOST = "my-project-production-d888.up.railway.app";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = req.nextUrl.hostname;

  // 本番（Railway）以外は認証をスキップ（localhost、ngrok等）
  if (hostname !== PRODUCTION_HOST) {
    return NextResponse.next();
  }

  // 公開パスはスキップ
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 静的ファイルはスキップ
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "fortune-yt-tool-secret-change-me" });

  if (!token) {
    // APIリクエストには401を返す
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    // ページリクエストはログインにリダイレクト
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // viewerロールの書き込みAPI制限
  if (token.role === "viewer" && pathname.startsWith("/api/") && req.method !== "GET") {
    // 認証関連のAPIは許可
    if (pathname.startsWith("/api/auth")) return NextResponse.next();
    return NextResponse.json({ error: "閲覧者は変更操作ができません" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
