// Xポストツールの設定（ジャンル別1レコード）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/settings?genre=business
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    const record = await prisma.xSettings.findUnique({ where: { genre } });
    return NextResponse.json(record);
  } catch (e) {
    console.error("GET /api/x-post/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/x-post/settings (genre込みのupsert)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const genre = body.genre;
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    const fields = ["postsPerDay", "educationConfig", "sequenceConfig", "spiceEnabled", "defaultModel", "xApiBearerToken"];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    const record = await prisma.xSettings.upsert({
      where: { genre },
      create: { genre, ...data },
      update: data,
    });
    return NextResponse.json(record);
  } catch (e) {
    console.error("PUT /api/x-post/settings", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
