import { NextRequest, NextResponse } from "next/server";

// 動画の詳細アナリティクス（CTR、トラフィックソース、登録者獲得等）
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const accessToken = request.nextUrl.searchParams.get("accessToken");

  if (!videoId || !accessToken) {
    return NextResponse.json({ error: "videoIdとaccessTokenが必要です" }, { status: 400 });
  }

  try {
    // 基本統計 + CTR
    const statsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    statsUrl.searchParams.set("ids", "channel==MINE");
    statsUrl.searchParams.set("startDate", "2020-01-01");
    statsUrl.searchParams.set("endDate", new Date().toISOString().split("T")[0]);
    statsUrl.searchParams.set("metrics", "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares");
    statsUrl.searchParams.set("filters", `video==${videoId}`);

    const statsRes = await fetch(statsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let stats = null;
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      const row = statsData.rows?.[0];
      if (row) {
        stats = {
          views: row[0],
          watchTimeMinutes: row[1],
          avgViewDurationSec: row[2],
          avgViewPercentage: Math.round(row[3] * 10) / 10,
          subscribersGained: row[4],
          subscribersLost: row[5],
          likes: row[6],
          comments: row[7],
          shares: row[8],
        };
      }
    }

    // トラフィックソース
    const trafficUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    trafficUrl.searchParams.set("ids", "channel==MINE");
    trafficUrl.searchParams.set("startDate", "2020-01-01");
    trafficUrl.searchParams.set("endDate", new Date().toISOString().split("T")[0]);
    trafficUrl.searchParams.set("metrics", "views");
    trafficUrl.searchParams.set("dimensions", "insightTrafficSourceType");
    trafficUrl.searchParams.set("filters", `video==${videoId}`);
    trafficUrl.searchParams.set("sort", "-views");

    let trafficSources: { source: string; views: number }[] = [];
    try {
      const trafficRes = await fetch(trafficUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (trafficRes.ok) {
        const trafficData = await trafficRes.json();
        trafficSources = (trafficData.rows || []).map((row: [string, number]) => ({
          source: row[0], views: row[1],
        }));
      }
    } catch { /* skip */ }

    return NextResponse.json({ stats, trafficSources });
  } catch {
    return NextResponse.json({ error: "アナリティクスの取得に失敗" }, { status: 500 });
  }
}
