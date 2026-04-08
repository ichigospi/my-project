"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getApiKey } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";
import {
  getAnalyses, saveAnalysis, deleteAnalysis,
  getProposals, saveProposal, deleteProposal,
  getProfile, saveProfile, generateId, syncFromServer,
} from "@/lib/script-analysis-store";
import type {
  ScriptAnalysis, AnalysisResult, AnalysisScore,
  ScriptProposal, ProposalResult, ChannelProfile,
} from "@/lib/script-analysis-store";

// ===== 画像圧縮ヘルパー =====
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

// ===== 状態永続化ヘルパー =====
const STORAGE_PREFIX = "analysis_page_";

function usePersisted<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = STORAGE_PREFIX + key;
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // クライアント側でマウント後にsessionStorageから復元
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setValue(JSON.parse(saved));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  // 値が変わったらsessionStorageに保存（初回復元後のみ）
  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* ignore */ }
  }, [storageKey, value, hydrated]);

  const reset = useCallback(() => {
    setValue(initial);
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [initial, storageKey]);

  return [value, setValue, reset];
}

// ===== タブ切り替え =====
type Tab = "profile" | "analyze" | "library" | "propose";

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">読み込み中...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}

function AnalysisContent() {
  const [tab, setTab] = usePersisted<Tab>("tab", "analyze");
  const searchParams = useSearchParams();
  const videoFromQuery = searchParams.get("video") || "";
  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "自チャンネル設計" },
    { id: "analyze", label: "台本分析" },
    { id: "library", label: "分析ライブラリ" },
    { id: "propose", label: "構成提案・台本作成" },
  ];

  // サイドバーから直接アクセス、または動画URLパラメータがある場合は「台本分析」タブを表示
  useEffect(() => {
    if (typeof window !== "undefined" && (!window.location.search || videoFromQuery)) {
      setTab("analyze");
    }
  }, [videoFromQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">台本分析</h1>
        <p className="text-gray-500 mt-1">競合動画の分析 → 構成提案 → 台本作成</p>
      </div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab />}
      {tab === "analyze" && <AnalyzeTab videoFromQuery={videoFromQuery} />}
      {tab === "library" && <LibraryTab />}
      {tab === "propose" && <ProposeTab />}
    </div>
  );
}

