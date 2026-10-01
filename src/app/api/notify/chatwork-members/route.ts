import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// Chatworkルームのメンバー一覧（名前とアカウントID）を取得する。
// 設定ページの「メンバー一覧から選ぶ」用。トークン/ルームIDは未保存でもbodyで渡せる。
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    let token: string = body.token || "";
    let roomId: string = body.roomId || "";
    if (!token || !roomId) {
      const [tokenRow, roomRow] = await Promise.all([
        prisma.appSetting.findUnique({ where: { key: "shared_chatwork_api_token" } }),
        prisma.appSetting.findUnique({ where: { key: "shared_chatwork_room_id" } }),
      ]);
      token = token || tokenRow?.value || "";
      roomId = roomId || roomRow?.value || "";
    }
    if (!token || !roomId) {
      return NextResponse.json({ error: "APIトークンとルームIDを入力してください" }, { status: 400 });
    }

    const res = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/members`, {
      headers: { "X-ChatWorkToken": token },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json({ error: `メンバー取得失敗 (HTTP ${res.status}): ${errText.slice(0, 120)}` }, { status: 502 });
    }
    const members = (await res.json()) as { account_id: number; name: string; role: string }[];
    return NextResponse.json({
      members: members.map((m) => ({ accountId: String(m.account_id), name: m.name, role: m.role })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "メンバー取得に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
