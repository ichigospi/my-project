"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { saveAnalysis, generateId } from "@/lib/script-analysis-store";
import { saveHook, saveCTA, genId } from "@/lib/project-store";
import type { ScriptProject } from "@/lib/project-store";

function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface AnalysisProgress {
  videoId: string;
  title: string;
  status: "pending" | "extracting" | "ocr" | "cleanup" | "analyzing" | "done" | "error";
  progress: string;
  analysisId?: string;
}

export default function StepAnalyze({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [progresses, setProgresses] = useState<AnalysisProgress[]>(
    project.referenceVideos.map((v) => ({
      videoId: v.videoId, title: v.title,
      status: project.analyses.length > 0 ? "done" : "pending",
      progress: project.analyses.length > 0 ? "分析済み" : "待機中",
    }))
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const allDone = progresses.every((p) => p.status === "done");

  const updateProgress = (videoId: string, update: Partial<AnalysisProgress>) => {
    setProgresses((prev) => prev.map((p) => p.videoId === videoId ? { ...p, ...update } : p));
  };

  const runAnalysis = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setRunning(true);
    setError("");
    const analysisIds: string[] = [];

    for (const video of project.referenceVideos) {
      if (!video.videoId) {
        updateProgress(video.videoId, { status: "error", progress: "videoIdがありません。参考動画ページで実際の動画を選択してください。" });
        continue;
      }
      try {
        // Step 1: フレーム抽出
        updateProgress(video.videoId, { status: "extracting", progress: "動画DL＆フレーム抽出中..." });
        const frameRes = await fetch("/api/youtube/extract-frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.videoId }),
        });
        const frameData = await frameRes.json();
        if (frameData.error) { updateProgress(video.videoId, { status: "error", progress: frameData.error }); continue; }

        // Step 2: OCR（10枚ずつ、圧縮して送信、Overloadedリトライ付き）
        const rawFrames = frameData.frames as string[];
        const frames = await Promise.all(rawFrames.map((f: string) => compressImage(f)));
        const batchSize = 10;
        const totalBatches = Math.ceil(frames.length / batchSize);
        const ocrTexts: string[] = [];

        for (let i = 0; i < frames.length; i += batchSize) {
          const batch = frames.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          updateProgress(video.videoId, { status: "ocr", progress: `OCR ${batchNum}/${totalBatches}` });

          for (let retry = 0; retry < 5; retry++) {
            try {
              const ocrRes = await fetch("/api/script/ocr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: batch, aiApiKey }),
              });
              const ocrData = await ocrRes.json();
              if (ocrData.retryable) {
                const wait = 15000 * (retry + 1);
                updateProgress(video.videoId, { status: "ocr", progress: `OCR ${batchNum}/${totalBatches} API混雑中リトライ${retry+1}/5` });
                await new Promise((r) => setTimeout(r, wait));
                continue;
              }
              if (ocrData.text?.trim()) ocrTexts.push(ocrData.text.trim());
              break;
            } catch {
              if (retry < 4) await new Promise((r) => setTimeout(r, 10000));
            }
          }
          if (i + batchSize < frames.length) {
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // Step 3: テキスト整理
        let transcript = ocrTexts.join("\n\n");
        if (transcript.length > 0) {
          updateProgress(video.videoId, { status: "cleanup", progress: "テキスト整理中..." });
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const cleanRes = await fetch("/api/script/cleanup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawText: transcript, sampleImages: [], aiApiKey }),
            });
            const cleanData = await cleanRes.json();
            if (cleanData.text?.trim()) transcript = cleanData.text.trim();
          } catch { /* use raw */ }
        }

        // Step 4: 台本分析（リトライ付き）
        updateProgress(video.videoId, { status: "analyzing", progress: "AI分析中..." });
        await new Promise((r) => setTimeout(r, 5000));
        let analysisData;
        for (let retry = 0; retry < 5; retry++) {
          const analyzeRes = await fetch("/api/script/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript, videoTitle: video.title, channelName: video.channelName, views: video.views, aiApiKey }),
          });
          analysisData = await analyzeRes.json();
          if (analysisData.retryable) {
            const wait = 15000 * (retry + 1);
            updateProgress(video.videoId, { status: "analyzing", progress: `AI分析中... API混雑リトライ${retry+1}/5` });
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }
          break;
        }

        if (analysisData.error) { updateProgress(video.videoId, { status: "error", progress: analysisData.error }); continue; }

        // 保存
        const analysisId = generateId();
        saveAnalysis({
          id: analysisId, videoId: video.videoId, videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
          videoTitle: video.title, channelName: video.channelName, thumbnailUrl: video.thumbnailUrl,
          views: video.views, transcript, analysisResult: analysisData,
          category: project.style === "healing" ? "healing" : "education",
          tags: [], createdAt: new Date().toISOString(), score: analysisData.score,
        });
        analysisIds.push(analysisId);

        // フック・CTA自動保存
        if (analysisData.hooks) {
          for (const h of analysisData.hooks) {
            saveHook({ id: genId(), text: h, genre: project.genre, style: project.style, score: analysisData.score?.hookStrength || 7, sourceVideo: video.title, sourceChannel: video.channelName, tags: [], createdAt: new Date().toISOString() });
          }
        }
        if (analysisData.ctas) {
          for (const c of analysisData.ctas) {
            saveCTA({ id: genId(), text: c, genre: project.genre, style: project.style, score: analysisData.score?.ctaEffectiveness || 7, sourceVideo: video.title, sourceChannel: video.channelName, tags: [], createdAt: new Date().toISOString() });
          }
        }

        updateProgress(video.videoId, { status: "done", progress: "完了", analysisId });
      } catch (e) {
        updateProgress(video.videoId, { status: "error", progress: e instanceof Error ? e.message : "エラー" });
      }
    }

    onUpdate({ ...project, analyses: analysisIds });
    setRunning(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">④ 参考動画の分析</h2>

      <div className="space-y-3 mb-6">
        {progresses.map((p, i) => (
          <div key={p.videoId || `prog-${i}`} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                p.status === "done" ? "bg-green-500" : p.status === "error" ? "bg-red-500" : p.status === "pending" ? "bg-gray-300" : "bg-yellow-500 animate-pulse"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className={`text-xs mt-0.5 ${p.status === "error" ? "text-red-500" : "text-gray-500"}`}>{p.progress}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "references" })}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {!allDone ? (
          <button onClick={runAnalysis} disabled={running}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {running ? "分析中..." : "分析を開始"}
          </button>
        ) : (
          <button onClick={() => onUpdate({ ...project, status: "proposal" })}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90">
            構成提案へ →
          </button>
        )}
      </div>
    </div>
  );
}
