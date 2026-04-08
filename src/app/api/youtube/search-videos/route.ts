import { NextRequest, NextResponse } from "next/server";

// 全登録チャンネルの動画を一括取得して検索・フィルタリング
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    channels, // { channelId, name, handle }[]
    apiKey,
    maxResultsPerChannel = 50,
  } = body;

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube APIキーが設定されていません" }, { status: 400 });
  }

  if (!channels || channels.length === 0) {
    return NextResponse.json({ error: "チャンネルが登録されていません" }, { status: 400 });
  }

  const allVideos: {
    id: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    publishedAt: string;
    duration: string;
    thumbnailUrl: string;
    tags: string[];
    engagementRate: number;
    channelId: string;
    channelName: string;
  }[] = [];

  const channelStats: Record<string, { totalViews: number; videoCount: number; avgViews: number }> = {};

  for (const ch of channels) {
    if (!ch.channelId) continue;

    try {
      // アップロードプレイリスト取得
      const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      chUrl.searchParams.set("part", "contentDetails");
      chUrl.searchParams.set("id", ch.channelId);
      chUrl.searchParams.set("key", apiKey);

      const chRes = await fetch(chUrl.toString());
      if (!chRes.ok) continue;
      const chData = await chRes.json();
      const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) continue;

      // プレイリストから動画一覧
      const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      plUrl.searchParams.set("part", "snippet");
      plUrl.searchParams.set("playlistId", uploadsPlaylistId);
      plUrl.searchParams.set("maxResults", String(Math.min(maxResultsPerChannel, 50)));
      plUrl.searchParams.set("key", apiKey);

      const plRes = await fetch(plUrl.toString());
      if (!plRes.ok) continue;
      const plData = await plRes.json();

      const videoIds = plData.items
        ?.map((item: { snippet?: { resourceId?: { videoId?: string } } }) =>
          item.snippet?.resourceId?.videoId
        )
        .filter(Boolean);

      if (!videoIds || videoIds.length === 0) continue;

      // 動画統計を一括取得（50個ずつ）
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50).join(",");
        const vidUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        vidUrl.searchParams.set("part", "snippet,statistics,contentDetails");
        vidUrl.searchParams.set("id", batch);
        vidUrl.searchParams.set("key", apiKey);

        const vidRes = await fetch(vidUrl.toString());
        if (!vidRes.ok) continue;
        const vidData = await vidRes.json();

        for (const v of vidData.items || []) {
          const views = parseInt(v.statistics?.viewCount || "0", 10);
          const likes = parseInt(v.statistics?.likeCount || "0", 10);
          const comments = parseInt(v.statistics?.commentCount || "0", 10);
          const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

          allVideos.push({
            id: v.id,
            title: v.snippet?.title || "",
            views,
            likes,
            comments,
            publishedAt: v.snippet?.publishedAt?.split("T")[0] || "",
            duration: parseDuration(v.contentDetails?.duration || ""),
            thumbnailUrl:
              v.snippet?.thumbnails?.medium?.url ||
              v.snippet?.thumbnails?.default?.url ||
              "",
            tags: v.snippet?.tags?.slice(0, 10) || [],
            engagementRate: Math.round(engagementRate * 100) / 100,
            channelId: ch.channelId,
            channelName: ch.name || ch.handle || ch.channelId,
          });
        }
      }

      // チャンネルの平均再生数を計算
      const chVideos = allVideos.filter((v) => v.channelId === ch.channelId);
      const totalViews = chVideos.reduce((sum, v) => sum + v.views, 0);
      channelStats[ch.channelId] = {
        totalViews,
        videoCount: chVideos.length,
        avgViews: chVideos.length > 0 ? Math.round(totalViews / chVideos.length) : 0,
      };
    } catch {
      // チャンネルの取得失敗はスキップ
    }
  }

  return NextResponse.json({
    videos: allVideos,
    channelStats,
    totalVideos: allVideos.length,
  });
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
