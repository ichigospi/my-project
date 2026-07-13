import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// ワンタップ送付記録: 「コピーして送付記録」ボタンから呼ばれる
// 鑑定文は free_sent（ダッシュボードの鑑定送付済みにも計上）、配信系は template_sent として記録
export async function POST(req: Request) {
  const auth = await requireAuth("editor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { templateVersionId } = await req.json();
  if (!templateVersionId) {
    return NextResponse.json({ error: "バージョンIDが必要です" }, { status: 400 });
  }

  const version = await prisma.templateVersion.findUnique({
    where: { id: templateVersionId },
    include: { template: true },
  });
  if (!version) {
    return NextResponse.json({ error: "バージョンが見つかりません" }, { status: 404 });
  }

  const today = new Date();
  const occurredOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const event = await prisma.funnelEvent.create({
    data: {
      accountId: version.template.accountId,
      stage: version.template.type === "reading" ? "free_sent" : "template_sent",
      count: 1,
      occurredOn,
      templateVersionId,
      ingestedVia: "manual",
    },
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
