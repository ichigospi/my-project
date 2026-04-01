import { NextRequest, NextResponse } from "next/server";

// チャンネル全体のアナリティクス概要を取得
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get("accessToken");
  if (!accessToken) return NextResponse.json({ error: "accessTokenが必要です" }, { status: 400 });

  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // チャンネル全体の統計
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("metrics", "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "取得失敗" }, { status: res.status });
    }

    const data = await res.json();
    const row = data.rows?.[0];

    // 動画別の統計
    const perVideoUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    perVideoUrl.searchParams.set("ids", "channel==MINE");
    perVideoUrl.searchParams.set("startDate", startDate);
    perVideoUrl.searchParams.set("endDate", endDate);
    perVideoUrl.searchParams.set("metrics", "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments");
    perVideoUrl.searchParams.set("dimensions", "video");
    perVideoUrl.searchParams.set("sort", "-views");
    perVideoUrl.searchParams.set("maxResults", "50");

    const perVideoRes = await fetch(perVideoUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let perVideoStats: {
      videoId: string;
      views: number;
      watchTimeMinutes: number;
      avgDurationSec: number;
      avgPercentage: number;
      subscribersGained: number;
      likes: number;
      comments: number;
    }[] = [];

    if (perVideoRes.ok) {
      const pvData = await perVideoRes.json();
      perVideoStats = (pvData.rows || []).map((r: number[]) => ({
        videoId: r[0],
        views: r[1],
        watchTimeMinutes: r[2],
        avgDurationSec: r[3],
        avgPercentage: Math.round(r[4] * 10) / 10,
        subscribersGained: r[5],
        likes: r[6],
        comments: r[7],
      }));
    }

    return NextResponse.json({
      channelStats: row ? {
        views: row[0],
        watchTimeMinutes: row[1],
        avgDurationSec: row[2],
        avgPercentage: Math.round(row[3] * 10) / 10,
        subscribersGained: row[4],
        subscribersLost: row[5],
        likes: row[6],
        comments: row[7],
        shares: row[8],
      } : null,
      perVideoStats,
      period: { startDate, endDate },
    });
  } catch {
    return NextResponse.json({ error: "チャンネルアナリティクスの取得に失敗" }, { status: 500 });
  }
}
