import { NextRequest, NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoId } = body;

  if (!videoId) {
    return NextResponse.json({ error: "videoId が必要です" }, { status: 400 });
  }

  const extendedPath = [
    process.env.PATH || "",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ].join(":");
  const execEnv = { ...process.env, PATH: extendedPath };

  let ytdlpPath = "";
  let ffmpegPath = "";

  try {
    ytdlpPath = execSync("which yt-dlp", { env: execEnv }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({ error: "yt-dlp がインストールされていません。\nbrew install yt-dlp" }, { status: 400 });
  }

  try {
    ffmpegPath = execSync("which ffmpeg", { env: execEnv }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({ error: "ffmpeg がインストールされていません。\nbrew install ffmpeg" }, { status: 400 });
  }

  const tempDir = join(tmpdir(), `yt-frames-${videoId}-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoPath = join(tempDir, "video.mp4");

    // DBからCookieを取得
    let cookiePath = "";
    try {
      const cookieSetting = await prisma.appSetting.findUnique({ where: { key: "yt_cookies" } });
      if (cookieSetting?.value) {
        cookiePath = join(tempDir, "cookies.txt");
        writeFileSync(cookiePath, cookieSetting.value);
      }
    } catch { /* Cookie取得失敗は無視 */ }

    // まず字幕APIで取得を試みる（Cookie不要）
    let transcriptFromApi = "";
    try {
      const transcriptRes = await fetch(`${request.nextUrl.origin}/api/youtube/transcript?videoId=${videoId}`);
      const transcriptData = await transcriptRes.json();
      if (transcriptData.transcript && transcriptData.transcript.length > 100 && !transcriptData.transcript.match(/^\[music\]\s*$/gim)) {
        // 字幕が取得できた場合はフレーム抽出をスキップして字幕テキストを返す
        return NextResponse.json({
          frames: [],
          frameCount: 0,
          transcript: transcriptData.transcript,
          method: "subtitle",
        });
      }
    } catch { /* 字幕取得失敗は無視してフレーム抽出に進む */ }

    // 複数のプレイヤークライアントを順番に試す（Cookie有無で順序変更）
    const clients = cookiePath ? ["web", "web_creator", "mweb", "tv", "ios"] : ["tv", "ios", "mediaconnect", "web"];
    let downloaded = false;
    let lastError = "";

    for (const client of clients) {
      try {
        const args: string[] = [];
        if (cookiePath && existsSync(cookiePath)) {
          args.push("--cookies", cookiePath);
        }
        args.push(
          "-f", "bestvideo[height<=480]/best[height<=480]/bestvideo/best",
          "-o", videoPath,
          "--no-playlist",
          "--socket-timeout", "30",
          "--no-check-certificates",
          "--geo-bypass",
          "--extractor-args", `youtube:player_client=${client}`,
          videoUrl,
        );

        execFileSync(ytdlpPath, args, { timeout: 300000, env: execEnv, stdio: "pipe" });

        if (existsSync(videoPath)) {
          downloaded = true;
          break;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if ((e as { stderr?: Buffer }).stderr) {
          lastError = (e as { stderr: Buffer }).stderr.toString().slice(-500);
        }
        continue;
      }
    }

    if (!downloaded) {
      console.error("yt-dlp failed:", lastError);
      const msg = cookiePath
        ? `動画のダウンロードに失敗しました。Cookieが期限切れの可能性があります。設定ページからCookieを再アップロードしてください。\n詳細: ${lastError.slice(0, 200)}`
        : "動画のダウンロードに失敗しました。設定ページからYouTubeのCookieをアップロードしてください。";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // 3秒間隔でフレーム抽出（重複除去なし＝全フレーム送信）
    const framesDir = join(tempDir, "frames");
    mkdirSync(framesDir, { recursive: true });

    execFileSync(ffmpegPath, [
      "-i", videoPath,
      "-vf", "fps=1/3,scale=640:-1",
      "-q:v", "4",
      join(framesDir, "frame_%04d.jpg"),
    ], { timeout: 180000, env: execEnv });

    const frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith(".jpg"))
      .sort();

    // 全フレームをbase64に変換
    const frames = frameFiles.map((f) => {
      const data = readFileSync(join(framesDir, f));
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    });

    rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      frames,
      frameCount: frames.length,
    });
  } catch (error) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    const message = error instanceof Error ? error.message : "フレーム抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