// ===== 自チャンネル設計タブ =====
function ProfileTab() {
  const [profile, setProfile] = useState<ChannelProfile>(getProfile());
  const [saved, setSaved] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");

  useEffect(() => { setProfile(getProfile()); }, []);

  const handleSave = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addGenre = () => {
    if (genreInput.trim() && !profile.genres.includes(genreInput.trim())) {
      setProfile({ ...profile, genres: [...profile.genres, genreInput.trim()] });
      setGenreInput("");
    }
  };

  const removeGenre = (g: string) => {
    setProfile({ ...profile, genres: profile.genres.filter((x) => x !== g) });
  };

  const handleSuggest = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    const aiApiKey = getApiKey("ai_api_key");
    if (!ytApiKey) { setSuggestError("YouTube APIキーを設定してください"); return; }
    if (!aiApiKey) { setSuggestError("AI APIキーを設定してください"); return; }

    // URLからhandle or channelIdを抽出
    const handleMatch = channelUrl.match(/@([\w.-]+)/);
    const channelIdMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
    const handle = handleMatch?.[1];
    const channelId = channelIdMatch?.[1];
    if (!handle && !channelId) { setSuggestError("正しいYouTubeチャンネルURLを入力してください"); return; }

    setSuggesting(true);
    setSuggestError("");

    try {
      // 1. チャンネル情報取得
      const params = new URLSearchParams({ apiKey: ytApiKey });
      if (handle) params.set("handle", handle);
      else if (channelId) params.set("channelId", channelId);

      const chRes = await fetch(`/api/youtube/channel-info?${params}`);
      const chData = await chRes.json();
      if (chData.error) { setSuggestError(chData.error); setSuggesting(false); return; }

      // 2. 最近の動画タイトル取得
      let recentTitles: string[] = [];
      if (chData.channelId) {
        const vidRes = await fetch(`/api/youtube/videos?channelId=${chData.channelId}&apiKey=${encodeURIComponent(ytApiKey)}&maxResults=15`);
        const vidData = await vidRes.json();
        recentTitles = (vidData.videos || []).map((v: { title: string }) => v.title);
      }

      // 3. AIでプロフィール提案
      const suggestRes = await fetch("/api/channel/suggest-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelData: chData,
          recentVideoTitles: recentTitles,
          aiApiKey,
        }),
      });
      const suggestion = await suggestRes.json();
      if (suggestion.error) { setSuggestError(suggestion.error); setSuggesting(false); return; }

      // プロフィールに反映
      setProfile({
        ...profile,
        channelName: suggestion.channelName || chData.name || "",
        concept: suggestion.concept || "",
        tone: suggestion.tone || "",
        target: suggestion.target || "",
        genres: suggestion.genres || [],
        mainStyle: (suggestion.mainStyle === "healing" || suggestion.mainStyle === "education" || suggestion.mainStyle === "both") ? suggestion.mainStyle : "healing",
        characteristics: suggestion.characteristics || "",
      });
    } catch { setSuggestError("プロフィール提案に失敗しました"); }
    finally { setSuggesting(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* URL入力でAI提案 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-accent/20">
        <h2 className="font-semibold mb-2">チャンネルURLから自動設計</h2>
        <p className="text-sm text-gray-500 mb-3">
          自分のチャンネルURLを入力すると、AIがチャンネル内容を分析して設計を提案します。
        </p>
        <div className="flex gap-3">
          <input type="text" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="https://youtube.com/@your-channel"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          <button onClick={handleSuggest} disabled={suggesting}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0">
            {suggesting ? "分析中..." : "AIで自動設計"}
          </button>
        </div>
        {suggestError && <p className="text-danger text-sm mt-2">{suggestError}</p>}
      </div>

      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 mb-4">
          台本生成時に自チャンネルの設計が自動反映されます。AIの提案を修正して保存してください。
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">チャンネル名</label>
            <input type="text" value={profile.channelName} onChange={(e) => setProfile({ ...profile, channelName: e.target.value })}
              placeholder="例: 癒しのスピリチュアルチャンネル" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">チャンネルコンセプト</label>
            <textarea value={profile.concept} onChange={(e) => setProfile({ ...profile, concept: e.target.value })}
              placeholder="例: 忙しい毎日を送るあなたに、短い時間でも深い癒しと気づきを届けるチャンネル"
              rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">口調・話し方の特徴</label>
            <textarea value={profile.tone} onChange={(e) => setProfile({ ...profile, tone: e.target.value })}
              placeholder="例: 優しく穏やかな語り口、〜ですね、〜していきましょう、という語尾を多用"
              rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ターゲット層</label>
            <input type="text" value={profile.target} onChange={(e) => setProfile({ ...profile, target: e.target.value })}
              placeholder="例: 30-50代女性、スピリチュアルに興味があるが初心者寄り"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メインスタイル</label>
            <div className="flex gap-3">
              {([["healing", "ヒーリング系メイン"], ["education", "教育系メイン"], ["both", "両方バランス"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setProfile({ ...profile, mainStyle: val })}
                  className={`px-4 py-2 rounded-lg text-sm ${profile.mainStyle === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">得意ジャンル</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={genreInput} onChange={(e) => setGenreInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGenre()}
                placeholder="ジャンルを入力してEnter" className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
              <button onClick={addGenre} className="px-4 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.genres.map((g) => (
                <span key={g} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm">
                  {g}
                  <button onClick={() => removeGenre(g)} className="text-accent/50 hover:text-accent">&times;</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">その他の特徴・こだわり</label>
            <textarea value={profile.characteristics} onChange={(e) => setProfile({ ...profile, characteristics: e.target.value })}
              placeholder="例: BGMは432Hzのヒーリング音楽、冒頭30秒で必ず視聴者の悩みに共感する"
              rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
        </div>
        <button onClick={handleSave} className="mt-4 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
          {saved ? "保存しました！" : "設計を保存"}
        </button>
      </div>
    </div>
  );
}

// ===== 台本分析タブ =====
function AnalyzeTab({ videoFromQuery }: { videoFromQuery?: string }) {
  const [videoUrl, setVideoUrl, resetVideoUrl] = usePersisted("videoUrl", "");

  // クエリパラメータまたはsessionStorageから動画URLを読み込み
  useEffect(() => {
    if (videoFromQuery) {
      setVideoUrl(videoFromQuery);
      // URLパラメータをクリアして再読み込み防止
      window.history.replaceState({}, "", "/analysis");
    } else if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("analysis_video_url");
      if (saved) {
        setVideoUrl(saved);
        sessionStorage.removeItem("analysis_video_url");
      }
    }
  }, [videoFromQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  const [transcript, setTranscript, resetTranscript] = usePersisted("transcript", "");
  const [videoInfo, setVideoInfo, resetVideoInfo] = usePersisted<{ title: string; channelTitle: string; views: number; thumbnailUrl: string } | null>("videoInfo", null);
  const [analysis, setAnalysis, resetAnalysis] = usePersisted<(AnalysisResult & { score?: AnalysisScore }) | null>("analysis", null);
  const [category, setCategory, resetCategory] = usePersisted<"healing" | "education" | "other">("category", "healing");

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  // 画面読み取り関連（スクリーンショットは大きいのでsessionStorageに入れない）
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");

  const handleReset = () => {
    resetVideoUrl(); resetTranscript(); resetVideoInfo(); resetAnalysis(); resetCategory();
    setScreenshots([]); setError(""); setOcrProgress("");
  };

  // テキスト整理（画像と照合して抜け補完・誤読修正）
  const [cleaning, setCleaning] = useState(false);
  const [cleanProgress, setCleanProgress] = useState("");

  const cleanupText = async () => {
    if (!transcript.trim()) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setCleaning(true);
    setCleanProgress("AIで補正中（サンプル画像と照合）...");
    setError("");

    try {
      // サンプル画像を均等に10枚選ぶ
      let sampleImages: string[] = [];
      if (screenshots.length > 0) {
        const step = Math.max(1, Math.floor(screenshots.length / 10));
        sampleImages = screenshots.filter((_, i) => i % step === 0).slice(0, 10);
      }

      const res = await fetch("/api/script/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: transcript, sampleImages, aiApiKey }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.text) { setTranscript(data.text); }
    } catch { setError("テキスト整理に失敗"); }
    finally {
      setCleanProgress("");
      setCleaning(false);
    }
  };

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const fetchVideoInfo = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { setError("YouTube URLが正しくありません"); return; }
    const apiKey = getApiKey("yt_api_key");

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ videoId });
      if (apiKey) params.set("apiKey", apiKey);
      const res = await fetch(`/api/youtube/transcript?${params}`);
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setVideoInfo(data);
        // 字幕がある場合でも[music]だらけなら無視
        if (data.transcript && !data.transcript.match(/\[music\]/gi)) {
          setTranscript(data.transcript);
        }
      }
    } catch { setError("動画情報の取得に失敗"); }
    finally { setLoading(false); }
  };

  // 自動フレーム抽出 → 全フレームClaude Vision → 最終整理
  const autoExtractFrames = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { setError("先に動画URLを入力してください"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setExtracting(true);
    setOcrProgress("動画をダウンロード＆フレーム抽出中...");
    setError("");

    try {
      // Step 1: 3秒間隔でフレーム抽出（重複除去なし）
      const res = await fetch("/api/youtube/extract-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();

      if (data.error) {
        if (data.error.includes("yt-dlp") || data.error.includes("ffmpeg")) {
          setError("この環境では自動読み取りが利用できません。下のスクリーンショット貼り付けで読み取ってください。動画を再生しながらスクリーンショットを撮って貼り付けると、AIがテキストを読み取ります。");
        } else {
          setError(data.error);
        }
        setExtracting(false);
        return;
      }

      const rawFrames = data.frames as string[];
      // フレームを圧縮してサイズ削減
      const frames = await Promise.all(rawFrames.map((f: string) => compressImage(f)));
      setScreenshots(frames);

      // Step 2: 10枚ずつClaude Visionに送信（クライアント側Overloadedリトライ付き）
      const batchSize = 10;
      const totalBatches = Math.ceil(frames.length / batchSize);
      const allTexts: string[] = [];
      let failCount = 0;

      for (let i = 0; i < frames.length; i += batchSize) {
        const batch = frames.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const charCount = allTexts.join("").length;
        setOcrProgress(`OCR ${batchNum}/${totalBatches}回目 | ${charCount}文字取得済 | 失敗${failCount}`);

        let success = false;
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
              setOcrProgress(`OCR ${batchNum}/${totalBatches}回目 | API混雑中、${Math.round(wait/1000)}秒後にリトライ ${retry+1}/5`);
              await new Promise((resolve) => setTimeout(resolve, wait));
              continue;
            }
            if (ocrData.text && ocrData.text.trim()) {
              allTexts.push(ocrData.text.trim());
              setTranscript(allTexts.join("\n\n"));
            } else if (ocrData.error) {
              failCount++;
              setError(`バッチ${batchNum}: ${ocrData.error}`);
            }
            success = true;
            break;
          } catch (e) {
            if (retry < 4) {
              await new Promise((resolve) => setTimeout(resolve, 10000));
            } else {
              failCount++;
              setError(`バッチ${batchNum}: ${e instanceof Error ? e.message : "通信エラー"}`);
            }
          }
        }
        if (!success) failCount++;
        // バッチ間の小休止
        if (i + batchSize < frames.length) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      // Step 3: 最終整理パス（重複除去＆テキスト整理）
      const rawText = allTexts.join("\n\n");
      if (rawText.length > 0) {
        setOcrProgress("最終整理中（重複除去＆テキスト整理）...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        try {
          const cleanRes = await fetch("/api/script/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText, sampleImages: [], aiApiKey }),
          });
          const cleanData = await cleanRes.json();
          if (cleanData.text && cleanData.text.trim()) {
            setTranscript(cleanData.text.trim());
          }
        } catch {
          // 整理失敗しても生テキストは残っている
        }
      }

      const finalLen = transcript.length || rawText.length;
      setOcrProgress(`完了！ ${frames.length}枚 → ${finalLen}文字（失敗${failCount}）`);
      setExtracting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("yt-dlp") || msg.includes("ffmpeg")) {
        setError("自動読み取りはこの環境では利用できません。下のスクリーンショット貼り付けで読み取ってください。");
      } else {
        setError("フレーム抽出に失敗しました。スクリーンショット貼り付けをお試しください。");
      }
      setExtracting(false);
    }
  };

  // スクリーンショットのアップロード/ペースト
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(Array.from(files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFiles(Array.from(files));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl);
      setScreenshots((prev) => [...prev, compressed]);
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  // スクリーンショットからClaude Vision OCR
  const runOCR = async () => {
    if (screenshots.length === 0) { setError("画像がありません"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setExtracting(true);
    setError("");
    const batchSize = 10;
    const allTexts: string[] = [];
    const totalBatches = Math.ceil(screenshots.length / batchSize);

    for (let i = 0; i < screenshots.length; i += batchSize) {
      const batch = screenshots.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      setOcrProgress(`読み取り中... ${batchNum}/${totalBatches}`);

      // クライアント側リトライ（Overloaded対応）
      let success = false;
      for (let retry = 0; retry < 5; retry++) {
        try {
          const res = await fetch("/api/script/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: batch, aiApiKey }),
          });
          const data = await res.json();
          if (data.retryable) {
            const wait = 15000 * (retry + 1);
            setOcrProgress(`読み取り中... ${batchNum}/${totalBatches}（API混雑中、${Math.round(wait/1000)}秒後にリトライ ${retry+1}/5）`);
            await new Promise((resolve) => setTimeout(resolve, wait));
            continue;
          }
          if (data.text?.trim()) {
            allTexts.push(data.text.trim());
          } else if (data.error) {
            setError(`バッチ${batchNum}: ${data.error}`);
          }
          success = true;
          break;
        } catch {
          if (retry < 4) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
      }
      if (!success) setError(`バッチ${batchNum}: リトライ上限`);
      // バッチ間の小休止
      if (i + batchSize < screenshots.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    setTranscript(allTexts.join("\n\n"));
    setOcrProgress(`完了（${allTexts.join("").length}文字）`);
    setExtracting(false);
  };

  const runAnalysis = async () => {
    if (!transcript.trim()) { setError("台本テキストを入力してください"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setAnalyzing(true);
    setError("");
    try {
      let data;
      for (let retry = 0; retry < 5; retry++) {
        const res = await fetch("/api/script/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            videoTitle: videoInfo?.title || "",
            channelName: videoInfo?.channelTitle || "",
            views: videoInfo?.views || 0,
            aiApiKey,
          }),
        });
        data = await res.json();
        if (data.retryable) {
          const wait = 15000 * (retry + 1);
          setError(`API混雑中... ${Math.round(wait/1000)}秒後にリトライ (${retry+1}/5)`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        break;
      }
      if (data.error) { setError(data.error); }
      else {
        setAnalysis(data);
        const saved: ScriptAnalysis = {
          id: generateId(),
          videoId: extractVideoId(videoUrl) || "",
          videoUrl,
          videoTitle: videoInfo?.title || "不明",
          channelName: videoInfo?.channelTitle || "不明",
          thumbnailUrl: videoInfo?.thumbnailUrl || "",
          views: videoInfo?.views || 0,
          transcript,
          analysisResult: data,
          category,
          tags: [],
          createdAt: new Date().toISOString(),
          score: data.score,
        };
        saveAnalysis(saved);
      }
    } catch { setError("分析に失敗しました"); }
    finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-6">
      {/* リセットボタン */}
      <div className="flex justify-end">
        <button onClick={handleReset}
          className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:text-danger transition-colors">
          リセット
        </button>
      </div>

      {/* Step 1: 動画URL */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-3">① 動画情報を取得</h2>
        <div className="flex gap-3">
          <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube動画のURLを貼り付け"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          <button onClick={fetchVideoInfo} disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0">
            {loading ? "取得中..." : "取得"}
          </button>
        </div>
        {videoInfo && (
          <div className="mt-4 flex gap-4 items-start bg-gray-50 rounded-lg p-4">
            {videoInfo.thumbnailUrl && <img src={videoInfo.thumbnailUrl} alt="" className="w-32 h-20 rounded object-cover shrink-0" />}
            <div>
              <p className="font-medium text-sm">{videoInfo.title}</p>
              <p className="text-xs text-gray-500 mt-1">{videoInfo.channelTitle} · {formatNumber(videoInfo.views)}回再生</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: 画面読み取り（テロップOCR） */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-1">② 画面読み取り（テロップ文字起こし）</h2>
        <p className="text-xs text-gray-500 mb-4">
          テロップ動画の文字起こし。自動抽出 or スクリーンショットから読み取ります。
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button onClick={autoExtractFrames} disabled={extracting}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {extracting ? ocrProgress || "処理中..." : "自動で画面読み取り"}
          </button>
          <span className="text-xs text-gray-400 self-center">
            ※ 失敗する場合はスクリーンショットを貼り付けてください
          </span>
        </div>

        <div className="text-xs text-gray-500 mb-2 font-medium">または、スクリーンショットを貼り付け:</div>

        {/* ドロップ＆ペーストエリア */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onPaste={handlePaste}
          tabIndex={0}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-accent/30 focus:border-accent/30 transition-colors cursor-pointer"
        >
          <p className="text-sm text-gray-400 mb-2">
            ここにスクリーンショットをドラッグ&ドロップ、またはCtrl+Vで貼り付け
          </p>
          <label className="inline-block px-4 py-2 rounded-lg bg-gray-100 text-sm text-gray-600 hover:bg-gray-200 cursor-pointer">
            ファイルを選択
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* スクリーンショットプレビュー */}
        {screenshots.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{screenshots.length}枚の画像</span>
              <div className="flex gap-2">
                <button onClick={() => setScreenshots([])} className="text-xs text-gray-400 hover:text-danger">すべて削除</button>
                <button onClick={() => runOCR()} disabled={extracting}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {extracting ? "読み取り中..." : "テキストを読み取る"}
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {screenshots.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt="" className="h-20 rounded border border-gray-200" />
                  <button onClick={() => removeScreenshot(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {ocrProgress && !extracting && <p className="text-sm text-success mt-2">{ocrProgress}</p>}
      </div>

      {/* Step 3: 台本テキスト */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">③ 台本テキスト</h2>
          <div className="flex items-center gap-3">
            {transcript && (
              <>
                <button onClick={cleanupText} disabled={cleaning}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {cleaning ? cleanProgress || "処理中..." : "画像と照合して自動修正"}
                </button>
                <button onClick={() => navigator.clipboard.writeText(transcript)} className="text-xs text-accent hover:underline">
                  コピー
                </button>
              </>
            )}
          </div>
        </div>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
          placeholder="上のステップで自動入力されます。手動で編集・追記もできます。"
          rows={10} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">カテゴリ:</label>
            {([["healing", "ヒーリング系"], ["education", "教育系"], ["other", "その他"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setCategory(val)}
                className={`px-3 py-1 rounded-lg text-xs ${category === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{transcript.length}文字</span>
        </div>
      </div>

      {/* Step 4: 分析実行 */}
      <div className="flex gap-3">
        <button onClick={runAnalysis} disabled={analyzing || !transcript.trim()}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
          {analyzing ? "分析中（30秒ほどかかります）..." : "④ AIで台本を分析する"}
        </button>
      </div>

      {error && <p className="text-danger text-sm whitespace-pre-wrap">{error}</p>}

      {/* 分析結果 */}
      {analysis && <AnalysisResultView analysis={analysis} />}
    </div>
  );
}

// ===== 分析結果表示コンポーネント =====
function AnalysisResultView({ analysis }: { analysis: AnalysisResult & { score?: AnalysisScore } }) {
  return (
    <div className="space-y-4">
      {/* サマリー＋スコア */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold mb-2">分析サマリー</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
        </div>

        {/* スコアバー */}
        {analysis.score && (
          <div className="p-6 bg-gray-50/50">
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: "フック力", value: analysis.score.hookStrength, icon: "🎣" },
                { label: "CTA効果", value: analysis.score.ctaEffectiveness, icon: "📢" },
                { label: "構成力", value: analysis.score.structureBalance, icon: "📐" },
                { label: "感情訴求", value: analysis.score.emotionalAppeal, icon: "💖" },
                { label: "総合", value: analysis.score.overall, icon: "⭐" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg mb-1">{s.icon}</div>
                  <div className="relative h-2 bg-gray-200 rounded-full mb-1.5 overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${s.value >= 8 ? "bg-green-500" : s.value >= 6 ? "bg-yellow-500" : "bg-red-400"}`}
                      style={{ width: `${s.value * 10}%` }}
                    />
                  </div>
                  <div className={`text-lg font-bold ${s.value >= 8 ? "text-green-600" : s.value >= 6 ? "text-yellow-600" : "text-red-500"}`}>
                    {s.value}<span className="text-xs text-gray-400">/10</span>
                  </div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* パターン＆感情 */}
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="bg-accent/5 rounded-lg p-3">
            <p className="text-xs font-medium text-accent mb-1">台本パターン</p>
            <p className="text-sm font-medium">{analysis.overallPattern}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs font-medium text-purple-600 mb-1">ターゲット感情</p>
            <p className="text-sm font-medium">{analysis.targetEmotion}</p>
          </div>
        </div>
      </div>

      {/* 構成タイムライン */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-4">構成・時間配分</h3>
        <div className="relative">
          {analysis.structure?.map((s, i) => (
            <div key={i} className="flex gap-4 mb-4 last:mb-0">
              {/* タイムライン */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                {i < (analysis.structure?.length || 0) - 1 && (
                  <div className="w-0.5 flex-1 bg-accent/20 mt-1" />
                )}
              </div>
              {/* コンテンツ */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.timeRange}</span>
                  <span className="text-xs text-gray-400">{s.duration}</span>
                </div>
                <p className="text-sm text-gray-600">{s.description}</p>
                <p className="text-xs text-accent/80 mt-1">→ {s.purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フック・CTA・伸び要因・訴求 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListCard title="フック・引きの要素" items={analysis.hooks} color="red" />
        <ListCard title="CTA（行動喚起）" items={analysis.ctas} color="blue" />
        <ListCard title="伸びている要因" items={analysis.growthFactors} color="green" />
        <ListCard title="刺さっている訴求" items={analysis.appealPoints} color="purple" />
      </div>
    </div>
  );
}

function ListCard({ title, items, color = "accent" }: { title: string; items?: string[]; color?: string }) {
  if (!items || items.length === 0) return null;
  const colors: Record<string, { bg: string; dot: string; border: string }> = {
    red: { bg: "bg-red-50", dot: "bg-red-400", border: "border-red-100" },
    blue: { bg: "bg-blue-50", dot: "bg-blue-400", border: "border-blue-100" },
    green: { bg: "bg-green-50", dot: "bg-green-400", border: "border-green-100" },
    purple: { bg: "bg-purple-50", dot: "bg-purple-400", border: "border-purple-100" },
    accent: { bg: "bg-accent/5", dot: "bg-accent", border: "border-accent/10" },
  };
  const c = colors[color] || colors.accent;
  return (
    <div className={`rounded-xl p-5 shadow-sm border ${c.border} ${c.bg}`}>
      <h4 className="font-semibold text-sm mb-3">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className={`w-2 h-2 rounded-full ${c.dot} mt-1.5 shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== ライブラリタブ =====
function LibraryTab() {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [filter, setFilter] = useState<"all" | "healing" | "education" | "other">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showTab, setShowTab] = useState<Record<string, "analysis" | "transcript">>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    setAnalyses(getAnalyses());
    // サーバーと同期
    syncFromServer().then(({ analyses }) => {
      setAnalyses(analyses);
      setSyncStatus("");
    });
  }, []);

  // エクスポート（localStorageのデータをJSONファイルとしてダウンロード）
  const handleExport = () => {
    const data = {
      analyses: getAnalyses(),
      proposals: getProposals(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `script-analyses-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 全データをサーバーに強制アップロード
  const handleForceSync = async () => {
    setSyncStatus("サーバーにアップロード中...");
    const localAnalyses = getAnalyses();
    const localProposals = getProposals();
    let uploaded = 0;
    let failed = 0;
    for (const a of localAnalyses) {
      try {
        const res = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(a),
        });
        if (res.ok) uploaded++;
        else failed++;
      } catch { failed++; }
    }
    for (const p of localProposals) {
      try {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        if (res.ok) uploaded++;
        else failed++;
      } catch { failed++; }
    }
    setSyncStatus(`同期完了！ ${uploaded}件アップロード${failed > 0 ? ` / ${failed}件失敗` : ""}`);
    setTimeout(() => setSyncStatus(""), 5000);
  };

  // インポート（JSONファイルからデータを読み込んでlocalStorage+サーバーに保存）
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importedAnalyses: ScriptAnalysis[] = data.analyses || [];
      const importedProposals: ScriptProposal[] = data.proposals || [];

      setSyncStatus(`インポート中... ${importedAnalyses.length}件の分析`);

      // localStorageにマージ
      const current = getAnalyses();
      const currentIds = new Set(current.map((a) => a.id));
      let added = 0;
      for (const a of importedAnalyses) {
        if (!currentIds.has(a.id)) {
          saveAnalysis(a); // localStorage + サーバー同期
          added++;
        }
      }
      const currentProposals = getProposals();
      const currentPIds = new Set(currentProposals.map((p) => p.id));
      for (const p of importedProposals) {
        if (!currentPIds.has(p.id)) {
          saveProposal(p);
        }
      }

      setAnalyses(getAnalyses());
      setSyncStatus(`インポート完了！ ${added}件追加`);
      setTimeout(() => setSyncStatus(""), 3000);
    } catch {
      setSyncStatus("インポート失敗: JSONファイルが不正です");
    }
    e.target.value = "";
  };

  const handleDelete = (id: string) => {
    setAnalyses(deleteAnalysis(id));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getActiveTab = (id: string) => showTab[id] || "analysis";

  const filtered = analyses.filter((a) => filter === "all" || a.category === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {([["all", "すべて"], ["healing", "ヒーリング系"], ["education", "教育系"], ["other", "その他"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && <span className="text-xs text-green-600">{syncStatus}</span>}
          <button onClick={handleForceSync}
            className="px-3 py-1.5 rounded-lg text-xs bg-accent/10 text-accent hover:bg-accent/20">
            サーバーに同期
          </button>
          <button onClick={handleExport}
            className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200">
            エクスポート
          </button>
          <label className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">
            インポート
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <span className="text-sm text-gray-500">{filtered.length}件</span>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>分析済みの台本がありません</p>
          <p className="text-sm mt-1">「台本分析」タブで競合動画を分析してください</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((a) => (
          <div key={a.id} className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* ヘッダー */}
            <div className="p-4 flex gap-4 items-start cursor-pointer" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
              {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-32 h-20 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{a.videoTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.channelName} · {formatNumber(a.views)}回再生</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.category === "healing" ? "bg-purple-100 text-purple-700" : a.category === "education" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.category === "healing" ? "ヒーリング" : a.category === "education" ? "教育系" : "その他"}
                  </span>
                  {a.score && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${a.score.overall >= 8 ? "bg-green-100 text-green-700" : a.score.overall >= 6 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {a.score.overall}/10
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("ja-JP")}</span>
                  {a.transcript && <span className="text-xs text-gray-400">· {a.transcript.length}文字</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded === a.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} className="text-gray-300 hover:text-danger">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* 展開部分 */}
            {expanded === a.id && (
              <div className="border-t border-gray-100">
                {/* タブ切り替え: 分析結果 / 台本テキスト */}
                <div className="flex border-b border-gray-100">
                  <button
                    onClick={() => setShowTab({ ...showTab, [a.id]: "analysis" })}
                    className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${getActiveTab(a.id) === "analysis" ? "border-accent text-accent" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    分析結果
                  </button>
                  <button
                    onClick={() => setShowTab({ ...showTab, [a.id]: "transcript" })}
                    className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${getActiveTab(a.id) === "transcript" ? "border-accent text-accent" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    台本テキスト {a.transcript ? `(${a.transcript.length}文字)` : "(なし)"}
                  </button>
                </div>

                {/* 分析結果表示 */}
                {getActiveTab(a.id) === "analysis" && a.analysisResult && (
                  <div className="p-4">
                    <AnalysisResultView analysis={{ ...a.analysisResult, score: a.score }} />
                  </div>
                )}

                {/* 台本テキスト表示 */}
                {getActiveTab(a.id) === "transcript" && (
                  <div className="p-4">
                    {a.transcript ? (
                      <>
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => handleCopy(a.transcript, a.id)}
                            className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90"
                          >
                            {copied === a.id ? "コピーしました！" : "台本テキストをコピー"}
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                          <pre className="text-sm leading-7 whitespace-pre-wrap font-sans text-gray-700">{a.transcript}</pre>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">台本テキストが保存されていません</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 構成提案・台本作成タブ =====
function ProposeTab() {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [selectedArr, setSelectedArr] = usePersisted<string[]>("propose_selected", []);
  const selected = new Set(selectedArr);
  const [style, setStyle] = usePersisted<"healing" | "education">("propose_style", "healing");
  const [topic, setTopic] = usePersisted("propose_topic", "");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = usePersisted<ProposalResult | null>("propose_proposal", null);
  const [generating, setGenerating] = useState(false);
  const [script, setScript] = usePersisted("propose_script", "");
  const [additionalNotes, setAdditionalNotes] = usePersisted("propose_notes", "");
  const [error, setError] = useState("");

  useEffect(() => {
    setAnalyses(getAnalyses());
    syncFromServer().then(({ analyses }) => setAnalyses(analyses));
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedArr);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedArr([...next]);
  };

  const handlePropose = async () => {
    if (selectedArr.length === 0) { setError("分析を1つ以上選択してください"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setProposing(true);
    setError("");
    const selectedAnalyses = analyses.filter((a) => selected.has(a.id));

    try {
      const res = await fetch("/api/script/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses: selectedAnalyses,
          style,
          topic: topic || "未指定",
          channelProfile: getProfile(),
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setProposal(data); }
    } catch { setError("構成提案の生成に失敗"); }
    finally { setProposing(false); }
  };

  const handleGenerate = async () => {
    if (!proposal) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/script/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal,
          channelProfile: getProfile(),
          style,
          topic: topic || "未指定",
          additionalNotes,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setScript(data.script);
        // 保存
        saveProposal({
          id: generateId(),
          sourceAnalysisIds: [...selected],
          style,
          topic,
          proposal,
          generatedScript: data.script,
          createdAt: new Date().toISOString(),
        });
      }
    } catch { setError("台本生成に失敗"); }
    finally { setGenerating(false); }
  };

  const handleExport = () => {
    const text = `# 台本: ${topic}\nスタイル: ${style === "healing" ? "ヒーリング系" : "教育系"}\n作成日: ${new Date().toLocaleDateString("ja-JP")}\n\n---\n\n${script}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `台本-${topic || "untitled"}-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: 分析を選択 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-1">③ ベースにする分析を選択（2-3つ推奨）</h2>
        <p className="text-xs text-gray-500 mb-4">複数選択すると「良いとこどり」の構成を提案します</p>
        {analyses.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">分析ライブラリが空です。先に「台本分析」タブで分析してください。</p>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {analyses.map((a) => (
            <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(a.id) ? "bg-accent/5 border border-accent/30" : "bg-gray-50 border border-transparent hover:bg-gray-100"}`}>
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)}
                className="w-4 h-4 text-accent rounded" />
              {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-16 h-10 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.videoTitle}</p>
                <p className="text-xs text-gray-500">{a.channelName} · {formatNumber(a.views)}回 · スコア {a.score?.overall || "?"}/10</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${a.category === "healing" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                {a.category === "healing" ? "ヒーリング" : a.category === "education" ? "教育" : "他"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Step 2: テーマ・スタイル */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テーマ</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="例: エンジェルナンバー1111の意味と受け取り方"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">スタイル</label>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setStyle("healing")}
                className={`px-4 py-2 rounded-lg text-sm ${style === "healing" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                ヒーリング系
              </button>
              <button onClick={() => setStyle("education")}
                className={`px-4 py-2 rounded-lg text-sm ${style === "education" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                教育系
              </button>
            </div>
          </div>
        </div>
        <button onClick={handlePropose} disabled={proposing || selectedArr.length === 0}
          className="mt-4 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
          {proposing ? "構成を提案中..." : "構成を提案する"}
        </button>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* 構成提案結果 */}
      {proposal && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">構成提案</h2>
          <p className="text-sm text-gray-700 mb-4">{proposal.concept}</p>
          <p className="text-xs text-gray-500 mb-3">推定尺: {proposal.estimatedDuration}</p>

          <div className="space-y-3 mb-4">
            {proposal.structure?.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-white bg-accent rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="font-medium text-sm">{s.name} <span className="text-xs text-gray-400">({s.timeRange})</span></p>
                  <p className="text-xs text-gray-600">{s.description}</p>
                  <p className="text-xs text-accent/70">{s.purpose}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <MiniList title="取り入れた要素" items={proposal.keyElements} />
            <MiniList title="提案フック" items={proposal.suggestedHooks} />
            <MiniList title="提案CTA" items={proposal.suggestedCtas} />
          </div>

          {/* 追加指示 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">追加指示（任意）</label>
            <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="例: 冒頭に瞑想の誘導を入れてほしい、語尾は「〜ですよ」で統一"
              rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
            {generating ? "台本を生成中..." : "④ この構成で台本を作成する"}
          </button>
        </div>
      )}

      {/* 生成された台本 */}
      {script && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">生成された台本</h2>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">コピー</button>
              <button onClick={handleExport} className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">エクスポート</button>
            </div>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap text-sm leading-7 font-sans">{script}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => <li key={i} className="text-xs text-gray-700">· {item}</li>)}
      </ul>
    </div>
  );
}
