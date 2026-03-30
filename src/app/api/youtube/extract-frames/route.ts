import { NextRequest, NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from "fs";
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

  let ytdlpPath = "";
  let ffmpegPath = "";

  try {
    ytdlpPath = execSync("which yt-dlp", { env: { ...process.env, PATH: extendedPath } }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({ error: "yt-dlp がインストールされていません。\nbrew install yt-dlp" }, { status: 400 });
  }

  try {
    ffmpegPath = execSync("which ffmpeg", { env: { ...process.env, PATH: extendedPath } }).toString().trim().split("\n")[0];
  } catch {
    return NextResponse.json({ error: "ffmpeg がインストールされていません。\nbrew install ffmpeg" }, { status: 400 });
  }

  const tempDir = join(tmpdir(), `yt-frames-${videoId}-${Date.now()}`);
  const execEnv = { ...process.env, PATH: extendedPath };

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

    // Step 1: シーン検出で画面が変わったフレームだけ抽出
    // scene=0.3 → 画面の30%以上が変化したら新しいシーンとして検出
    const framesDir = join(tempDir, "frames");
    mkdirSync(framesDir, { recursive: true });

    execFileSync(ffmpegPath, [
      "-i", videoPath,
      "-vf", "select='gt(scene\\,0.15)',scale=640:-1",
      "-vsync", "vfr",
      "-q:v", "4",
      join(framesDir, "frame_%04d.jpg"),
    ], { timeout: 180000, env: execEnv });

    let frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith(".jpg"))
      .sort();

    // シーン検出でフレームが少なすぎる場合は、5秒間隔にフォールバック
    if (frameFiles.length < 10) {
      // フレームを削除して再抽出
      for (const f of frameFiles) {
        try { rmSync(join(framesDir, f)); } catch { /* ignore */ }
      }

      execFileSync(ffmpegPath, [
        "-i", videoPath,
        "-vf", "fps=1/5,scale=640:-1",
        "-q:v", "4",
        join(framesDir, "frame_%04d.jpg"),
      ], { timeout: 180000, env: execEnv });

      frameFiles = readdirSync(framesDir)
        .filter((f) => f.endsWith(".jpg"))
        .sort();
    }

    // フレームをbase64で読み込み
    const frames = frameFiles.map((f) => {
      const data = readFileSync(join(framesDir, f));
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    });

    // クリーンアップ
    rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      frames,
      frameCount: frames.length,
      method: frameFiles.length >= 10 ? "scene_detection" : "interval",
    });
  } catch (error) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    const message = error instanceof Error ? error.message : "フレーム抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
