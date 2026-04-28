// X API v2 で競合の最新ポストを自動取得
// 注意: X API v2 の Free 枠は read 制限が厳しいので、Basic 以上のプラン推奨
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSettings } from "@/lib/x-post-types";

type Params = Promise<{ id: string }>;

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
  meta?: { result_count?: number; next_token?: string };
  errors?: { detail?: string; title?: string }[];
}

// POST /api/x-post/competitors/[id]/fetch
//   Body: { maxResults?: number, sinceDays?: number }
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const maxResults = Math.min(100, Math.max(5, Number(body.maxResults) || 20));
    const sinceDays = Math.min(30, Math.max(1, Number(body.sinceDays) || 7));

    const competitor = await prisma.xCompetitor.findUnique({ where: { id } });
    if (!competitor) {
      return NextResponse.json({ error: "競合が見つかりません" }, { status: 404 });
    }
    const genre = competitor.genre;
    if (genre !== "business" && genre !== "spiritual") {
      return NextResponse.json({ error: "ジャンル不正" }, { status: 400 });
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

    // 1. ハンドル → user_id を解決
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(competitor.handle)}`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    if (!userRes.ok) {
      const errText = await userRes.text().catch(() => "");
      return NextResponse.json(
        { error: `X APIユーザー取得失敗 (${userRes.status}): ${errText.slice(0, 200)}` },
        { status: userRes.status === 401 || userRes.status === 403 ? 400 : 502 },
      );
    }
    const userJson = (await userRes.json()) as XApiUserResponse;
    if (!userJson.data) {
      return NextResponse.json(
        { error: userJson.errors?.[0]?.detail || "ユーザー情報取得失敗" },
        { status: 404 },
      );
    }
    const userId = userJson.data.id;

    // 2. 直近のツイートを取得
    const startTime = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const tweetsUrl = new URL(`https://api.twitter.com/2/users/${userId}/tweets`);
    tweetsUrl.searchParams.set("max_results", String(maxResults));
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
      return NextResponse.json(
        { error: `X APIツイート取得失敗 (${tweetsRes.status}): ${errText.slice(0, 200)}` },
        { status: tweetsRes.status === 429 ? 429 : 502 },
      );
    }
    const tweetsJson = (await tweetsRes.json()) as XApiTweetsResponse;
    const tweets = tweetsJson.data ?? [];

    // 3. 既存の postId は除外して保存
    const existingPostIds = new Set(
      (
        await prisma.xPost.findMany({
          where: { competitorId: id, postId: { in: tweets.map((t) => t.id) } },
          select: { postId: true },
        })
      ).map((p) => p.postId),
    );

    const username = userJson.data.username;
    const created: { id: string; postId: string }[] = [];
    for (const t of tweets) {
      if (existingPostIds.has(t.id)) continue;
      const isQuoteRt = (t.referenced_tweets ?? []).some((r) => r.type === "quoted");
      const c = await prisma.xPost.create({
        data: {
          competitorId: id,
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
      created.push({ id: c.id, postId: t.id });
    }

    return NextResponse.json({
      fetched: tweets.length,
      saved: created.length,
      skipped: tweets.length - created.length,
      created,
    });
  } catch (e) {
    console.error("POST /api/x-post/competitors/[id]/fetch", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
