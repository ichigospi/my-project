import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// 初回セットアップ: ユーザーが1人もいなければオーナー登録を許可する
export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req: Request) {
  const count = await prisma.user.count();
  if (count > 0) {
    return NextResponse.json({ error: "セットアップは完了済みです" }, { status: 400 });
  }

  const { email, name, password } = await req.json();
  if (!email || !name || !password || password.length < 8) {
    return NextResponse.json(
      { error: "メール・名前・パスワード（8文字以上）を入力してください" },
      { status: 400 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      hashedPassword: await hash(password, 10),
      role: "owner",
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
