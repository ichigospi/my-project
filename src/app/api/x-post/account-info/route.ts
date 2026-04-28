// 自アカ情報（ジャンルごとに1レコード）の取得・upsert
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/account-info?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genreは business または spiritual" }, { status: 400 });
    }
    const record = await prisma.xAccountInfo.findUnique({ where: { genre } });
    return NextResponse.json(record);
  } catch (e) {
    console.error("GET /api/x-post/account-info", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/x-post/account-info （genre込みの全フィールドをupsert）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const genre = body.genre;
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genreは business または spiritual" }, { status: 400 });
    }
    // genre / id / timestamps を除いたフィールドだけ抽出
    const data: Record<string, unknown> = { ...body };
    delete data.genre;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    const record = await prisma.xAccountInfo.upsert({
      where: { genre },
      create: { genre, ...data },
      update: data,
    });
    return NextResponse.json(record);
  } catch (e) {
    console.error("PUT /api/x-post/account-info", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
