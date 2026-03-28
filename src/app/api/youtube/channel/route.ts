import { NextRequest, NextResponse } from "next/server";
import { mockChannels } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("id") || "";
  const apiKey = request.headers.get("x-api-key");

  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("part", "snippet,statistics,contentDetails");
      url.searchParams.set("id", channelId);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "YouTube API error" }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json({ error: "Failed to fetch channel data" }, { status: 500 });
    }
  }

  // Mock
  const channel = mockChannels.find((ch) => ch.id === channelId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  return NextResponse.json({ item: channel, mock: true });
}
