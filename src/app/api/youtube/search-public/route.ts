import { NextRequest, NextResponse } from "next/server";

// YouTube公開検索APIで動画を検索（競合チャンネル発見用）
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const apiKey = request.nextUrl.searchParams.get("apiKey") || "";
  const maxResults = request.nextUrl.searchParams.get("maxResults") || "20";

  if (!apiKey) return NextResponse.json({ error: "YouTube APIキーが必要です" }, { status: 400 });
  if (!query) return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });

  try {
    // 検索
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", "viewCount");
    searchUrl.searchParams.set("maxResults", maxResults);
    searchUrl.searchParams.set("publishedAfter", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const err = await searchRes.json();
      return NextResponse.json({ error: err.error?.message || "検索失敗" }, { status: searchRes.status });
    }
    const searchData = await searchRes.json();

    const videoIds = searchData.items
      ?.map((item: { id?: { videoId?: string } }) => item.id?.videoId)
      .filter(Boolean)
      .join(",");

    if (!videoIds) return NextResponse.json({ videos: [] });

    // 動画統計を取得
    const vidUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    vidUrl.searchParams.set("part", "snippet,statistics");
    vidUrl.searchParams.set("id", videoIds);
    vidUrl.searchParams.set("key", apiKey);

    const vidRes = await fetch(vidUrl.toString());
    if (!vidRes.ok) return NextResponse.json({ videos: [] });
    const vidData = await vidRes.json();

    const videos = (vidData.items || []).map((v: {
      id: string;
      snippet?: { title?: string; channelTitle?: string; channelId?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } };
      statistics?: { viewCount?: string };
    }) => ({
      id: v.id,
      title: v.snippet?.title || "",
      channelName: v.snippet?.channelTitle || "",
      channelId: v.snippet?.channelId || "",
      views: parseInt(v.statistics?.viewCount || "0", 10),
      publishedAt: v.snippet?.publishedAt?.split("T")[0] || "",
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url || "",
    }));

    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
