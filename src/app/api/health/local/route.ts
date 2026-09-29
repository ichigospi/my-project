import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result: { db: boolean; ytdlp: boolean; ffmpeg: boolean; dbError?: string } = { db: false, ytdlp: false, ffmpeg: false };

  // DB接続チェック
  try {
    await prisma.appSetting.findFirst();
    result.db = true;
  } catch (e) {
    // 原因究明のためエラー内容を返す（画面の警告に表示される）
    result.dbError = String(e).slice(0, 300);
  }

  const isWindows = process.platform === "win32";
  const whichCmd = isWindows ? "where" : "which";

  const extendedPath = isWindows
    ? process.env.PATH || ""
    : [process.env.PATH || "", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
  const execEnv = { ...process.env, PATH: extendedPath };

  // yt-dlpチェック
  try {
    execSync(`${whichCmd} yt-dlp`, { env: execEnv, stdio: "pipe" });
    result.ytdlp = true;
  } catch {
    /* yt-dlp未インストール */
  }

  // ffmpegチェック
  try {
    execSync(`${whichCmd} ffmpeg`, { env: execEnv, stdio: "pipe" });
    result.ffmpeg = true;
  } catch {
    /* ffmpeg未インストール */
  }

  return NextResponse.json(result);
}
