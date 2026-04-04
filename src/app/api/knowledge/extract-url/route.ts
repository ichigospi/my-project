import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URLが必要です" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeBot/1.0)" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `URLの取得に失敗しました: ${res.status}` }, { status: 400 });
    }

    const html = await res.text();

    // Simple HTML to text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    return NextResponse.json({ title, content: text.slice(0, 50000) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "URL取得エラー";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
