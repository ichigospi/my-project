import { NextRequest, NextResponse } from "next/server";
import { listLibrary, removeFromLibrary } from "@/lib/video-assets";

// 素材ライブラリ(生成済みAI素材の使い回し)
export async function GET() {
  try {
    const entries = await listLibrary();
    return NextResponse.json({ entries, persistent: !!process.env.VIDEO_ASSET_DIR });
  } catch (e) {
    console.error("GET /api/video/library", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    await removeFromLibrary(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/video/library", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
