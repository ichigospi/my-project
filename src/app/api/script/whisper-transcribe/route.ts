import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, rmSync } from "fs";
import { basename } from "path";

// 音声ファイル(チャンク群)を OpenAI Whisper API に投げて日本語書き起こしを取得する。
// 入力チャンクは /api/youtube/extract-audio で生成されたローカルパス。
//
// 注: Whisper は OpenAI API なので、Anthropicキー(sk-ant-)では動かない。
// 別途 OpenAI のキー(sk-...)を受け取る必要がある。

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { chunks, openaiApiKey, cleanupDir, language = "ja" } = body as {
    chunks: string[];
    openaiApiKey: string;
    cleanupDir?: string;
    language?: string;
  };

  if (!openaiApiKey || !openaiApiKey.startsWith("sk-") || openaiApiKey.startsWith("sk-ant-")) {
    return NextResponse.json({
      error: "音声書き起こしには OpenAI のAPIキー(sk-...)が必要です。設定画面で OpenAI APIキーを登録してください。",
    }, { status: 400 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: "音声チャンクがありません" }, { status: 400 });
  }

  const transcripts: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = chunks[i];
      if (!existsSync(chunkPath)) {
        console.warn(`[whisper] chunk not found: ${chunkPath}`);
        continue;
      }

      const audioBuffer = readFileSync(chunkPath);
      console.log(`[whisper] chunk ${i + 1}/${chunks.length}: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
      formData.append("file", blob, basename(chunkPath));
      formData.append("model", "whisper-1");
      formData.append("language", language);
      formData.append("response_format", "text");

      // リトライ(最大3回・指数バックオフ)
      let text = "";
      let lastError = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          text = (await res.text()).trim();
          break;
        }

        const errText = await res.text();
        lastError = errText.slice(0, 200);
        console.error(`[whisper] chunk ${i + 1} attempt ${attempt + 1} failed:`, errText.slice(0, 200));

        if (res.status === 429 || res.status === 529 || res.status >= 500) {
          // 一時的エラー → リトライ
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        // 恒久エラー → 中断
        return NextResponse.json({
          error: `Whisper API エラー (chunk ${i + 1}): ${lastError}`,
        }, { status: res.status });
      }

      if (!text && lastError) {
        return NextResponse.json({
          error: `Whisper API エラー (chunk ${i + 1}, リトライ上限): ${lastError}`,
        }, { status: 500 });
      }

      transcripts.push(text);
      console.log(`[whisper] chunk ${i + 1}: ${text.length}文字`);
    }
  } finally {
    if (cleanupDir && existsSync(cleanupDir)) {
      try { rmSync(cleanupDir, { recursive: true, force: true }); }
      catch (e) { console.warn("[whisper] cleanup failed:", e); }
    }
  }

  const fullTranscript = transcripts.join("\n\n").trim();
  return NextResponse.json({
    text: fullTranscript,
    chunkCount: chunks.length,
    charCount: fullTranscript.length,
  });
}
