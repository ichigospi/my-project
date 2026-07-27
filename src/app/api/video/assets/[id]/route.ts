import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { assetPath, CONTENT_TYPES } from "@/lib/video-assets";

type Params = Promise<{ id: string }>;

// tmpdir の素材ストアからファイルを配信する(動画プレビュー用にRange対応)
export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const filePath = assetPath(id);
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "素材が見つかりません(再デプロイで消えた場合は再生成してください)" }, { status: 404 });
  }

  const ext = id.split(".").pop() || "";
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const size = statSync(filePath).size;

  const range = request.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
