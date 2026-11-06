import { NextResponse } from "next/server";
import { localExecEnv, findBinary } from "@/lib/local-bins";

export async function GET() {
  const result: { db: boolean; ytdlp: boolean; ffmpeg: boolean; dbError?: string } = { db: false, ytdlp: false, ffmpeg: false };

  // DB接続チェック
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.appSetting.findFirst();
    result.db = true;
  } catch (e) {
    // 原因究明のためエラー内容を返す（画面の警告に表示される）
    result.dbError = String(e).slice(0, 300);
  }

  const execEnv = localExecEnv();
  result.ytdlp = !!findBinary("yt-dlp", execEnv);
  result.ffmpeg = !!findBinary("ffmpeg", execEnv);

  return NextResponse.json(result);
}
