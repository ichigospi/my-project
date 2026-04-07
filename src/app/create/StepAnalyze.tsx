"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getAnalyses, saveAnalysis, generateId } from "@/lib/script-analysis-store";
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
  status: "pending" | "extracting" | "ocr" | "cleanup" | "analyzing" | "done" | "error" | "skipped";
  progress: string;
  analysisId?: string;
  selected: boolean;
}

async function analyzeOneVideo(
  video: { videoId: string; title: string; channelName: string; thumbnailUrl: string; views: number },
  aiApiKey: string,
  project: ScriptProject,
  updateProgress: (videoId: string, update: Partial<AnalysisProgress>) => void,
): Promise<{ analysisId: string; analysisData: Record<string, unknown> } | null> {
  if (!video.videoId) {
    updateProgress(video.videoId, { status: "error", progress: "videoIdがありません。参考動画ページで実際の動画を選択してください。" });
    return null;
  }

  // Step 1: フレーム抽出
  updateProgress(video.videoId, { status: "extracting", progress: "動画DL＆フレーム抽出中..." });
  const frameRes = await fetch("/api/youtube/extract-frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId: video.videoId }),
  });
  const frameData = await frameRes.json();
  if (frameData.error) {
    updateProgress(video.videoId, { status: "error", progress: frameData.error });
    return null;
  }

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
  let analysisData: Record<string, unknown> = {};
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

  if (analysisData.error) {
    updateProgress(video.videoId, { status: "error", progress: analysisData.error as string });
    return null;
  }

  // 保存
  const analysisId = generateId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ad = analysisData as any;
  saveAnalysis({
    id: analysisId, videoId: video.videoId, videoUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    videoTitle: video.title, channelName: video.channelName, thumbnailUrl: video.thumbnailUrl,
    views: video.views, transcript, analysisResult: ad,
    category: project.style === "healing" ? "healing" : "education",
    tags: [], createdAt: new Date().toISOString(), score: ad.score,
  });

  // フック・CTA自動保存
  if (ad.hooks) {
    for (const h of ad.hooks) {
      saveHook({ id: genId(), text: h, genre: project.genre, style: project.style, score: ad.score?.hookStrength || 7, sourceVideo: video.title, sourceChannel: video.channelName, tags: [], createdAt: new Date().toISOString() });
    }
  }
  if (ad.ctas) {
    for (const c of ad.ctas) {
      saveCTA({ id: genId(), text: c, genre: project.genre, style: project.style, score: ad.score?.ctaEffectiveness || 7, sourceVideo: video.title, sourceChannel: video.channelName, tags: [], createdAt: new Date().toISOString() });
    }
  }

  updateProgress(video.videoId, { status: "done", progress: "完了", analysisId });
  return { analysisId, analysisData };
}

export default function StepAnalyze({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [progresses, setProgresses] = useState<AnalysisProgress[]>(() => {
    // 分析済みの動画を特定（analysisIdとvideoIdで紐付け）
    const existingAnalyses = getAnalyses();
    const analyzedVideoIds = new Set(
      existingAnalyses
        .filter((a) => project.analyses.includes(a.id))
        .map((a) => a.videoId)
    );

    return project.referenceVideos.map((v) => ({
      videoId: v.videoId, title: v.title,
      status: analyzedVideoIds.has(v.videoId) ? "done" as const : "pending" as const,
      progress: analyzedVideoIds.has(v.videoId) ? "分析済み" : "待機中",
      selected: !analyzedVideoIds.has(v.videoId),
    }));
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const allDone = progresses.some((p) => p.status === "done") && progresses.every((p) => p.status === "done" || p.status === "skipped" || p.status === "pending");
  const hasSelected = progresses.some((p) => p.selected);

  const updateProgress = (videoId: string, update: Partial<AnalysisProgress>) => {
    setProgresses((prev) => prev.map((p) => p.videoId === videoId ? { ...p, ...update } : p));
  };

  const toggleSelect = (videoId: string) => {
    setProgresses((prev) => prev.map((p) =>
      p.videoId === videoId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    setProgresses((prev) => prev.map((p) => ({ ...p, selected: true })));
  };

  const deselectAll = () => {
    setProgresses((prev) => prev.map((p) => ({ ...p, selected: false })));
  };

  // 選択した動画を分析
  const runAnalysis = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setRunning(true);
    setError("");
    const analysisIds: string[] = [...project.analyses];

    const targets = progresses.filter((p) => p.selected);
    for (const target of targets) {
      const video = project.referenceVideos.find((v) => v.videoId === target.videoId);
      if (!video) continue;

      try {
        const result = await analyzeOneVideo(video, aiApiKey, project, updateProgress);
        if (result) analysisIds.push(result.analysisId);
      } catch (e) {
        updateProgress(video.videoId, { status: "error", progress: e instanceof Error ? e.message : "エラー" });
      }
    }

    // 未選択のものはスキップ扱い
    setProgresses((prev) => prev.map((p) =>
      !p.selected && p.status === "pending" ? { ...p, status: "skipped", progress: "スキップ" } : p
    ));

    onUpdate({ ...project, analyses: analysisIds });
    setRunning(false);
  };

  // 個別リトライ
  const retryOne = async (videoId: string) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    const video = project.referenceVideos.find((v) => v.videoId === videoId);
    if (!video) return;

    setRunning(true);
    setError("");
    updateProgress(videoId, { status: "pending", progress: "リトライ中..." });

    try {
      const result = await analyzeOneVideo(video, aiApiKey, project, updateProgress);
      if (result) {
        const newIds = [...project.analyses, result.analysisId];
        onUpdate({ ...project, analyses: newIds });
      }
    } catch (e) {
      updateProgress(videoId, { status: "error", progress: e instanceof Error ? e.message : "エラー" });
    }

    setRunning(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">④ 参考動画の分析</h2>

      {!running && progresses.some((p) => p.status !== "done") && (
        <div className="flex gap-2 mb-3">
          <button onClick={selectAll} className="text-xs text-accent hover:underline">すべて選択</button>
          <button onClick={deselectAll} className="text-xs text-gray-400 hover:underline">選択解除</button>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {progresses.map((p, i) => (
          <div key={p.videoId || `prog-${i}`} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              {/* チェックボックス */}
              {!running && (
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={() => toggleSelect(p.videoId)}
                  className="w-4 h-4 rounded accent-accent shrink-0"
                />
              )}
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                p.status === "done" ? "bg-green-500" :
                p.status === "error" ? "bg-red-500" :
                p.status === "skipped" ? "bg-gray-300" :
                p.status === "pending" ? "bg-gray-300" :
                "bg-yellow-500 animate-pulse"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className={`text-xs mt-0.5 ${p.status === "error" ? "text-red-500" : "text-gray-500"}`}>{p.progress}</p>
              </div>
              {/* リトライボタン（エラー・完了問わず） */}
              {(p.status === "error" || p.status === "done") && !running && (
                <button onClick={() => retryOne(p.videoId)}
                  className={`px-3 py-1.5 rounded-lg text-xs shrink-0 ${
                    p.status === "error"
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}>
                  {p.status === "error" ? "リトライ" : "再分析"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "references" })}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {!allDone ? (
          <button onClick={runAnalysis} disabled={running || !hasSelected}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {running ? "分析中..." : `選択した動画を分析（${progresses.filter((p) => p.selected).length}件）`}
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
