"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { saveAnalysis, generateId, syncFromServer } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";

interface QueueItem {
  id: string;
  videoId: string;
  videoTitle: string;
  channelName: string;
  thumbnailUrl: string;
  views: number;
  status: "pending" | "processing" | "done" | "error";
  transcript?: string;
  error?: string;
}

function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width; let h = img.height;
      if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function OcrPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentVideo, setCurrentVideo] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ocr-queue");
      const data = await res.json();
      if (data.queue) setQueue(data.queue);
    } catch { setError("キューの取得に失敗"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, []);

  const pendingItems = queue.filter((q) => q.status === "pending");
  const doneItems = queue.filter((q) => q.status === "done");

  // 1本の動画を読み取り
  const processOne = async (item: QueueItem) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setProcessing(true);
    setCurrentVideo(item.videoTitle);
    setProgress("動画DL＆フレーム抽出中...");

    try {
      // Step 1: フレーム抽出（ローカルなのでCookie使える）
      const frameRes = await fetch("/api/youtube/extract-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: item.videoId }),
      });
      const frameData = await frameRes.json();

      let transcript = "";

      if (frameData.transcript && frameData.method === "subtitle") {
        transcript = frameData.transcript;
        setProgress("字幕から取得完了");
      } else if (frameData.error) {
        throw new Error(frameData.error);
      } else {
        // Step 2: OCR
        const rawFrames = frameData.frames as string[];
        const frames = await Promise.all(rawFrames.map((f: string) => compressImage(f)));
        const batchSize = 10;
        const totalBatches = Math.ceil(frames.length / batchSize);
        const ocrTexts: string[] = [];

        for (let i = 0; i < frames.length; i += batchSize) {
          const batch = frames.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          setProgress(`OCR ${batchNum}/${totalBatches}`);

          for (let retry = 0; retry < 5; retry++) {
            try {
              const ocrRes = await fetch("/api/script/ocr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: batch, aiApiKey }),
              });
              const ocrData = await ocrRes.json();
              if (ocrData.retryable) {
                setProgress(`OCR ${batchNum}/${totalBatches} リトライ${retry + 1}/5`);
                await new Promise((r) => setTimeout(r, 15000 * (retry + 1)));
                continue;
              }
              if (ocrData.text?.trim()) ocrTexts.push(ocrData.text.trim());
              break;
            } catch {
              if (retry < 4) await new Promise((r) => setTimeout(r, 10000));
            }
          }
          if (i + batchSize < frames.length) await new Promise((r) => setTimeout(r, 3000));
        }

        // Step 3: テキスト整理
        transcript = ocrTexts.join("\n\n");
        if (transcript.length > 0) {
          setProgress("テキスト整理中...");
          try {
            const cleanRes = await fetch("/api/script/cleanup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawText: transcript, sampleImages: [], aiApiKey }),
            });
            const cleanData = await cleanRes.json();
            if (cleanData.text?.trim()) transcript = cleanData.text.trim();
          } catch {}
        }
      }

      // ローカルの分析ライブラリにも保存
      saveAnalysis({
        id: generateId(), videoId: item.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
        videoTitle: item.videoTitle, channelName: item.channelName,
        thumbnailUrl: item.thumbnailUrl, views: item.views,
        transcript, analysisResult: null, category: "other",
        tags: [], createdAt: new Date().toISOString(),
      });

      // サーバーのキューを更新
      await fetch("/api/ocr-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", id: item.id, transcript }),
      });

      setProgress("完了！");
      fetchQueue();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "読み取り失敗";
      setError(errMsg);
      await fetch("/api/ocr-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "error", id: item.id, error: errMsg }),
      });
      fetchQueue();
    } finally {
      setProcessing(false);
      setCurrentVideo("");
    }
  };

  // 全件一括処理
  const processAll = async () => {
    for (const item of pendingItems) {
      await processOne(item);
    }
  };

  // Railwayに同期（分析ライブラリをDBにアップロード）
  const handleSync = async () => {
    setProgress("Railwayに同期中...");
    try {
      const { analyses } = await syncFromServer();
      setProgress(`同期完了（${analyses.length}件）`);
      setTimeout(() => setProgress(""), 3000);
    } catch {
      setError("同期に失敗");
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">台本読み取り</h1>
        <p className="text-gray-500 mt-1">Railwayから依頼された動画のテロップを読み取り</p>
      </div>

      {/* ステータス */}
      {processing && (
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium">{currentVideo}</p>
              <p className="text-xs text-yellow-700">{progress}</p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      {progress && !processing && <p className="text-green-600 text-sm mb-4">{progress}</p>}

      {/* アクションボタン */}
      <div className="flex gap-3 mb-6">
        <button onClick={fetchQueue} disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
          {loading ? "更新中..." : "キューを更新"}
        </button>
        {pendingItems.length > 0 && (
          <button onClick={processAll} disabled={processing}
            className="px-6 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {processing ? "処理中..." : `${pendingItems.length}本を一括読み取り`}
          </button>
        )}
        <button onClick={handleSync}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
          Railwayに同期
        </button>
      </div>

      {/* 読み取り待ち */}
      <h2 className="font-semibold text-sm mb-3">読み取り待ち（{pendingItems.length}件）</h2>
      {pendingItems.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm mb-6">
          <p>読み取り待ちの動画がありません</p>
          <p className="mt-1">Railwayの台本作成で動画を選択して「ローカルで読み取り」を押してください</p>
        </div>
      )}
      <div className="space-y-2 mb-8">
        {pendingItems.map((item) => (
          <div key={item.id} className="bg-card-bg rounded-lg p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.videoTitle}</p>
              <p className="text-xs text-gray-500">{item.channelName} · {formatNumber(item.views)}回</p>
            </div>
            <button onClick={() => processOne(item)} disabled={processing}
              className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90 disabled:opacity-50 shrink-0">
              読み取り
            </button>
          </div>
        ))}
      </div>

      {/* 完了済み */}
      {doneItems.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3">読み取り完了（{doneItems.length}件）</h2>
          <div className="space-y-2">
            {doneItems.map((item) => (
              <div key={item.id} className="bg-green-50 rounded-lg p-4 border border-green-100 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.videoTitle}</p>
                  <p className="text-xs text-green-600">{item.transcript?.length || 0}文字取得済み</p>
                </div>
                <span className="text-xs text-green-600 shrink-0">✓ 完了</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
