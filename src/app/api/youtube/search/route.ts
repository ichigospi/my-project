import { NextRequest, NextResponse } from "next/server";
import { mockChannels } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const apiKey = request.headers.get("x-api-key");

  // If API key is provided, use real YouTube API
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "channel");
      url.searchParams.set("maxResults", "10");
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "YouTube API error" }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json({ error: "Failed to fetch from YouTube API" }, { status: 500 });
    }
  }

  // Return mock data when no API key
  const filtered = mockChannels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(query.toLowerCase()) ||
      ch.category.toLowerCase().includes(query.toLowerCase())
  );
  return NextResponse.json({ items: filtered, mock: true });
}
