// 単一ツイートURL → 本文・指標を自動取得
// 1. X API Bearer Token があれば公式 API で取得（本文・いいね・RT・返信・日時 + 自分のツイートならインプ）
// 2. なければ oEmbed (publish.twitter.com) で本文・著者名のみ取得
// インプは他人のツイートでは X API でも基本取れない仕様なので、UI 側で手入力してもらう
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSettings, parseXUrl } from "@/lib/x-post-types";

interface LookupResult {
  postId: string;
  postUrl: string;
  authorHandle: string;
  authorName: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  postedAt: string | null;
  isQuoteRt: boolean;
  source: "x_api" | "oembed" | "partial";
  warnings: string[];
}

interface XApiTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  };
  referenced_tweets?: { type: string; id: string }[];
}

interface XApiTweetResponse {
  data?: XApiTweet;
  includes?: { users?: { id: string; username: string; name: string }[] };
  errors?: { detail?: string; title?: string }[];
}

interface OEmbedResponse {
  html?: string;
  author_name?: string;
  author_url?: string;
  url?: string;
}

// oEmbed の HTML から tweet テキストを抽出
function extractOEmbedText(html: string): string {
  if (!html) return "";
  // <p>...</p> の中身を取る
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!m) return "";
  let text = m[1];
  // <br> を改行に
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // <a> タグの中身は残してタグだけ除去
  text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  // 残りのHTMLタグ除去
  text = text.replace(/<[^>]+>/g, "");
  // HTMLエンティティ デコード
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ");
  return text.trim();
}

// author_url (https://twitter.com/handle) からハンドル抽出
function handleFromAuthorUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? "";
  } catch {
    return "";
  }
}

// POST /api/x-post/posts/lookup-url
// Body: { url: string, genre?: "business"|"spiritual", competitorId?: string }
// genre / competitorId は X API Bearer Token 取得用（どちらかあれば良い）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = String(body.url ?? "").trim();
    const genreInput = body.genre as "business" | "spiritual" | undefined;
    const competitorId = body.competitorId as string | undefined;

    if (!url) {
      return NextResponse.json({ error: "url は必須" }, { status: 400 });
    }
    const parsed = parseXUrl(url);
    if (!parsed.postId) {
      return NextResponse.json({ error: "X/TwitterのツイートURLとして認識できません" }, { status: 400 });
    }
    const postId = parsed.postId;
    const canonicalUrl = parsed.handle
      ? `https://x.com/${parsed.handle}/status/${postId}`
      : url;

    // Bearer Token を取得（genre or competitor 経由）
    let genre: "business" | "spiritual" | undefined = genreInput;
    if (!genre && competitorId) {
      const c = await prisma.xCompetitor.findUnique({
        where: { id: competitorId },
        select: { genre: true },
      });
      if (c?.genre === "business" || c?.genre === "spiritual") genre = c.genre;
    }

    let bearer = "";
    if (genre) {
      const settingsRecord = await prisma.xSettings.findUnique({ where: { genre } });
      const settings = parseSettings(settingsRecord, genre);
      bearer = settings.xApiBearerToken;
    }

    const warnings: string[] = [];
    const result: LookupResult = {
      postId,
      postUrl: canonicalUrl,
      authorHandle: parsed.handle ?? "",
      authorName: "",
      content: "",
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      postedAt: null,
      isQuoteRt: false,
      source: "partial",
      warnings,
    };

    // ---- 1. X API で取得を試す ----
    if (bearer) {
      try {
        const apiUrl = new URL(`https://api.twitter.com/2/tweets/${postId}`);
        apiUrl.searchParams.set(
          "tweet.fields",
          "created_at,public_metrics,referenced_tweets,author_id",
        );
        apiUrl.searchParams.set("expansions", "author_id");
        apiUrl.searchParams.set("user.fields", "username,name");

        const r = await fetch(apiUrl.toString(), {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        if (r.ok) {
          const j = (await r.json()) as XApiTweetResponse;
          if (j.data) {
            const t = j.data;
            const author = j.includes?.users?.find((u) => u.id === t.author_id);
            result.content = t.text;
            result.likes = t.public_metrics?.like_count ?? 0;
            result.retweets = t.public_metrics?.retweet_count ?? 0;
            result.replies = t.public_metrics?.reply_count ?? 0;
            result.impressions = t.public_metrics?.impression_count ?? 0;
            result.postedAt = t.created_at ?? null;
            result.isQuoteRt = (t.referenced_tweets ?? []).some((rt) => rt.type === "quoted");
            if (author) {
              result.authorHandle = author.username;
              result.authorName = author.name;
              result.postUrl = `https://x.com/${author.username}/status/${postId}`;
            }
            result.source = "x_api";
            if (result.impressions === 0) {
              warnings.push("インプレッションは X API では取得できないことが多いです（X画面の「N views」を見て手入力してください）");
            }
            return NextResponse.json(result);
          }
          if (j.errors?.length) {
            warnings.push(`X API: ${j.errors[0].detail || j.errors[0].title}`);
          }
        } else {
          const errText = await r.text().catch(() => "");
          warnings.push(`X API取得失敗 (${r.status}): ${errText.slice(0, 100)}`);
        }
      } catch (e) {
        warnings.push(`X API例外: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      warnings.push("X API Bearer Token 未設定 — oEmbedフォールバック（本文のみ取得）");
    }

    // ---- 2. oEmbed フォールバック ----
    try {
      const oembedUrl = new URL("https://publish.twitter.com/oembed");
      oembedUrl.searchParams.set("url", canonicalUrl);
      oembedUrl.searchParams.set("omit_script", "true");
      oembedUrl.searchParams.set("hide_thread", "true");
      const r = await fetch(oembedUrl.toString());
      if (r.ok) {
        const j = (await r.json()) as OEmbedResponse;
        result.content = extractOEmbedText(j.html ?? "");
        result.authorName = j.author_name ?? "";
        if (!result.authorHandle) {
          result.authorHandle = handleFromAuthorUrl(j.author_url);
        }
        if (result.content) {
          result.source = "oembed";
          warnings.push("いいね/RT/返信/インプ/日時は手入力してください");
          return NextResponse.json(result);
        }
        warnings.push("oEmbedからも本文を抽出できませんでした");
      } else {
        warnings.push(`oEmbed取得失敗 (${r.status})`);
      }
    } catch (e) {
      warnings.push(`oEmbed例外: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 何も取れなかった
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/x-post/posts/lookup-url", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
