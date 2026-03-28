import { NextRequest, NextResponse } from "next/server";
import { mockChannels } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId") || "";
  const apiKey = request.headers.get("x-api-key");

  if (apiKey) {
    try {
      // First get the uploads playlist
      const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelUrl.searchParams.set("part", "contentDetails");
      channelUrl.searchParams.set("id", channelId);
      channelUrl.searchParams.set("key", apiKey);

      const channelRes = await fetch(channelUrl.toString());
      if (!channelRes.ok) {
        const error = await channelRes.json();
        return NextResponse.json({ error: error.error?.message || "YouTube API error" }, { status: channelRes.status });
      }
      const channelData = await channelRes.json();
      const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        return NextResponse.json({ error: "Could not find uploads playlist" }, { status: 404 });
      }

      // Get videos from uploads playlist
      const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      playlistUrl.searchParams.set("part", "snippet");
      playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
      playlistUrl.searchParams.set("maxResults", "20");
      playlistUrl.searchParams.set("key", apiKey);

      const playlistRes = await fetch(playlistUrl.toString());
      if (!playlistRes.ok) {
        const error = await playlistRes.json();
        return NextResponse.json({ error: error.error?.message || "YouTube API error" }, { status: playlistRes.status });
      }
      const playlistData = await playlistRes.json();
      return NextResponse.json(playlistData);
    } catch (error) {
      return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
    }
  }

  // Mock
  const channel = mockChannels.find((ch) => ch.id === channelId);
  return NextResponse.json({ items: channel?.topVideos || [], mock: true });
}
