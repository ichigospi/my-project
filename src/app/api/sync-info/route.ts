import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 同期トラブルの切り分け用: 「この画面がどのサーバー・どのDBに繋がっているか」を返す。
// オーナーと管理者がそれぞれの画面で開いて見比べれば、
//   ・DBが別（ローカルの dev.db と本番Turso など）→ dbKind / dbHost が違う
//   ・サーバー上の台本数が違う → push が届いていない
//   ・時計がズレている → serverTime と端末時刻の差
// のどれが原因か、その場で分かる。トークンや秘密情報は返さない。
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const u = auth.session.user as { id?: string; name?: string; role?: string };

    const url = process.env.TURSO_DATABASE_URL || "";
    let dbKind: "turso" | "local-file" = "local-file";
    let dbHost = "prisma/dev.db（このサーバー内のファイル）";
    if (url && !url.startsWith("file:")) {
      dbKind = "turso";
      try { dbHost = new URL(url.replace(/^libsql:/, "https:")).hostname; } catch { dbHost = "(URL解析不可)"; }
    } else if (url) {
      dbHost = url;
    }

    let projectCount = 0;
    let latestProjectUpdatedAt = "";
    try {
      const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "shared_project_" } } });
      projectCount = rows.length;
      for (const r of rows) {
        try {
          const ts = (JSON.parse(r.value) as { updatedAt?: string })?.updatedAt || "";
          if (ts > latestProjectUpdatedAt) latestProjectUpdatedAt = ts;
        } catch { /* skip */ }
      }
    } catch (e) {
      return NextResponse.json({ error: `DB読み取り失敗: ${String(e).slice(0, 200)}`, dbKind, dbHost, serverTime: new Date().toISOString() }, { status: 500 });
    }

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      dbKind,
      dbHost,
      user: { id: u.id || "", name: u.name || "", role: u.role || "" },
      projectCount,
      latestProjectUpdatedAt,
      deploy: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
