import { NextRequest, NextResponse } from "next/server";

// 動画のリテンション（視聴者維持率）データを取得
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const accessToken = request.nextUrl.searchParams.get("accessToken");

  if (!videoId || !accessToken) {
    return NextResponse.json({ error: "videoIdとaccessTokenが必要です" }, { status: 400 });
  }

  try {
    // 視聴者維持率データ
    const retentionUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    retentionUrl.searchParams.set("ids", "channel==MINE");
    retentionUrl.searchParams.set("startDate", "2020-01-01");
    retentionUrl.searchParams.set("endDate", new Date().toISOString().split("T")[0]);
    retentionUrl.searchParams.set("metrics", "audienceWatchRatio");
    retentionUrl.searchParams.set("dimensions", "elapsedVideoTimeRatio");
    retentionUrl.searchParams.set("filters", `video==${videoId}`);
    retentionUrl.searchParams.set("sort", "elapsedVideoTimeRatio");

    const retRes = await fetch(retentionUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!retRes.ok) {
      const err = await retRes.json();
      return NextResponse.json({ error: err.error?.message || "リテンション取得失敗" }, { status: retRes.status });
    }

    const retData = await retRes.json();

    // リテンションカーブに変換（0-100%の時間軸、0-100%の維持率）
    const retention = (retData.rows || []).map((row: [number, number]) => ({
      timePercent: Math.round(row[0] * 100),
      retentionPercent: Math.round(row[1] * 100),
    }));

    return NextResponse.json({ retention });
  } catch {
    return NextResponse.json({ error: "リテンションデータの取得に失敗" }, { status: 500 });
  }
}
