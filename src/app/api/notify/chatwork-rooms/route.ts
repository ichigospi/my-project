import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { fetchRooms, getToken } from "@/lib/chatwork-server";

// トークンで見えるChatworkルームの一覧（設定画面の「ルームを選ぶ」用）。body.token があれば未保存でもそれで取得
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "") || (await getToken());
    if (!token) return NextResponse.json({ error: "APIトークンを入力してください" }, { status: 400 });
    return NextResponse.json({ rooms: await fetchRooms(token) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
