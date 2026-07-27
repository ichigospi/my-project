import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { saveAsset, assetPath, assetUrl } from "@/lib/video-assets";

export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const TTS_VOICES = ["nova", "shimmer", "alloy", "echo", "onyx", "fable", "coral", "sage"];

// ナレーション音声の生成(OpenAI TTS)。音声の長さ(秒)も返す
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, openaiApiKey, voice = "nova", speed = 1.0, instructions } = body;

  if (!openaiApiKey) return NextResponse.json({ error: "OpenAI APIキーが必要です" }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: "text が必要です" }, { status: 400 });

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: TTS_VOICES.includes(voice) ? voice : "nova",
        input: String(text).slice(0, 2000),
        response_format: "mp3",
        speed: Math.min(Math.max(Number(speed) || 1.0, 0.5), 2.0),
        ...(instructions ? { instructions: String(instructions).slice(0, 500) } : {}),
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: e.error?.message || `OpenAI TTSエラー (${res.status})` },
        { status: res.status },
      );
    }
    const id = await saveAsset(Buffer.from(await res.arrayBuffer()), "mp3");

    // 音声の長さを取得(シーン尺の自動調整に使う)
    let duration = 0;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
        assetPath(id)!,
      ]);
      duration = Math.round(parseFloat(stdout.trim()) * 10) / 10 || 0;
    } catch (e) {
      console.error("POST /api/video/tts ffprobe failed", e);
    }

    return NextResponse.json({ url: assetUrl(id), duration });
  } catch (e) {
    console.error("POST /api/video/tts", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
