// フォルダへのアイテム追加・削除（多対多）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/x-post/folder-items?folderId=xxx → そのフォルダのアイテム一覧
// GET /api/x-post/folder-items?itemId=xxx → そのアイテムが所属するフォルダ一覧
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const itemId = searchParams.get("itemId");
    const where: Record<string, string> = {};
    if (folderId) where.folderId = folderId;
    if (itemId) where.itemId = itemId;
    const items = await prisma.xFolderItem.findMany({ where });
    return NextResponse.json(items);
  } catch (e) {
    console.error("GET /api/x-post/folder-items", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/x-post/folder-items { folderId, itemType, itemId }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.folderId || !body.itemType || !body.itemId) {
      return NextResponse.json({ error: "folderId, itemType, itemId は必須" }, { status: 400 });
    }
    // 重複は無視（既に登録済みなら何もしない）
    const item = await prisma.xFolderItem.upsert({
      where: {
        folderId_itemType_itemId: {
          folderId: body.folderId,
          itemType: body.itemType,
          itemId: body.itemId,
        },
      },
      create: { folderId: body.folderId, itemType: body.itemType, itemId: body.itemId },
      update: {},
    });
    return NextResponse.json(item);
  } catch (e) {
    console.error("POST /api/x-post/folder-items", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/x-post/folder-items { folderId, itemType, itemId }
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.folderId || !body.itemType || !body.itemId) {
      return NextResponse.json({ error: "folderId, itemType, itemId は必須" }, { status: 400 });
    }
    await prisma.xFolderItem.deleteMany({
      where: {
        folderId: body.folderId,
        itemType: body.itemType,
        itemId: body.itemId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/x-post/folder-items", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
