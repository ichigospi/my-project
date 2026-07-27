import { NextRequest, NextResponse } from "next/server";
import { saveAsset, assetUrl, ALLOWED_EXTS } from "@/lib/video-assets";

export const maxDuration = 300;

const MAX_SIZE = 300 * 1024 * 1024; // 300MB

// 手持ち素材(映像・画像・BGM)のアップロード
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file が必要です" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "ファイルが大きすぎます(300MBまで)" }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { error: `対応していない形式です(${ALLOWED_EXTS.join(", ")})` },
        { status: 400 },
      );
    }
    const id = await saveAsset(Buffer.from(await file.arrayBuffer()), ext);
    return NextResponse.json({ url: assetUrl(id), name: file.name });
  } catch (e) {
    console.error("POST /api/video/upload", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
