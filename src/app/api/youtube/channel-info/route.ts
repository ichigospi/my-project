import { NextRequest, NextResponse } from "next/server";

// YouTube API でチャンネル情報を取得
// handle (@xxx) または channelId (UCxxx) に対応
export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");
  const channelId = request.nextUrl.searchParams.get("channelId");
  const apiKey = request.nextUrl.searchParams.get("apiKey");

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube APIキーが設定されていません" }, { status: 400 });
  }

  try {
    let resolvedChannelId = channelId;

    // handle → channelId に変換
    if (handle && !channelId) {
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      searchUrl.searchParams.set("part", "id");
      searchUrl.searchParams.set("forHandle", handle);
      searchUrl.searchParams.set("key", apiKey);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const err = await searchRes.json();
        return NextResponse.json({ error: err.error?.message || "API error" }, { status: searchRes.status });
      }
      const searchData = await searchRes.json();
      resolvedChannelId = searchData.items?.[0]?.id;

      if (!resolvedChannelId) {
        return NextResponse.json({ error: `チャンネル @${handle} が見つかりません` }, { status: 404 });
      }
    }

    if (!resolvedChannelId) {
      return NextResponse.json({ error: "channelId または handle が必要です" }, { status: 400 });
    }

    // チャンネル詳細を取得
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet,statistics,contentDetails,brandingSettings");
    url.searchParams.set("id", resolvedChannelId);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: res.status });
    }

    const data = await res.json();
    const ch = data.items?.[0];
    if (!ch) {
      return NextResponse.json({ error: "チャンネルが見つかりません" }, { status: 404 });
    }

    return NextResponse.json({
      channelId: ch.id,
      name: ch.snippet?.title || "",
      description: ch.snippet?.description || "",
      thumbnailUrl: ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || "",
      subscribers: parseInt(ch.statistics?.subscriberCount || "0", 10),
      totalViews: parseInt(ch.statistics?.viewCount || "0", 10),
      videoCount: parseInt(ch.statistics?.videoCount || "0", 10),
      uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || "",
      customUrl: ch.snippet?.customUrl || "",
    });
  } catch (error) {
    return NextResponse.json({ error: "チャンネル情報の取得に失敗しました" }, { status: 500 });
  }
}
