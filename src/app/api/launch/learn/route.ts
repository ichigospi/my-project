import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 実例集に追加
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { type, title, content, note } = body;

  if (!type || !content) {
    return NextResponse.json({ error: "type と content は必須です" }, { status: 400 });
  }

  const example = await prisma.launchExample.create({
    data: {
      type,
      title: title || "",
      content,
      note: note || "",
    },
  });

  return NextResponse.json({ example });
}
