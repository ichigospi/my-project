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
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

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
  const errorItems = queue.filter((q) => q.status === "error");
  const doneItems = queue.filter((q) => q.status === "done");

  // 1本の動画を読み取り（skipSubtitle: 字幕APIをスキップしてOCR強制）
  const processOne = async (item: QueueItem, skipSubtitle = false) => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setProcessing(true);
    setCurrentVideo(item.videoTitle);
    setDebugLog([]);
    addLog(`処理開始: skipSubtitle=${skipSubtitle}, videoId=${item.videoId}`);
    setProgress(skipSubtitle ? "OCR強制モード：フレーム抽出中..." : "動画DL＆フレーム抽出中...");

    try {
      // Step 1: フレーム抽出（ローカルなのでCookie使える）
      addLog("extract-frames API呼び出し中...");
      const frameRes = await fetch("/api/youtube/extract-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: item.videoId, skipSubtitle }),
      });
      let frameData = await frameRes.json();
      addLog(`応答: method=${frameData.method || "none"}, transcript=${frameData.transcript?.length || 0}文字, frames=${frameData.frames?.length || 0}枚, error=${frameData.error || "none"}`);

      let transcript = "";

      const cleanedSub = frameData.transcript
        ? frameData.transcript.replace(/\[(?:music|音楽|拍手|笑|applause|laughter)\]/gim, "").replace(/\s+/g, " ").trim()
        : "";
      if (frameData.method === "subtitle" && cleanedSub.length >= 100) {
        transcript = cleanedSub;
        addLog(`字幕採用: ${cleanedSub.length}文字`);
        setProgress("字幕から取得完了");
      } else if (frameData.error) {
        throw new Error(frameData.error);
      } else {
        // 字幕が短すぎた場合はフレーム抽出をやり直す
        if (frameData.method === "subtitle" && (!frameData.frames || frameData.frames.length === 0)) {
          addLog("字幕短すぎ→skipSubtitleでリトライ");
          setProgress("字幕が短すぎるため、フレーム抽出でリトライ...");
          const retryRes = await fetch("/api/youtube/extract-frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: item.videoId, skipSubtitle: true }),
          });
          frameData = await retryRes.json();
          addLog(`リトライ応答: frames=${frameData.frames?.length || 0}枚, error=${frameData.error || "none"}`);
          if (frameData.error) throw new Error(frameData.error);
        }

        // Step 2: OCR
        const rawFrames = frameData.frames as string[];
        if (!rawFrames || rawFrames.length === 0) {
          throw new Error(`フレームが0枚です（method=${frameData.method || "none"}, frameCount=${frameData.frameCount || 0}）`);
        }
        addLog(`OCR開始: ${rawFrames.length}枚`);
        setProgress(`${rawFrames.length}枚のフレームをOCR処理中...`);
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
              addLog(`OCR batch${batchNum}: ${ocrData.text?.length || 0}文字`);
              break;
            } catch {
              if (retry < 4) await new Promise((r) => setTimeout(r, 10000));
            }
          }
          if (i + batchSize < frames.length) await new Promise((r) => setTimeout(r, 3000));
        }

        // Step 3: テキスト整理
        transcript = ocrTexts.join("\n\n");
        addLog(`OCR合計: ${transcript.length}文字`);
        if (transcript.length > 0) {
          setProgress("テキスト整理中...");
          try {
            const cleanRes = await fetch("/api/script/cleanup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawText: transcript, sampleImages: [], aiApiKey }),
            });
            const cleanData = await cleanRes.json();
            if (cleanData.text?.trim()) {
              const cleaned = cleanData.text.trim();
              addLog(`整理後: ${cleaned.length}文字（元: ${transcript.length}文字）`);
              // 整理後が元の20%未満に減った場合は、整理前のテキストを採用
              if (cleaned.length >= transcript.length * 0.2) {
                transcript = cleaned;
              } else {
                addLog(`整理で削りすぎ（${Math.round(cleaned.length/transcript.length*100)}%）→ 整理前テキストを採用`);
              }
            }
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

      setProgress(`完了！（${transcript.length}文字取得）`);
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

  // エラーや短すぎる動画をリトライ（字幕スキップしてOCR強制）
  const retryOne = async (item: QueueItem) => {
    await fetch("/api/ocr-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry", id: item.id }),
    });
    await fetchQueue();
    // 自動的にOCR強制モードで再処理開始
    await processOne({ ...item, status: "pending" }, true);
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

      {/* 処理ログ */}
      {debugLog.length > 0 && (
        <div className="bg-gray-900 text-green-400 rounded-lg p-3 mb-6 text-xs font-mono max-h-48 overflow-y-auto">
          {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}

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
            <div className="flex gap-1 shrink-0">
              <button onClick={() => processOne(item)} disabled={processing}
                className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
                読み取り
              </button>
              <button onClick={async () => {
                await fetch("/api/ocr-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id: item.id }) });
                await fetchQueue();
              }} disabled={processing}
                className="px-2 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                取消
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* エラー */}
      {errorItems.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3 text-red-600">エラー（{errorItems.length}件）</h2>
          <div className="space-y-2 mb-8">
            {errorItems.map((item) => (
              <div key={item.id} className="bg-red-50 rounded-lg p-4 border border-red-200 flex items-center gap-4">
                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.videoTitle}</p>
                  <p className="text-xs text-red-500">{item.error || "読み取り失敗"}</p>
                </div>
                <button onClick={() => retryOne(item)} disabled={processing}
                  className="px-3 py-1.5 rounded-lg text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 shrink-0">
                  リトライ
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 完了済み */}
      {doneItems.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3">読み取り完了（{doneItems.length}件）</h2>
          <div className="space-y-2">
            {doneItems.map((item) => {
              const tooShort = (item.transcript?.length || 0) < 100;
              return (
                <div key={item.id} className={`${tooShort ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-100"} rounded-lg p-4 border flex items-center gap-4`}>
                  <div className={`w-3 h-3 rounded-full shrink-0 ${tooShort ? "bg-yellow-500" : "bg-green-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.videoTitle}</p>
                    <p className={`text-xs ${tooShort ? "text-yellow-600" : "text-green-600"}`}>
                      {item.transcript?.length || 0}文字取得済み
                      {tooShort && " （少なすぎます）"}
                    </p>
                  </div>
                  {tooShort ? (
                    <button onClick={() => retryOne(item)} disabled={processing}
                      className="px-3 py-1.5 rounded-lg text-xs bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 shrink-0">
                      再読み取り
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 shrink-0">✓ 完了</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
