import { NextRequest, NextResponse } from "next/server";
import { searchRecentTweets, getUserTweets, getMe, getJapanTrends } from "@/lib/x-client";
import { callAI } from "@/lib/ai-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, bearerToken, query, userId, aiApiKey } = body;

  if (!bearerToken) return NextResponse.json({ error: "X APIトークンが必要です" }, { status: 400 });

  try {
    switch (type) {
      case "trends": {
        const result = await getJapanTrends(bearerToken);
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

        let aiSummary = "";
        if (aiApiKey && result.data) {
          const trendList = result.data.slice(0, 20).map((t) => `${t.name}${t.tweet_volume ? ` (${t.tweet_volume}件)` : ""}`).join("\n");
          const ai = await callAI(aiApiKey,
            "占い・スピリチュアル系SNSマーケティング専門家として回答してください。",
            `以下のXトレンドから、占い・スピリチュアル系アカウントが活用できるものをピックアップし投稿案を提案してください。\n\n${trendList}`,
            1024
          );
          aiSummary = ai.text;
        }
        return NextResponse.json({ trends: result.data, aiSummary });
      }

      case "search": {
        if (!query) return NextResponse.json({ error: "検索キーワードが必要です" }, { status: 400 });
        const result = await searchRecentTweets(bearerToken, query);
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ tweets: result.data });
      }

      case "account": {
        const targetUserId = userId || (await getMe(bearerToken)).data?.id;
        if (!targetUserId) return NextResponse.json({ error: "ユーザーID取得に失敗" }, { status: 400 });
        const tweetsResult = await getUserTweets(bearerToken, targetUserId, 50);
        if (tweetsResult.error) return NextResponse.json({ error: tweetsResult.error }, { status: 400 });

        const tweets = tweetsResult.data || [];
        const withMetrics = tweets.filter((t) => t.public_metrics);
        const count = withMetrics.length || 1;
        const totalLikes = withMetrics.reduce((s, t) => s + (t.public_metrics?.like_count || 0), 0);
        const totalRT = withMetrics.reduce((s, t) => s + (t.public_metrics?.retweet_count || 0), 0);
        const totalImp = withMetrics.reduce((s, t) => s + (t.public_metrics?.impression_count || 0), 0);

        const hourMap: Record<number, { count: number; engagement: number }> = {};
        for (const t of withMetrics) {
          const h = new Date(t.created_at).getHours();
          if (!hourMap[h]) hourMap[h] = { count: 0, engagement: 0 };
          hourMap[h].count++;
          hourMap[h].engagement += (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0);
        }
        let bestHour = 0, bestAvg = 0;
        for (const [h, d] of Object.entries(hourMap)) { const avg = d.engagement / d.count; if (avg > bestAvg) { bestAvg = avg; bestHour = Number(h); } }

        return NextResponse.json({
          tweets,
          analysis: {
            avgLikes: Math.round(totalLikes / count),
            avgRetweets: Math.round(totalRT / count),
            avgImpressions: Math.round(totalImp / count),
            engagementRate: totalImp > 0 ? ((totalLikes + totalRT) / totalImp * 100).toFixed(2) : "0",
            bestHour,
            tweetCount: tweets.length,
          },
        });
      }

      case "me": {
        const meResult = await getMe(bearerToken);
        if (meResult.error) return NextResponse.json({ error: meResult.error }, { status: 400 });
        return NextResponse.json({ user: meResult.data });
      }

      default:
        return NextResponse.json({ error: "不正な分析タイプです" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "分析処理に失敗しました" }, { status: 500 });
  }
}
