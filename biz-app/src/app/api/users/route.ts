import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const auth = await requireAuth("admin");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { email, name, password, role } = await req.json();
  if (!email || !name || !password || password.length < 8) {
    return NextResponse.json(
      { error: "メール・名前・パスワード（8文字以上）を入力してください" },
      { status: 400 }
    );
  }
  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "このメールアドレスは登録済みです" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: { email, name, hashedPassword: await hash(password, 10), role },
  });
  return NextResponse.json({ ok: true, userId: user.id });
}
