// Threads自アカウントの更新・削除
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/threads/accounts/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const key of ["name", "concept", "logic", "target", "tone"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (typeof body.handle === "string") data.handle = body.handle.replace(/^@/, "");
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const account = await prisma.threadsAccount.update({ where: { id }, data });
    return NextResponse.json(account);
  } catch (e: unknown) {
    console.error("PATCH /api/threads/accounts/[id]", e);
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "同じハンドルのアカウントが既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/threads/accounts/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.threadsAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/threads/accounts/[id]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
