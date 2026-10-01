import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// Chatworkへの通知送信。トークン・ルームIDは共有設定（設定ページで保存）から読む。
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { message, task } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message が必要です" }, { status: 400 });
    }

    const [tokenRow, roomRow, ownerRow, writerRow] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: "shared_chatwork_api_token" } }),
      prisma.appSetting.findUnique({ where: { key: "shared_chatwork_room_id" } }),
      prisma.appSetting.findUnique({ where: { key: "shared_chatwork_owner_id" } }),
      prisma.appSetting.findUnique({ where: { key: "shared_chatwork_writer_ids" } }),
    ]);
    const token = tokenRow?.value || "";
    const roomId = roomRow?.value || "";
    if (!token || !roomId) {
      // 未設定は正常系として扱う（通知はオプション機能。台本提出等の本処理を止めない）
      return NextResponse.json({ ok: false, skipped: true, reason: "Chatwork未設定（設定ページでAPIトークンとルームIDを保存してください）" });
    }

    const res = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `body=${encodeURIComponent(message)}`,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[notify/chatwork] failed:", res.status, errText.slice(0, 200));
      return NextResponse.json({ ok: false, error: `Chatwork送信失敗 (HTTP ${res.status}): ${errText.slice(0, 120)}` }, { status: 502 });
    }

    // タスク追加（期限=送信日の翌日 23:59 JST。担当者が未設定ならスキップ）
    let taskCreated = false;
    if (task?.body && (task.assign === "owner" || task.assign === "writers")) {
      const idsRaw = task.assign === "owner" ? (ownerRow?.value || "") : (writerRow?.value || "");
      const ids = idsRaw.split(/[,、\s]+/).map((s: string) => s.trim()).filter((s: string) => /^\d+$/.test(s));
      if (ids.length > 0) {
        // JSTでの「明日」の23:59をUNIX秒に変換
        const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
        const limitUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1, 23, 59, 0) - 9 * 3600 * 1000;
        const params = new URLSearchParams({
          body: task.body,
          to_ids: ids.join(","),
          limit: String(Math.floor(limitUtcMs / 1000)),
          limit_type: "date",
        });
        const tres = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/tasks`, {
          method: "POST",
          headers: { "X-ChatWorkToken": token, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        taskCreated = tres.ok;
        if (!tres.ok) {
          const errText = await tres.text().catch(() => "");
          console.error("[notify/chatwork] task failed:", tres.status, errText.slice(0, 200));
        }
      }
    }

    return NextResponse.json({ ok: true, taskCreated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chatwork通知に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
