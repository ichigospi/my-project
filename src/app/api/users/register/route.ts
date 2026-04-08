import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// 招待トークンでユーザー登録
export async function POST(req: Request) {
  const { token, name, password } = await req.json();

  if (!token || !name || !password) {
    return NextResponse.json({ error: "全項目を入力してください" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "無効な招待リンクです" }, { status: 400 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: "この招待リンクは既に使用済みです" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "この招待リンクは期限切れです" }, { status: 400 });
  }

  // 既に登録済みか
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const hashedPassword = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email: invite.email,
      hashedPassword,
      role: invite.role,
      invitedById: invite.createdById,
    },
  });

  // 招待を使用済みにする
  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

// 招待トークンの検証
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "トークンが必要です" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, email: invite.email, role: invite.role });
}
