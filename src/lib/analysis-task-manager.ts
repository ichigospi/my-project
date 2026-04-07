// バックグラウンド分析タスクマネージャー（シングルトン）
// コンポーネント外に存在し、画面遷移しても分析が中断されない

import { saveAnalysis, generateId } from "@/lib/script-analysis-store";
import { saveHook, saveCTA, genId, type Genre, type Style } from "@/lib/project-store";

export interface AnalysisTask {
  id: string; // taskId（ユニーク）
  projectId?: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  views: number;
  genre: Genre;
  style: Style;
  status: "queued" | "extracting" | "ocr" | "cleanup" | "analyzing" | "done" | "error";
  progress: string;
  analysisId?: string;
}

type Listener = (tasks: AnalysisTask[]) => void;

function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

class AnalysisTaskManager {
  private queue: AnalysisTask[] = [];
  private running = false;
  private listeners = new Set<Listener>();

  getTasks(): AnalysisTask[] {
    return [...this.queue];
  }

  isRunning(): boolean {
    return this.running;
  }

  getActiveCount(): number {
    return this.queue.filter((t) => t.status !== "done" && t.status !== "error").length;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const tasks = this.getTasks();
    this.listeners.forEach((l) => l(tasks));
  }

  private updateTask(id: string, update: Partial<AnalysisTask>) {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.queue[idx] = { ...this.queue[idx], ...update };
      this.notify();
    }
  }

  addTasks(tasks: Omit<AnalysisTask, "id" | "status" | "progress">[]): string[] {
    const ids: string[] = [];
    for (const t of tasks) {
      // 同じvideoIdが既にキューにあってqueued/実行中ならスキップ
      const existing = this.queue.find(
        (q) => q.videoId === t.videoId && q.status !== "done" && q.status !== "error"
      );
      if (existing) { ids.push(existing.id); continue; }

      const id = generateId();
      this.queue.push({ ...t, id, status: "queued", progress: "キュー待ち" });
      ids.push(id);
    }
    this.notify();
    if (!this.running) this.processQueue();
    return ids;
  }

  retryTask(id: string) {
    const task = this.queue.find((t) => t.id === id);
    if (task) {
      task.status = "queued";
      task.progress = "リトライ待ち";
      this.notify();
      if (!this.running) this.processQueue();
    }
  }

  removeTask(id: string) {
    this.queue = this.queue.filter((t) => t.id !== id);
    this.notify();
  }

  clearDone() {
    this.queue = this.queue.filter((t) => t.status !== "done" && t.status !== "error");
    this.notify();
  }

  private async processQueue() {
    this.running = true;
    this.notify();

    while (true) {
      const next = this.queue.find((t) => t.status === "queued");
      if (!next) break;

      const aiApiKey = typeof window !== "undefined"
        ? localStorage.getItem("ai_api_key") || ""
        : "";
      if (!aiApiKey) {
        this.updateTask(next.id, { status: "error", progress: "AI APIキーが未設定" });
        continue;
      }

      await this.processOne(next, aiApiKey);
    }

    this.running = false;
    this.notify();
  }

  private async processOne(task: AnalysisTask, aiApiKey: string) {
    try {
      // Step 1: フレーム抽出
      this.updateTask(task.id, { status: "extracting", progress: "動画DL＆フレーム抽出中..." });
      const frameRes = await fetch("/api/youtube/extract-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: task.videoId }),
      });
      const frameData = await frameRes.json();
      if (frameData.error) {
        this.updateTask(task.id, { status: "error", progress: frameData.error });
        return;
      }

      // Step 2: OCR
      const rawFrames = frameData.frames as string[];
      const frames = await Promise.all(rawFrames.map((f: string) => compressImage(f)));
      const batchSize = 10;
      const totalBatches = Math.ceil(frames.length / batchSize);
      const ocrTexts: string[] = [];

      for (let i = 0; i < frames.length; i += batchSize) {
        const batch = frames.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        this.updateTask(task.id, { status: "ocr", progress: `OCR ${batchNum}/${totalBatches}` });

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
              this.updateTask(task.id, { progress: `OCR ${batchNum}/${totalBatches} API混雑中リトライ${retry + 1}/5` });
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
        this.updateTask(task.id, { status: "cleanup", progress: "テキスト整理中..." });
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

      // Step 4: 台本分析
      this.updateTask(task.id, { status: "analyzing", progress: "AI分析中..." });
      await new Promise((r) => setTimeout(r, 3000));
      let analysisData: Record<string, unknown> = {};
      for (let retry = 0; retry < 5; retry++) {
        const analyzeRes = await fetch("/api/script/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, videoTitle: task.title, channelName: task.channelName, views: task.views, aiApiKey }),
        });
        analysisData = await analyzeRes.json();
        if (analysisData.retryable) {
          const wait = 15000 * (retry + 1);
          this.updateTask(task.id, { progress: `AI分析中... API混雑リトライ${retry + 1}/5` });
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        break;
      }

      if (analysisData.error) {
        this.updateTask(task.id, { status: "error", progress: analysisData.error as string });
        return;
      }

      // 保存
      const analysisId = generateId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ad = analysisData as any;
      saveAnalysis({
        id: analysisId, videoId: task.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${task.videoId}`,
        videoTitle: task.title, channelName: task.channelName, thumbnailUrl: task.thumbnailUrl,
        views: task.views, transcript, analysisResult: ad,
        category: task.style === "healing" ? "healing" : task.style === "education" ? "education" : "other",
        tags: [], createdAt: new Date().toISOString(), score: ad.score,
      });

      if (ad.hooks) {
        for (const h of ad.hooks) {
          saveHook({ id: genId(), text: h, genre: task.genre, style: task.style, score: ad.score?.hookStrength || 7, sourceVideo: task.title, sourceChannel: task.channelName, tags: [], createdAt: new Date().toISOString() });
        }
      }
      if (ad.ctas) {
        for (const c of ad.ctas) {
          saveCTA({ id: genId(), text: c, genre: task.genre, style: task.style, score: ad.score?.ctaEffectiveness || 7, sourceVideo: task.title, sourceChannel: task.channelName, tags: [], createdAt: new Date().toISOString() });
        }
      }

      this.updateTask(task.id, { status: "done", progress: "完了", analysisId });
    } catch (e) {
      this.updateTask(task.id, { status: "error", progress: e instanceof Error ? e.message : "エラー" });
    }
  }
}

// シングルトン
let instance: AnalysisTaskManager | null = null;
export function getTaskManager(): AnalysisTaskManager {
  if (!instance) instance = new AnalysisTaskManager();
  return instance;
}
