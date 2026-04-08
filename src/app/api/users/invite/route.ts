import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 招待リンク発行
export async function POST(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { email, role } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }

  const validRoles = ["admin", "editor", "viewer"];
  const assignRole = validRoles.includes(role) ? role : "editor";

  // 既に登録済みか
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

  const invite = await prisma.invite.create({
    data: {
      email,
      role: assignRole,
      token,
      expiresAt,
      createdById: (auth.session.user as { id: string }).id,
    },
  });

  return NextResponse.json({
    inviteUrl: `/register?token=${invite.token}`,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  });
}

// 招待一覧
export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const invites = await prisma.invite.findMany({
    where: { usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ invites });
}
