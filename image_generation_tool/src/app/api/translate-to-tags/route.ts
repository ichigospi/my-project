// 日本語テキストを Danbooru 英語タグに変換する API。
// キャプション編集モーダル・一括編集モーダルから呼び出される。

import { NextResponse } from "next/server";
import { translateToTags } from "@/lib/claude-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  text?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await translateToTags(text);
    return NextResponse.json({ tags: result.tags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
