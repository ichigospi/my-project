import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/x-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content, bearerToken, replyTo, quoteTweetId } = body;

  if (!bearerToken) {
    return NextResponse.json({ error: "X APIトークンが必要です" }, { status: 400 });
  }

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: "投稿内容が空です" }, { status: 400 });
  }

  if (content.length > 280) {
    return NextResponse.json({ error: "280文字を超えています" }, { status: 400 });
  }

  try {
    const result = await postTweet(bearerToken, {
      text: content,
      reply_to: replyTo,
      quote_tweet_id: quoteTweetId,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tweet: result.data,
    });
  } catch {
    return NextResponse.json({ error: "投稿に失敗しました" }, { status: 500 });
  }
}
