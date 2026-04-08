import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

// YouTube動画の字幕を自動取得 + 動画情報
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const apiKey = request.nextUrl.searchParams.get("apiKey");

  if (!videoId) {
    return NextResponse.json({ error: "videoId が必要です" }, { status: 400 });
  }

  // 動画情報の取得
  let videoInfo = null;
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,statistics,contentDetails");
      url.searchParams.set("id", videoId);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const video = data.items?.[0];
        if (video) {
          videoInfo = {
            videoId: video.id,
            title: video.snippet?.title || "",
            channelTitle: video.snippet?.channelTitle || "",
            description: video.snippet?.description || "",
            views: parseInt(video.statistics?.viewCount || "0", 10),
            likes: parseInt(video.statistics?.likeCount || "0", 10),
            comments: parseInt(video.statistics?.commentCount || "0", 10),
            duration: video.contentDetails?.duration || "",
            thumbnailUrl: video.snippet?.thumbnails?.medium?.url || "",
            publishedAt: video.snippet?.publishedAt?.split("T")[0] || "",
            tags: video.snippet?.tags || [],
          };
        }
      }
    } catch {
      // 動画情報取得失敗は致命的ではない
    }
  }

  // 字幕の自動取得
  let transcript = "";
  let transcriptError = "";

  try {
    // 日本語字幕を優先的に取得
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ja" });
    transcript = items.map((item) => item.text).join(" ");
  } catch {
    try {
      // 日本語がなければ自動生成字幕を取得
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = items.map((item) => item.text).join(" ");
    } catch {
      transcriptError = "字幕を自動取得できませんでした。手動で貼り付けてください。";
    }
  }

  // HTMLエンティティをデコード
  if (transcript) {
    transcript = transcript
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  return NextResponse.json({
    ...videoInfo,
    transcript,
    transcriptError,
  });
}
