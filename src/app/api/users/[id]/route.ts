import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// ロール変更
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { role } = await req.json();
  const validRoles = ["admin", "editor", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
  }

  // ownerロールへの変更は不可（ownerは1人のみ）
  // ownerのロール変更も不可
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "オーナーのロールは変更できません" }, { status: 403 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(user);
}

// ユーザー削除
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const currentUserId = (auth.session.user as { id: string }).id;

  // 自分自身は削除不可
  if (id === currentUserId) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "オーナーは削除できません" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
