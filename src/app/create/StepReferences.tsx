"use client";

import { useState, useEffect, useMemo } from "react";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { getAnalyses } from "@/lib/script-analysis-store";
import type { ScriptAnalysis } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";
import { GENRE_LABELS } from "@/lib/project-store";
import type { ScriptProject, ReferenceVideo, Genre } from "@/lib/project-store";

// ジャンルごとのフィルタキーワード（タイトルにいずれかが含まれる動画を優先）
const GENRE_KEYWORDS: Record<Genre, string[]> = {
  love: ["恋愛", "ツインレイ", "ツインソウル", "運命の人", "復縁", "片思い", "あの人", "お相手", "彼", "好きな人", "パートナー", "結婚", "同棲", "連絡", "再会", "出会い", "愛", "恋", "ソウルメイト"],
  money: ["金運", "お金", "収入", "豊かさ", "富", "財", "臨時収入", "宝くじ", "昇給", "副業", "開運", "金銭"],
  general: ["運勢", "スピリチュアル", "覚醒", "エネルギー", "浄化", "チャクラ", "瞑想", "ヒーリング", "波動", "アセンション", "守護", "天使", "エンジェル", "宇宙"],
};

// フィルタ設定の localStorage キー
const FILTER_STORAGE_KEY = "fortune_yt_ref_filter";
interface RefFilter {
  periodDays: number;     // 公開期間 (日)
  minViews: number;       // 最低再生数
  minMultiplier: number;  // 最低再生倍率
}
const DEFAULT_FILTER: RefFilter = { periodDays: 30, minViews: 0, minMultiplier: 0 };

function loadFilter(): RefFilter {
  if (typeof window === "undefined") return DEFAULT_FILTER;
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) return { ...DEFAULT_FILTER, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_FILTER;
}
function saveFilter(f: RefFilter) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
}

// 動画オブジェクトに保持する追加情報
type ScoredVideo = ReferenceVideo & {
  duration?: string;
  publishedAt?: string;
  genreMatch?: number;
};

