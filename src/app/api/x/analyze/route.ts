import { NextRequest, NextResponse } from "next/server";
import { searchRecentTweets, getUserTweets, getMe, getJapanTrends } from "@/lib/x-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, bearerToken, query, userId, aiApiKey } = body;

  if (!bearerToken) {
    return NextResponse.json({ error: "X APIトークンが必要です" }, { status: 400 });
  }

  try {
    switch (type) {
      case "trends": {
        const result = await getJapanTrends(bearerToken);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // AI分析が有効な場合、トレンドのサマリーを生成
        let aiSummary = "";
        if (aiApiKey && result.data) {
          aiSummary = await generateTrendSummary(result.data, aiApiKey);
        }

        return NextResponse.json({ trends: result.data, aiSummary });
      }

      case "search": {
        if (!query) {
          return NextResponse.json({ error: "検索キーワードが必要です" }, { status: 400 });
        }
        const result = await searchRecentTweets(bearerToken, {
          query,
          max_results: 20,
          sort_order: "relevancy",
        });
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ tweets: result.data });
      }

      case "account": {
        const targetUserId = userId || (await getMe(bearerToken)).data?.id;
        if (!targetUserId) {
          return NextResponse.json({ error: "ユーザーID取得に失敗しました" }, { status: 400 });
        }
        const tweetsResult = await getUserTweets(bearerToken, targetUserId, 50);
        if (tweetsResult.error) {
          return NextResponse.json({ error: tweetsResult.error }, { status: 400 });
        }

        // エンゲージメント分析
        const tweets = tweetsResult.data || [];
        const analysis = analyzeEngagement(tweets);

        return NextResponse.json({ tweets, analysis });
      }

      case "me": {
        const meResult = await getMe(bearerToken);
        if (meResult.error) {
          return NextResponse.json({ error: meResult.error }, { status: 400 });
        }
        return NextResponse.json({ user: meResult.data });
      }

      default:
        return NextResponse.json({ error: "不正な分析タイプです" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "分析処理に失敗しました" }, { status: 500 });
  }
}

// エンゲージメント分析
function analyzeEngagement(tweets: Array<{ public_metrics?: { retweet_count: number; reply_count: number; like_count: number; quote_count: number; impression_count: number }; created_at: string }>) {
  if (tweets.length === 0) return { avgLikes: 0, avgRetweets: 0, avgImpressions: 0, bestTime: null, topTweet: null };

  const withMetrics = tweets.filter((t) => t.public_metrics);
  const totalLikes = withMetrics.reduce((s, t) => s + (t.public_metrics?.like_count || 0), 0);
  const totalRetweets = withMetrics.reduce((s, t) => s + (t.public_metrics?.retweet_count || 0), 0);
  const totalImpressions = withMetrics.reduce((s, t) => s + (t.public_metrics?.impression_count || 0), 0);
  const count = withMetrics.length || 1;

  // 時間帯別エンゲージメント
  const hourMap: Record<number, { count: number; engagement: number }> = {};
  for (const t of withMetrics) {
    const hour = new Date(t.created_at).getHours();
    if (!hourMap[hour]) hourMap[hour] = { count: 0, engagement: 0 };
    hourMap[hour].count++;
    hourMap[hour].engagement += (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0);
  }

  let bestHour = 0;
  let bestAvg = 0;
  for (const [hour, data] of Object.entries(hourMap)) {
    const avg = data.engagement / data.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = Number(hour);
    }
  }

  // トップツイート
  const topTweet = withMetrics.reduce((best, t) => {
    const eng = (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0);
    const bestEng = (best?.public_metrics?.like_count || 0) + (best?.public_metrics?.retweet_count || 0);
    return eng > bestEng ? t : best;
  }, withMetrics[0]);

  return {
    avgLikes: Math.round(totalLikes / count),
    avgRetweets: Math.round(totalRetweets / count),
    avgImpressions: Math.round(totalImpressions / count),
    bestHour,
    engagementRate: totalImpressions > 0 ? ((totalLikes + totalRetweets) / totalImpressions * 100).toFixed(2) : "0",
    topTweet,
    tweetCount: tweets.length,
  };
}

// AI トレンドサマリー生成
async function generateTrendSummary(
  trends: { name: string; tweet_volume: number | null }[],
  aiApiKey: string
): Promise<string> {
  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  const trendList = trends
    .slice(0, 20)
    .map((t) => `${t.name}${t.tweet_volume ? ` (${t.tweet_volume}件)` : ""}`)
    .join("\n");

  const prompt = `以下はXの日本のトレンドです。占い・スピリチュアル系YouTubeチャンネルの運営者向けに、活用できそうなトレンドをピックアップし、投稿案を簡潔に提案してください。\n\nトレンド一覧:\n${trendList}`;

  try {
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return data.content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1024,
        }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch {
    return "";
  }
}
