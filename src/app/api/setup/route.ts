import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// 初回セットアップ: オーナーアカウント作成
export async function POST(req: Request) {
  // 既にユーザーが存在する場合は拒否
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ error: "セットアップは既に完了しています" }, { status: 400 });
  }

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "全項目を入力してください" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
  }

  const hashedPassword = await hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, hashedPassword, role: "owner" },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

// セットアップが必要か確認
export async function GET() {
  const userCount = await prisma.user.count();
  return NextResponse.json({ needsSetup: userCount === 0 });
}
