import { NextRequest, NextResponse } from "next/server";

// チャンネルの動画一覧を取得（最新＋人気順）
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const apiKey = request.nextUrl.searchParams.get("apiKey");
  const maxResults = request.nextUrl.searchParams.get("maxResults") || "20";

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube APIキーが設定されていません" }, { status: 400 });
  }

  if (!channelId) {
    return NextResponse.json({ error: "channelId が必要です" }, { status: 400 });
  }

  try {
    // まずチャンネルからuploads playlistを取得
    const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    chUrl.searchParams.set("part", "contentDetails");
    chUrl.searchParams.set("id", channelId);
    chUrl.searchParams.set("key", apiKey);

    const chRes = await fetch(chUrl.toString());
    if (!chRes.ok) {
      const err = await chRes.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: chRes.status });
    }
    const chData = await chRes.json();
    const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: "アップロードプレイリストが見つかりません" }, { status: 404 });
    }

    // プレイリストから動画一覧を取得
    const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    plUrl.searchParams.set("part", "snippet");
    plUrl.searchParams.set("playlistId", uploadsPlaylistId);
    plUrl.searchParams.set("maxResults", maxResults);
    plUrl.searchParams.set("key", apiKey);

    const plRes = await fetch(plUrl.toString());
    if (!plRes.ok) {
      const err = await plRes.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: plRes.status });
    }
    const plData = await plRes.json();

    // 動画IDを取得して統計情報を一括取得
    const videoIds = plData.items
      ?.map((item: { snippet?: { resourceId?: { videoId?: string } } }) => item.snippet?.resourceId?.videoId)
      .filter(Boolean)
      .join(",");

    if (!videoIds) {
      return NextResponse.json({ videos: [] });
    }

    const vidUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    vidUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    vidUrl.searchParams.set("id", videoIds);
    vidUrl.searchParams.set("key", apiKey);

    const vidRes = await fetch(vidUrl.toString());
    if (!vidRes.ok) {
      const err = await vidRes.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: vidRes.status });
    }
    const vidData = await vidRes.json();

    const videos = vidData.items?.map((v: {
      id: string;
      snippet?: { title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } }; tags?: string[] };
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails?: { duration?: string };
    }) => {
      const views = parseInt(v.statistics?.viewCount || "0", 10);
      const likes = parseInt(v.statistics?.likeCount || "0", 10);
      const comments = parseInt(v.statistics?.commentCount || "0", 10);
      const engagementRate = views > 0 ? (((likes + comments) / views) * 100) : 0;

      return {
        id: v.id,
        title: v.snippet?.title || "",
        views,
        likes,
        comments,
        publishedAt: v.snippet?.publishedAt?.split("T")[0] || "",
        duration: parseDuration(v.contentDetails?.duration || ""),
        thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
        tags: v.snippet?.tags?.slice(0, 10) || [],
        engagementRate: Math.round(engagementRate * 100) / 100,
      };
    }) || [];

    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json({ error: "動画情報の取得に失敗しました" }, { status: 500 });
  }
}

function parseDuration(iso8601: string): string {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
