import { NextRequest, NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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

    // yt-dlp で動画ダウンロード
    execFileSync(ytdlpPath, [
      "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
      "-o", videoPath,
      "--no-playlist",
      "--socket-timeout", "30",
      "--no-check-certificates",
      videoUrl,
    ], { timeout: 180000, env: execEnv });

    if (!existsSync(videoPath)) {
      return NextResponse.json({ error: "動画のダウンロードに失敗しました" }, { status: 500 });
    }

    // 3秒間隔でフレーム抽出
    const framesDir = join(tempDir, "frames");
    mkdirSync(framesDir, { recursive: true });

    execFileSync(ffmpegPath, [
      "-i", videoPath,
      "-vf", "fps=1/3,scale=640:-1",
      "-q:v", "4",
      join(framesDir, "frame_%04d.jpg"),
    ], { timeout: 180000, env: execEnv });

    const allFrameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith(".jpg"))
      .sort();

    const totalExtracted = allFrameFiles.length;

    // 重複除去: ファイルサイズが前のフレームと近い場合はスキップ
    // テロップが変わるとファイルサイズが変化する
    const uniqueFrames: string[] = [];
    let prevSize = 0;

    for (const file of allFrameFiles) {
      const filePath = join(framesDir, file);
      const size = statSync(filePath).size;
      const sizeDiff = prevSize > 0 ? Math.abs(size - prevSize) / prevSize : 1;

      // サイズが8%以上変化したフレームだけ採用
      if (sizeDiff > 0.08 || prevSize === 0) {
        const data = readFileSync(filePath);
        uniqueFrames.push(`data:image/jpeg;base64,${data.toString("base64")}`);
        prevSize = size;
      }
    }

    // クリーンアップ
    rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      frames: uniqueFrames,
      totalExtracted,
      uniqueCount: uniqueFrames.length,
    });
  } catch (error) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    const message = error instanceof Error ? error.message : "フレーム抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
