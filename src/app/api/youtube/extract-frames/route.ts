import { NextRequest, NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// yt-dlp + ffmpeg でYouTube動画からフレームを抽出
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoId, intervalSeconds = 3 } = body;

  if (!videoId) {
    return NextResponse.json({ error: "videoId が必要です" }, { status: 400 });
  }

  // yt-dlp と ffmpeg の存在確認
  // Macのbrewインストール先を含むPATH
  const extendedPath = [
    process.env.PATH || "",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ].join(":");

  let ytdlpPath = "";
  let ffmpegPath = "";

  try {
    ytdlpPath = execSync("which yt-dlp", { env: { ...process.env, PATH: extendedPath } }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({
      error: "yt-dlp がインストールされていません。\nターミナルで以下を実行後、npm run dev を再起動してください:\n\nbrew install yt-dlp",
    }, { status: 400 });
  }

  try {
    ffmpegPath = execSync("which ffmpeg", { env: { ...process.env, PATH: extendedPath } }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({
      error: "ffmpeg がインストールされていません。\nターミナルで以下を実行後、npm run dev を再起動してください:\n\nbrew install ffmpeg",
    }, { status: 400 });
  }

  const tempDir = join(tmpdir(), `yt-frames-${videoId}-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoPath = join(tempDir, "video.mp4");

    const execEnv = { ...process.env, PATH: extendedPath };

    // yt-dlp で動画ダウンロード（720p以下、最短の形式）
    execFileSync(ytdlpPath, [
      "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
      "-o", videoPath,
      "--no-playlist",
      "--socket-timeout", "30",
      videoUrl,
    ], { timeout: 180000, env: execEnv });

    if (!existsSync(videoPath)) {
      return NextResponse.json({ error: "動画のダウンロードに失敗しました" }, { status: 500 });
    }

    // ffmpeg でフレーム抽出
    const framesDir = join(tempDir, "frames");
    mkdirSync(framesDir, { recursive: true });

    execFileSync(ffmpegPath, [
      "-i", videoPath,
      "-vf", `fps=1/${intervalSeconds},scale=1280:-1`,
      "-q:v", "3",
      join(framesDir, "frame_%04d.jpg"),
    ], { timeout: 180000, env: execEnv });

    // フレームをbase64で読み込み
    const frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith(".jpg"))
      .sort();

    const frames = frameFiles.map((f) => {
      const data = readFileSync(join(framesDir, f));
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    });

    // 一時ファイルを削除
    rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      frames,
      frameCount: frames.length,
      intervalSeconds,
    });
  } catch (error) {
    // クリーンアップ
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }

    const message = error instanceof Error ? error.message : "フレーム抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
