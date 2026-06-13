import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { mkdirSync, existsSync, statSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// YouTube動画から音声(MP3)を抽出するローカル専用ルート。
// 字幕なし＆OCRも効かない動画(音声のみのトーク)を Whisper で書き起こすための前段。
//
// Whisper API の制限(25MB)を超える場合は ffmpeg で 10分チャンクに自動分割する。
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

  const tempDir = join(tmpdir(), `yt-audio-${videoId}-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputTemplate = join(tempDir, "audio.%(ext)s");

    // 音声のみ取得。低品質(quality 5≈64kbps)で容量を抑える(書き起こし用途では十分)
    const ytdlpCmd = `"${ytdlpPath}" -x --audio-format mp3 --audio-quality 5 -o "${outputTemplate}" --no-warnings "${videoUrl}"`;

    console.log(`[extract-audio] downloading: ${videoId}`);
    execSync(ytdlpCmd, { env: execEnv, stdio: "pipe", maxBuffer: 200 * 1024 * 1024 });

    const files = readdirSync(tempDir);
    const audioFile = files.find(f => f.startsWith("audio.") && (f.endsWith(".mp3") || f.endsWith(".m4a")));
    if (!audioFile) {
      return NextResponse.json({ error: "音声ファイルの取得に失敗しました" }, { status: 500 });
    }

    const audioPath = join(tempDir, audioFile);
    const sizeMB = statSync(audioPath).size / 1024 / 1024;
    console.log(`[extract-audio] downloaded ${audioFile}: ${sizeMB.toFixed(1)}MB`);

    // Whisper API は 25MB が上限。安全のため 24MB 超なら 10分チャンクに分割
    const chunks: string[] = [];
    if (sizeMB > 24) {
      const chunkDir = join(tempDir, "chunks");
      mkdirSync(chunkDir, { recursive: true });
      const splitCmd = `"${ffmpegPath}" -i "${audioPath}" -f segment -segment_time 600 -c copy -y "${join(chunkDir, "chunk_%03d.mp3")}" 2>/dev/null`;
      execSync(splitCmd, { env: execEnv, stdio: "pipe" });
      const chunkFiles = readdirSync(chunkDir).filter(f => f.startsWith("chunk_") && f.endsWith(".mp3")).sort();
      for (const f of chunkFiles) chunks.push(join(chunkDir, f));
      console.log(`[extract-audio] split into ${chunks.length} chunks`);
    } else {
      chunks.push(audioPath);
    }

    return NextResponse.json({
      chunks,
      sizeMB: Number(sizeMB.toFixed(2)),
      chunkCount: chunks.length,
      cleanupDir: tempDir,
    });
  } catch (e) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    const msg = e instanceof Error ? e.message : "音声抽出に失敗しました";
    console.error("[extract-audio] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
