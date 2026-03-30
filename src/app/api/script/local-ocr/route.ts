import { NextRequest, NextResponse } from "next/server";
import Tesseract from "tesseract.js";

// Tesseract.jsでローカルOCR（無料・高速）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { image } = body; // base64 1枚

  if (!image) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }

  try {
    // base64をBufferに変換
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const result = await Tesseract.recognize(buffer, "jpn", {
      logger: () => {},
    });

    const text = result.data.text.trim();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: "" }); // 失敗しても空テキストを返す
  }
}
