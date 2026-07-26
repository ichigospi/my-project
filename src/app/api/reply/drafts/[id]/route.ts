// 生成ドラフトの更新（ステータス遷移・最終文の保存・実例への追加）・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

const VALID_STATUSES = ["draft", "pending_approval", "approved", "sent", "escalated"];
// 承認はadmin以上のみ
const ADMIN_ONLY_STATUSES = ["approved"];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.finalReply !== undefined) data.finalReply = body.finalReply;
    if (body.customerName !== undefined) data.customerName = body.customerName;

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
      }
      if (ADMIN_ONLY_STATUSES.includes(body.status)) {
        const role = (auth.session?.user as { role?: string } | undefined)?.role;
        if (role !== "admin" && role !== "owner") {
          return NextResponse.json({ error: "承認はオーナー/管理者のみ可能です" }, { status: 403 });
        }
      }
      data.status = body.status;
    }

    const draft = await prisma.replyDraft.update({ where: { id }, data });

    // 「実例として保存」: 最終文をReplyExampleに自動追加（学習ループ）
    if (body.saveAsExample && draft.finalReply.trim()) {
      await prisma.replyExample.create({
        data: {
          category: draft.category,
          stage: draft.stage,
          customerMessage: draft.customerMessage,
          replyMessage: draft.finalReply,
          note: "承認済みドラフトから自動追加",
          source: "learned",
        },
      });
    }

    return NextResponse.json(draft);
  } catch (e) {
    console.error("PUT /api/reply/drafts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    await prisma.replyDraft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/reply/drafts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
