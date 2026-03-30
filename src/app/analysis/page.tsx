"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { formatNumber } from "@/lib/mock-data";
import {
  getAnalyses, saveAnalysis, deleteAnalysis,
  getProposals, saveProposal, deleteProposal,
  getProfile, saveProfile, generateId,
} from "@/lib/script-analysis-store";
import type {
  ScriptAnalysis, AnalysisResult, AnalysisScore,
  ScriptProposal, ProposalResult, ChannelProfile,
} from "@/lib/script-analysis-store";

// ===== タブ切り替え =====
type Tab = "profile" | "analyze" | "library" | "propose";

export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("analyze");
  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "自チャンネル設計" },
    { id: "analyze", label: "台本分析" },
    { id: "library", label: "分析ライブラリ" },
    { id: "propose", label: "構成提案・台本作成" },
  ];

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
      {tab === "analyze" && <AnalyzeTab />}
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 mb-4">
          台本生成時に自チャンネルの設計が自動反映されます。
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
function AnalyzeTab() {
  const [videoUrl, setVideoUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("analysis_video_url");
      if (saved) { sessionStorage.removeItem("analysis_video_url"); return saved; }
    }
    return "";
  });
  const [transcript, setTranscript] = useState("");
  const [videoInfo, setVideoInfo] = useState<{ title: string; channelTitle: string; views: number; thumbnailUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<(AnalysisResult & { score?: AnalysisScore }) | null>(null);
  const [category, setCategory] = useState<"healing" | "education" | "other">("healing");
  const [error, setError] = useState("");

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const fetchVideoInfo = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { setError("YouTube URLが正しくありません"); return; }
    const apiKey = getApiKey("yt_api_key");
    if (!apiKey) { setError("YouTube APIキーを設定してください"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/youtube/transcript?videoId=${videoId}&apiKey=${encodeURIComponent(apiKey)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setVideoInfo(data); }
    } catch { setError("動画情報の取得に失敗"); }
    finally { setLoading(false); }
  };

  const runAnalysis = async () => {
    if (!transcript.trim()) { setError("台本テキストを入力してください"); return; }
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setAnalyzing(true);
    setError("");
    try {
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
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setAnalysis(data);
        // 自動保存
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

  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
  };

  return (
    <div className="space-y-6">
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

      {/* Step 2: 文字起こし入力 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">② 文字起こし・台本テキスト</h2>
          {transcript && (
            <button onClick={copyTranscript} className="text-xs text-accent hover:underline">クリップボードにコピー</button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          YouTubeの字幕をコピーして貼り付けるか、文字起こしツールで取得したテキストを入力してください。
          動画の「…」→「文字起こしを表示」からコピーできます。
        </p>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
          placeholder="ここに台本テキストを貼り付け..."
          rows={12} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono" />
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

      {/* Step 3: 分析実行 */}
      <div className="flex gap-3">
        <button onClick={runAnalysis} disabled={analyzing || !transcript.trim()}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
          {analyzing ? "分析中（30秒ほどかかります）..." : "AIで台本を分析する"}
        </button>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* 分析結果 */}
      {analysis && <AnalysisResultView analysis={analysis} />}
    </div>
  );
}

// ===== 分析結果表示コンポーネント =====
function AnalysisResultView({ analysis }: { analysis: AnalysisResult & { score?: AnalysisScore } }) {
  return (
    <div className="space-y-4">
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-3">分析結果</h3>
        <p className="text-sm text-gray-700 mb-4">{analysis.summary}</p>

        {/* スコア */}
        {analysis.score && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: "フック", value: analysis.score.hookStrength },
              { label: "CTA", value: analysis.score.ctaEffectiveness },
              { label: "構成", value: analysis.score.structureBalance },
              { label: "感情訴求", value: analysis.score.emotionalAppeal },
              { label: "総合", value: analysis.score.overall },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold ${s.value >= 8 ? "text-success" : s.value >= 6 ? "text-warning" : "text-danger"}`}>
                  {s.value}
                </div>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mb-1">パターン</p>
        <p className="text-sm font-medium mb-4">{analysis.overallPattern}</p>
        <p className="text-xs text-gray-500 mb-1">ターゲット感情</p>
        <p className="text-sm font-medium">{analysis.targetEmotion}</p>
      </div>

      {/* 構成 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold mb-3">構成・時間配分</h3>
        <div className="space-y-3">
          {analysis.structure?.map((s, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-xs font-bold text-white bg-accent rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-xs text-gray-400">{s.timeRange}（{s.duration}）</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>
                <p className="text-xs text-accent/70 mt-0.5">狙い: {s.purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フック・CTA・伸び要因 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListCard title="フック・引きの要素" items={analysis.hooks} />
        <ListCard title="CTA（行動喚起）" items={analysis.ctas} />
        <ListCard title="伸びている要因" items={analysis.growthFactors} />
        <ListCard title="刺さっている訴求" items={analysis.appealPoints} />
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-accent mt-1 shrink-0"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg></span>
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

  useEffect(() => { setAnalyses(getAnalyses()); }, []);

  const handleDelete = (id: string) => {
    setAnalyses(deleteAnalysis(id));
  };

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
        <span className="text-sm text-gray-500">{filtered.length}件</span>
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
            <div className="p-4 flex gap-4 items-start cursor-pointer" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
              {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-28 h-16 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.videoTitle}</p>
                <p className="text-xs text-gray-500">{a.channelName} · {formatNumber(a.views)}回再生</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.category === "healing" ? "bg-purple-100 text-purple-700" : a.category === "education" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.category === "healing" ? "ヒーリング" : a.category === "education" ? "教育系" : "その他"}
                  </span>
                  {a.score && <span className="text-xs text-gray-500">スコア: {a.score.overall}/10</span>}
                  <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("ja-JP")}</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} className="text-gray-300 hover:text-danger shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {expanded === a.id && a.analysisResult && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                <AnalysisResultView analysis={{ ...a.analysisResult, score: a.score }} />
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [style, setStyle] = useState<"healing" | "education">("healing");
  const [topic, setTopic] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ProposalResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [script, setScript] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setAnalyses(getAnalyses()); }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handlePropose = async () => {
    if (selected.size === 0) { setError("分析を1つ以上選択してください"); return; }
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
        <button onClick={handlePropose} disabled={proposing || selected.size === 0}
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