export default function StepReferences({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [videos, setVideos] = useState<ScoredVideo[]>(project.referenceVideos.length > 0 ? project.referenceVideos : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(project.referenceVideos.length > 0);
  const [tab, setTab] = useState<"search" | "analyzed">("search");
  const [analyzedVideos, setAnalyzedVideos] = useState<ScriptAnalysis[]>([]);
  // フィルタ
  const [filter, setFilter] = useState<RefFilter>(DEFAULT_FILTER);
  useEffect(() => { setFilter(loadFilter()); }, []);
  const updateFilter = (patch: Partial<RefFilter>) => {
    setFilter((prev) => {
      const next = { ...prev, ...patch };
      saveFilter(next);
      return next;
    });
  };

  useEffect(() => {
    setAnalyzedVideos(getAnalyses());
  }, []);

  // 「不明」/空タイトルになっている参考動画を YouTube API で再取得して修復
  useEffect(() => {
    const repair = async () => {
      const broken = (project.referenceVideos || []).filter(
        (v) => v.videoId && (!v.title || v.title === "不明" || !v.channelName || v.channelName === "不明")
      );
      if (broken.length === 0) return;
      const ytApiKey = getApiKey("yt_api_key");
      if (!ytApiKey) return;
      const next = [...project.referenceVideos];
      let changed = false;
      for (let i = 0; i < next.length; i++) {
        const v = next[i];
        if (!v.videoId) continue;
        if (v.title && v.title !== "不明" && v.channelName && v.channelName !== "不明") continue;
        try {
          const params = new URLSearchParams({ videoId: v.videoId, apiKey: ytApiKey });
          const res = await fetch(`/api/youtube/transcript?${params}`);
          if (!res.ok) continue;
          const d = await res.json();
          if (!d?.title) continue;
          next[i] = {
            ...v,
            title: d.title,
            channelName: d.channelTitle || v.channelName,
            thumbnailUrl: d.thumbnailUrl || v.thumbnailUrl,
            views: typeof d.views === "number" && d.views > 0 ? d.views : v.views,
          };
          changed = true;
        } catch { /* 1件失敗しても続行 */ }
      }
      if (changed) {
        setVideos(next);
        onUpdate({ ...project, referenceVideos: next });
      }
    };
    repair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVideos = async () => {
    const ytApiKey = getApiKey("yt_api_key");
    if (!ytApiKey) { setError("YouTube APIキーを設定してください"); return; }

    const channels = getChannels().filter((ch) => ch.channelId);
    if (channels.length === 0) { setError("チャンネルを登録してデータを取得してください"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/youtube/search-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: channels.map((ch) => ({ channelId: ch.channelId, name: ch.name, handle: ch.handle })), apiKey: ytApiKey, maxResultsPerChannel: 50 }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      const keywords = GENRE_KEYWORDS[project.genre] || [];

      // 構造的フィルタ（期間と再生数倍率の閾値はクライアント側で動的に変えるので、ここでは
      // ショートと #shorts のみ除外する）
      const allVideos = (data.videos || [])
        .filter((v: { publishedAt: string; duration?: string; title?: string }) => {
          // ショート除外: durationが5分未満
          if (v.duration) {
            const parts = v.duration.split(":");
            if (parts.length === 2) {
              const mins = parseInt(parts[0]);
              if (mins < 5) return false;
            } else if (v.duration === "0:00") {
              return false;
            }
          }
          // #shortsタグを除外
          if (v.title && v.title.toLowerCase().includes("#shorts")) return false;
          return true;
        });

      // ジャンル一致スコアと再生倍率を付与（フィルタは適用せず全部保持）
      const scored: ScoredVideo[] = allVideos.map((v: { id: string; title: string; channelName: string; views: number; thumbnailUrl: string; channelId: string; duration?: string; publishedAt?: string }) => {
        const matchCount = keywords.filter((kw) => v.title.includes(kw)).length;
        const stats = data.channelStats?.[v.channelId];
        return {
          videoId: v.id, title: v.title, channelName: v.channelName, views: v.views,
          thumbnailUrl: v.thumbnailUrl, duration: v.duration, publishedAt: v.publishedAt,
          multiplier: stats?.avgViews ? Math.round((v.views / stats.avgViews) * 10) / 10 : undefined,
          selected: false,
          genreMatch: matchCount,
        };
      });

      setVideos(scored);
      setFetched(true);

      if (scored.filter((v) => (v.genreMatch || 0) > 0).length === 0) {
        setError(`「${GENRE_LABELS[project.genre]}」に関連する動画が見つかりませんでした。他のジャンルの動画から選んでください。`);
      }
    } catch { setError("動画の取得に失敗"); }
    finally { setLoading(false); }
  };

  // フィルタ適用 + ソート + 表示30件にスライス
  const filteredVideos = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filter.periodDays);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const result = videos.filter((v) => {
      // 公開日
      if (v.publishedAt && v.publishedAt < cutoffStr) return false;
      // 最低再生数
      if (filter.minViews > 0 && (v.views || 0) < filter.minViews) return false;
      // 最低再生倍率（multiplier が未取得のものは弾かない）
      if (filter.minMultiplier > 0 && v.multiplier !== undefined && v.multiplier < filter.minMultiplier) return false;
      return true;
    });

    // ジャンル一致数 → 再生数 で降順
    result.sort((a, b) => (b.genreMatch || 0) - (a.genreMatch || 0) || (b.views || 0) - (a.views || 0));
    return result.slice(0, 30);
  }, [videos, filter]);

  const toggleSelect = (videoId: string) => {
    setVideos((prev) => prev.map((v) => v.videoId === videoId ? { ...v, selected: !v.selected } : v));
  };

  const addFromAnalyzed = (analysis: ScriptAnalysis) => {
    // 既に追加済みならスキップ
    if (videos.some((v) => v.videoId === analysis.videoId)) return;
    if (selectedCount >= 3) return;
    const ref: ReferenceVideo = {
      videoId: analysis.videoId,
      title: analysis.videoTitle,
      channelName: analysis.channelName,
      views: analysis.views,
      thumbnailUrl: analysis.thumbnailUrl,
      selected: true,
    };
    setVideos((prev) => [ref, ...prev]);
    setFetched(true);
  };

  const selectedCount = videos.filter((v) => v.selected).length;

  const handleNext = () => {
    onUpdate({ ...project, referenceVideos: videos.filter((v) => v.selected), status: "analyzing" });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">③ 参考動画を選択（2-3本）</h2>
      <p className="text-sm text-gray-500 mb-4">
        「{project.title}」 · {GENRE_LABELS[project.genre]}の競合人気動画
      </p>

      {/* タブ: 検索 / 分析済みから選ぶ */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setTab("search")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "search" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          競合動画から検索
        </button>
        <button onClick={() => setTab("analyzed")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === "analyzed" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          分析済みから選ぶ（{analyzedVideos.length}件）
        </button>
      </div>

      {/* 選択中の表示 */}
      {selectedCount > 0 && (
        <div className="bg-accent/5 rounded-lg p-3 mb-4 flex flex-wrap gap-2">
          {videos.filter((v) => v.selected).map((v) => (
            <span key={v.videoId} className="text-xs bg-white rounded-full px-3 py-1 border border-accent/20 flex items-center gap-1">
              {v.title.substring(0, 25)}...
              <button onClick={() => toggleSelect(v.videoId)} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
          <span className="text-xs text-gray-500 self-center">{selectedCount}/3</span>
        </div>
      )}

      {/* 分析済みタブ */}
      {tab === "analyzed" && (
        <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
          {analyzedVideos.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">分析済みの動画がありません。台本分析で動画を分析してください。</p>
          )}
          {analyzedVideos.map((a) => {
            const alreadyAdded = videos.some((v) => v.videoId === a.videoId && v.selected);
            return (
              <div key={a.id} className={`flex items-center gap-4 p-3 rounded-lg ${alreadyAdded ? "bg-accent/5 border border-accent/30" : "bg-card-bg border border-gray-100"}`}>
                {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{a.videoTitle}</p>
                  <p className="text-xs text-gray-500">{a.channelName} · スコア {a.score?.overall || "?"}/10</p>
                  {a.analysisResult?.overallPattern && <p className="text-xs text-accent mt-0.5">{a.analysisResult.overallPattern}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatNumber(a.views)}回</p>
                </div>
                <button
                  onClick={() => alreadyAdded ? toggleSelect(a.videoId) : addFromAnalyzed(a)}
                  disabled={!alreadyAdded && selectedCount >= 3}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                    alreadyAdded ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
                  }`}>
                  {alreadyAdded ? "解除" : "追加"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 検索タブ */}
      {tab === "search" && !fetched && (
        <div className="text-center py-12">
          <button onClick={fetchVideos} disabled={loading}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
            {loading ? "取得中..." : "競合動画を取得"}
          </button>
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {tab === "search" && fetched && (
        <>
          {/* フィルタコントロール */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              期間:
              <select
                value={filter.periodDays}
                onChange={(e) => updateFilter({ periodDays: Number(e.target.value) })}
                className="border border-gray-200 rounded px-2 py-1 text-xs outline-none bg-white"
              >
                <option value={7}>1週間</option>
                <option value={14}>2週間</option>
                <option value={30}>1ヶ月</option>
                <option value={60}>2ヶ月</option>
                <option value={90}>3ヶ月</option>
                <option value={180}>半年</option>
                <option value={365}>1年</option>
                <option value={3650}>制限なし</option>
              </select>
            </label>
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              最低再生数:
              <select
                value={filter.minViews}
                onChange={(e) => updateFilter({ minViews: Number(e.target.value) })}
                className="border border-gray-200 rounded px-2 py-1 text-xs outline-none bg-white"
              >
                <option value={0}>制限なし</option>
                <option value={1000}>1,000以上</option>
                <option value={5000}>5,000以上</option>
                <option value={10000}>1万以上</option>
                <option value={30000}>3万以上</option>
                <option value={50000}>5万以上</option>
                <option value={100000}>10万以上</option>
                <option value={500000}>50万以上</option>
              </select>
            </label>
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              最低再生倍率:
              <select
                value={filter.minMultiplier}
                onChange={(e) => updateFilter({ minMultiplier: Number(e.target.value) })}
                className="border border-gray-200 rounded px-2 py-1 text-xs outline-none bg-white"
              >
                <option value={0}>制限なし</option>
                <option value={1}>1.0倍以上</option>
                <option value={1.5}>1.5倍以上</option>
                <option value={2}>2倍以上</option>
                <option value={3}>3倍以上</option>
                <option value={5}>5倍以上</option>
              </select>
            </label>
            <button
              onClick={() => updateFilter(DEFAULT_FILTER)}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700"
            >
              フィルタリセット
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {filteredVideos.length}件表示中（取得 {videos.length}件・{GENRE_LABELS[project.genre]}優先） | {selectedCount}/3 選択中
            </span>
            <button onClick={fetchVideos} disabled={loading} className="text-xs text-accent hover:underline">
              {loading ? "更新中..." : "再取得"}
            </button>
          </div>

          {error && <p className="text-danger text-sm mb-3">{error}</p>}

          <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
            {filteredVideos.length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">
                条件に合う動画がありません。フィルタを緩めるか「再取得」してください。
              </p>
            )}
            {filteredVideos.map((v, i) => (
              <label key={v.videoId || `ref-${i}`} className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                v.selected ? "bg-accent/5 border border-accent/30" : "bg-card-bg border border-gray-100 hover:border-gray-200"
              }`}>
                <input type="checkbox" checked={v.selected} onChange={() => toggleSelect(v.videoId)}
                  disabled={!v.selected && selectedCount >= 3}
                  className="w-4 h-4 rounded text-accent shrink-0" />
                {v.thumbnailUrl && (
                  <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <img src={v.thumbnailUrl} alt="" className="w-24 h-14 rounded object-cover hover:opacity-80 transition-opacity" />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} className="text-sm font-medium line-clamp-1 hover:text-accent transition-colors">{v.title}</a>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{v.channelName}</span>
                    {(v as { genreMatch?: number }).genreMatch && (v as { genreMatch?: number }).genreMatch! > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{GENRE_LABELS[project.genre]}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatNumber(v.views)}回</p>
                  {v.multiplier && (
                    <p className={`text-xs font-bold ${v.multiplier >= 3 ? "text-red-500" : v.multiplier >= 2 ? "text-yellow-600" : "text-green-600"}`}>
                      {v.multiplier}倍
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

        </>
      )}

      {/* ナビゲーション（常に表示） */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onUpdate({ ...project, status: "title" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        <button onClick={handleNext} disabled={selectedCount < 1}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
          {selectedCount}本を分析する →
        </button>
      </div>
    </div>
  );
}
