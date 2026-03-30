import { NextRequest, NextResponse } from "next/server";

// YouTube動画の字幕を取得（YouTube APIのcaptions経由）
// 注: YouTube Data APIでは直接字幕テキストを取得するにはOAuth認証が必要
// ここではvideo情報の取得のみ行い、字幕は手動入力を推奨
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const apiKey = request.nextUrl.searchParams.get("apiKey");

  if (!videoId || !apiKey) {
    return NextResponse.json({ error: "videoId と apiKey が必要です" }, { status: 400 });
  }

  try {
    // 動画情報を取得
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics,contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: res.status });
    }

    const data = await res.json();
    const video = data.items?.[0];

    if (!video) {
      return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({
      videoId: video.id,
      title: video.snippet?.title || "",
      channelTitle: video.snippet?.channelTitle || "",
      description: video.snippet?.description || "",
      views: parseInt(video.statistics?.viewCount || "0", 10),
      likes: parseInt(video.statistics?.likeCount || "0", 10),
      comments: parseInt(video.statistics?.commentCount || "0", 10),
      duration: video.contentDetails?.duration || "",
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url || "",
      publishedAt: video.snippet?.publishedAt?.split("T")[0] || "",
      tags: video.snippet?.tags || [],
    });
  } catch {
    return NextResponse.json({ error: "動画情報の取得に失敗しました" }, { status: 500 });
  }
}
