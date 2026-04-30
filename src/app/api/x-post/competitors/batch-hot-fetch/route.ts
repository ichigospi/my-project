// 全競合から「N時間以内に閾値超えのインプ/いいねを獲得した投稿」を一括取得
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSettings } from "@/lib/x-post-types";

interface XApiTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  };
  referenced_tweets?: { type: string; id: string }[];
}

interface XApiUserResponse {
  data?: { id: string; username: string; name: string };
  errors?: { detail?: string; title?: string }[];
}

interface XApiTweetsResponse {
  data?: XApiTweet[];
  errors?: { detail?: string; title?: string }[];
}

interface PerCompetitorResult {
  competitorId: string;
  handle: string;
  status: "ok" | "skipped" | "error";
  fetched: number;
  hot: number;
  saved: number;
  skipped: number;
  error?: string;
}

// POST /api/x-post/competitors/batch-hot-fetch
// Body: { genre, hoursWithin?, minImpressions?, minLikes?, minRetweets?, maxPerAccount? }
// X APIで全(非自分)競合の最近ツイートを取得し、時間窓+閾値を満たすものだけを保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const genre = body.genre as "business" | "spiritual" | undefined;
    const hoursWithin = Math.max(1, Math.min(168, Number(body.hoursWithin) || 24));
    const minImpressions = Math.max(0, Number(body.minImpressions) || 0);
    const minLikes = Math.max(0, Number(body.minLikes) || 0);
    const minRetweets = Math.max(0, Number(body.minRetweets) || 0);
    const maxPerAccount = Math.max(5, Math.min(100, Number(body.maxPerAccount) || 30));

    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "genre は business か spiritual" }, { status: 400 });
    }
    if (minImpressions === 0 && minLikes === 0 && minRetweets === 0) {
      return NextResponse.json(
        { error: "閾値を最低1つ指定してください（インプ/いいね/RT）" },
        { status: 400 },
      );
    }

    const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
    const settings = parseSettings(settingsRecord, genre);
    const bearer = settings.xApiBearerToken;
    if (!bearer) {
      return NextResponse.json(
        { error: "X API Bearer Token が未設定です。設定モーダルから登録してください。" },
        { status: 400 },
      );
    }

    const competitors = await prisma.xCompetitor.findMany({
      where: { genre, isSelf: false },
    });
    if (competitors.length === 0) {
      return NextResponse.json({
        results: [],
        totalHot: 0,
        message: "競合が登録されていません",
      });
    }

    const startTime = new Date(Date.now() - hoursWithin * 60 * 60 * 1000).toISOString();
    const results: PerCompetitorResult[] = [];

    // 競合ごとに直列で処理（X APIのレート制限を考慮）
    for (const c of competitors) {
      const r: PerCompetitorResult = {
        competitorId: c.id,
        handle: c.handle,
        status: "ok",
        fetched: 0,
        hot: 0,
        saved: 0,
        skipped: 0,
      };

      try {
        // user_id 解決
        const userRes = await fetch(
          `https://api.twitter.com/2/users/by/username/${encodeURIComponent(c.handle)}`,
          { headers: { Authorization: `Bearer ${bearer}` } },
        );
        if (!userRes.ok) {
          const errText = await userRes.text().catch(() => "");
          r.status = "error";
          r.error = `ユーザー取得失敗 (${userRes.status}): ${errText.slice(0, 100)}`;
          // 401/403 は全体キーが無効なので即終了
          if (userRes.status === 401 || userRes.status === 403) {
            results.push(r);
            return NextResponse.json(
              { results, totalHot: 0, error: "X APIキーが無効です。設定で再確認してください。" },
              { status: 400 },
            );
          }
          // 429 はレート制限なので一旦中断
          if (userRes.status === 429) {
            results.push(r);
            return NextResponse.json(
              { results, totalHot: 0, error: "X APIレート制限。時間をおいて再実行してください。" },
              { status: 429 },
            );
          }
          results.push(r);
          continue;
        }
        const userJson = (await userRes.json()) as XApiUserResponse;
        if (!userJson.data) {
          r.status = "error";
          r.error = userJson.errors?.[0]?.detail || "ユーザー情報取得失敗";
          results.push(r);
          continue;
        }
        const userId = userJson.data.id;
        const username = userJson.data.username;

        // ツイート取得（時間窓内の最新N件）
        const tweetsUrl = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
        tweetsUrl.searchParams.set("max_results", String(maxPerAccount));
        tweetsUrl.searchParams.set("start_time", startTime);
        tweetsUrl.searchParams.set(
          "tweet.fields",
          "created_at,public_metrics,referenced_tweets",
        );
        tweetsUrl.searchParams.set("exclude", "replies,retweets");

        const tweetsRes = await fetch(tweetsUrl.toString(), {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        if (!tweetsRes.ok) {
          const errText = await tweetsRes.text().catch(() => "");
          r.status = "error";
          r.error = `ツイート取得失敗 (${tweetsRes.status}): ${errText.slice(0, 100)}`;
          if (tweetsRes.status === 429) {
            results.push(r);
            return NextResponse.json(
              { results, totalHot: 0, error: "X APIレート制限。時間をおいて再実行してください。" },
              { status: 429 },
            );
          }
          results.push(r);
          continue;
        }
        const tweetsJson = (await tweetsRes.json()) as XApiTweetsResponse;
        const tweets = tweetsJson.data ?? [];
        r.fetched = tweets.length;

        // 閾値フィルタ
        const hotTweets = tweets.filter((t) => {
          const m = t.public_metrics ?? {};
          const imp = m.impression_count ?? 0;
          const lk = m.like_count ?? 0;
          const rt = m.retweet_count ?? 0;
          // いずれかの閾値を超えればホット
          if (minImpressions > 0 && imp >= minImpressions) return true;
          if (minLikes > 0 && lk >= minLikes) return true;
          if (minRetweets > 0 && rt >= minRetweets) return true;
          return false;
        });
        r.hot = hotTweets.length;

        if (hotTweets.length === 0) {
          r.status = "ok";
          results.push(r);
          continue;
        }

        // 既存 postId を除外
        const existingIds = new Set(
          (
            await prisma.xPost.findMany({
              where: { competitorId: c.id, postId: { in: hotTweets.map((t) => t.id) } },
              select: { postId: true },
            })
          ).map((p) => p.postId),
        );

        for (const t of hotTweets) {
          if (existingIds.has(t.id)) {
            r.skipped++;
            continue;
          }
          const isQuoteRt = (t.referenced_tweets ?? []).some((rt) => rt.type === "quoted");
          await prisma.xPost.create({
            data: {
              competitorId: c.id,
              postId: t.id,
              postUrl: `https://x.com/${username}/status/${t.id}`,
              content: t.text,
              likes: t.public_metrics?.like_count ?? 0,
              retweets: t.public_metrics?.retweet_count ?? 0,
              replies: t.public_metrics?.reply_count ?? 0,
              impressions: t.public_metrics?.impression_count ?? 0,
              postedAt: t.created_at ? new Date(t.created_at) : null,
              isQuoteRt,
              quotedPostUrl: "",
            },
          });
          r.saved++;
        }
      } catch (e) {
        r.status = "error";
        r.error = e instanceof Error ? e.message : String(e);
      }

      results.push(r);
    }

    const totalHot = results.reduce((acc, r) => acc + r.hot, 0);
    const totalSaved = results.reduce((acc, r) => acc + r.saved, 0);

    return NextResponse.json({
      results,
      totalCompetitors: competitors.length,
      totalHot,
      totalSaved,
      hoursWithin,
      minImpressions,
      minLikes,
      minRetweets,
    });
  } catch (e) {
    console.error("POST /api/x-post/competitors/batch-hot-fetch", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
