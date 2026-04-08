"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getAnalyses } from "@/lib/script-analysis-store";
import type { ScriptProject } from "@/lib/project-store";
import { getTaskManager, type AnalysisTask } from "@/lib/analysis-task-manager";

interface VideoProgress {
  videoId: string;
  title: string;
  status: AnalysisTask["status"] | "pending" | "skipped";
  progress: string;
  selected: boolean;
  taskId?: string;
  analysisId?: string;
}

export default function StepAnalyze({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const mgr = getTaskManager();

  const buildProgresses = useCallback((): VideoProgress[] => {
    const existingAnalyses = getAnalyses();
    const analyzedVideoIds = new Set(
      existingAnalyses
        .filter((a) => project.analyses.includes(a.id))
        .map((a) => a.videoId)
    );
    const tasks = mgr.getTasks();

    return project.referenceVideos.map((v) => {
      // キューにあるか
      const task = tasks.find((t) => t.videoId === v.videoId && t.projectId === project.id);
      if (task) {
        return {
          videoId: v.videoId, title: v.title,
          status: task.status, progress: task.progress,
          selected: false, taskId: task.id, analysisId: task.analysisId,
        };
      }
      // 分析済みか
      if (analyzedVideoIds.has(v.videoId)) {
        return {
          videoId: v.videoId, title: v.title,
          status: "done" as const, progress: "分析済み",
          selected: false,
        };
      }
      return {
        videoId: v.videoId, title: v.title,
        status: "pending" as const, progress: "待機中",
        selected: true,
      };
    });
  }, [project, mgr]);

  const [progresses, setProgresses] = useState<VideoProgress[]>(buildProgresses);
  const [error, setError] = useState("");

  // taskManagerの更新をリッスン
  useEffect(() => {
    const unsubscribe = mgr.subscribe((tasks) => {
      setProgresses((prev) => prev.map((p) => {
        const task = tasks.find((t) => t.videoId === p.videoId && t.id === p.taskId);
        if (task) {
          return { ...p, status: task.status, progress: task.progress, analysisId: task.analysisId };
        }
        return p;
      }));

      // 完了したタスクのanalysisIdをprojectに追加
      const doneIds = tasks
        .filter((t) => t.status === "done" && t.analysisId && t.projectId === project.id)
        .map((t) => t.analysisId!);
      if (doneIds.length > 0) {
        const newAnalyses = [...new Set([...project.analyses, ...doneIds])];
        if (newAnalyses.length !== project.analyses.length) {
          onUpdate({ ...project, analyses: newAnalyses });
        }
      }
    });
    return unsubscribe;
  }, [mgr, project, onUpdate]);

  // 初期状態を再計算（ページに戻ってきた時）
  useEffect(() => {
    setProgresses(buildProgresses());
  }, [buildProgresses]);

  // OCRキューをポーリングしてローカル読み取り完了を自動検知
  useEffect(() => {
    const pollOcrQueue = async () => {
      try {
        const res = await fetch("/api/ocr-queue");
        const data = await res.json();
        if (!data.queue) return;

        const completedItems = (data.queue as { id: string; videoId: string; status: string; transcript?: string; videoTitle?: string; channelName?: string; thumbnailUrl?: string; views?: number }[])
          .filter((q) => q.status === "done" && q.transcript);
        if (completedItems.length === 0) return;

        const videoIds = new Set(project.referenceVideos.map((v) => v.videoId));
        const relevantDone = completedItems.filter((q) => videoIds.has(q.videoId));

        if (relevantDone.length > 0) {
          const { saveAnalysis, generateId, getAnalyses } = await import("@/lib/script-analysis-store");
          let existingAnalyses = getAnalyses();
          let updated = false;

          for (const item of relevantDone) {
            // 既存の分析を探す
            const existing = existingAnalyses.find((a) => a.videoId === item.videoId);

            let analysisId: string;
            if (existing && existing.transcript && existing.transcript.length >= 100) {
              // 十分な分析がある → 新規保存はスキップだがプロジェクトには紐づける
              analysisId = existing.id;
            } else {
              // 新規保存 or 上書き
              analysisId = existing?.id || generateId();
              saveAnalysis({
                id: analysisId,
                videoId: item.videoId,
                videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
                videoTitle: item.videoTitle || "",
                channelName: item.channelName || "",
                thumbnailUrl: item.thumbnailUrl || "",
                views: item.views || 0,
                transcript: item.transcript || "",
                analysisResult: existing?.analysisResult || null,
                category: "other",
                tags: [],
                createdAt: existing?.createdAt || new Date().toISOString(),
              });
              existingAnalyses = getAnalyses();
            }

            // プロジェクトに紐づけ
            if (!project.analyses.includes(analysisId)) {
              onUpdate({ ...project, analyses: [...project.analyses, analysisId] });
              updated = true;
            }
          }
          if (updated) setProgresses(buildProgresses());
        }
      } catch { /* ignore */ }
    };

    pollOcrQueue();
    const interval = setInterval(pollOcrQueue, 15000);
    return () => clearInterval(interval);
  }, [project, onUpdate, buildProgresses]);

  const isRunning = mgr.isRunning();

  const toggleSelect = (videoId: string) => {
    setProgresses((prev) => prev.map((p) =>
      p.videoId === videoId ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => setProgresses((prev) => prev.map((p) => ({ ...p, selected: true })));
  const deselectAll = () => setProgresses((prev) => prev.map((p) => ({ ...p, selected: false })));

  const runAnalysis = () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    setError("");

    const selected = progresses.filter((p) => p.selected);
    const taskInputs = selected.map((p) => {
      const video = project.referenceVideos.find((v) => v.videoId === p.videoId)!;
      return {
        projectId: project.id,
        videoId: video.videoId,
        title: video.title,
        channelName: video.channelName,
        thumbnailUrl: video.thumbnailUrl,
        views: video.views,
        genre: project.genre,
        style: project.style,
      };
    });

    const taskIds = mgr.addTasks(taskInputs);

    // taskIdを紐付け
    setProgresses((prev) => {
      let idx = 0;
      return prev.map((p) => {
        if (p.selected) {
          return { ...p, selected: false, taskId: taskIds[idx++], status: "queued" as const, progress: "キュー待ち" };
        }
        return p;
      });
    });
  };

  const retryOne = (videoId: string) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    const p = progresses.find((p) => p.videoId === videoId);
    if (p?.taskId) {
      mgr.retryTask(p.taskId);
    } else {
      const video = project.referenceVideos.find((v) => v.videoId === videoId)!;
      const [taskId] = mgr.addTasks([{
        projectId: project.id, videoId: video.videoId, title: video.title,
        channelName: video.channelName, thumbnailUrl: video.thumbnailUrl,
        views: video.views, genre: project.genre, style: project.style,
      }]);
      setProgresses((prev) => prev.map((pp) =>
        pp.videoId === videoId ? { ...pp, taskId, status: "queued" as const, progress: "キュー待ち" } : pp
      ));
    }
  };

  const [sentToLocal, setSentToLocal] = useState<Set<string>>(new Set());

  const sendToLocalQueue = async (videoId: string) => {
    const video = project.referenceVideos.find((v) => v.videoId === videoId);
    if (!video) return;
    await fetch("/api/ocr-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", videoId: video.videoId, videoTitle: video.title, channelName: video.channelName, thumbnailUrl: video.thumbnailUrl, views: video.views }),
    });
    setSentToLocal((prev) => new Set(prev).add(videoId));
  };

  const sendAllToLocal = async () => {
    for (const p of progresses) {
      if (p.status !== "done") await sendToLocalQueue(p.videoId);
    }
  };

  const hasSelected = progresses.some((p) => p.selected);
  const hasDone = progresses.some((p) => p.status === "done");
  const hasActiveTask = progresses.some((p) =>
    p.status === "queued" || p.status === "extracting" || p.status === "ocr" || p.status === "cleanup" || p.status === "analyzing"
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">④ 参考動画の分析</h2>

      {!hasActiveTask && (
        <div className="flex gap-2 mb-3">
          <button onClick={selectAll} className="text-xs text-accent hover:underline">すべて選択</button>
          <button onClick={deselectAll} className="text-xs text-gray-400 hover:underline">選択解除</button>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {progresses.map((p, i) => (
          <div key={p.videoId || `prog-${i}`} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              {!hasActiveTask && (
                <input type="checkbox" checked={p.selected} onChange={() => toggleSelect(p.videoId)}
                  className="w-4 h-4 rounded accent-accent shrink-0" />
              )}
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                p.status === "done" ? "bg-green-500" :
                p.status === "error" ? "bg-red-500" :
                p.status === "pending" || p.status === "queued" ? "bg-gray-300" :
                "bg-yellow-500 animate-pulse"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className={`text-xs mt-0.5 ${p.status === "error" ? "text-red-500" : "text-gray-500"}`}>{p.progress}</p>
              </div>
              {!hasActiveTask && (
                <div className="flex gap-1 shrink-0">
                  {(p.status === "error" || p.status === "done") && (
                    <button onClick={() => retryOne(p.videoId)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${
                        p.status === "error" ? "bg-accent text-white hover:bg-accent/90" : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}>
                      {p.status === "error" ? "リトライ" : "再分析"}
                    </button>
                  )}
                  {p.status !== "done" && (
                    <button onClick={() => sendToLocalQueue(p.videoId)} disabled={sentToLocal.has(p.videoId)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${sentToLocal.has(p.videoId) ? "bg-blue-50 text-blue-400" : "border border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                      {sentToLocal.has(p.videoId) ? "送信済み" : "ローカルで読み取り"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* ローカル連携 */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">ローカルで読み取り</p>
            <p className="text-xs text-blue-600 mt-0.5">動画をローカルPCに送信してテロップ読み取りを行います</p>
          </div>
          <div className="flex gap-2">
            <button onClick={sendAllToLocal}
              className="px-4 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700">
              全てローカルに送信
            </button>
            <a href="http://localhost:3000/ocr" target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs border border-blue-300 text-blue-600 hover:bg-blue-100">
              ローカルツールを開く ↗
            </a>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "references" })}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {hasSelected && (
          <button onClick={runAnalysis} disabled={hasActiveTask}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {`選択した動画を分析（${progresses.filter((p) => p.selected).length}件）`}
          </button>
        )}
        {hasDone && (
          <button onClick={() => onUpdate({ ...project, status: "proposal" })}
            className="px-6 py-3 rounded-lg bg-accent/80 text-white font-medium hover:bg-accent/90">
            構成提案へ →
          </button>
        )}
      </div>
    </div>
  );
}
