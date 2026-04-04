"use client";

import { useState, useEffect, useRef } from "react";

// ===== 型定義 =====
interface LaunchMessage {
  id: string;
  sourceType: "text" | "screenshot" | "url";
  rawContent: string;
  imageUrl: string;
  sequenceOrder: number;
  phase: "pre_pre" | "pre" | "launch" | "post";
  sentAt: string;
  analysis: string;
}

interface CompetitorLaunch {
  id: string;
  name: string;
  competitorName: string;
  launchType: string;
  status: string;
  messages: LaunchMessage[];
  analysisResult: string;
  createdAt: string;
}

const STORAGE_KEY = "competitor_launches";

const LAUNCH_TYPES = [
  "プロダクトローンチ",
  "エバーグリーン",
  "ウェビナー",
  "チャレンジ",
];

const PHASES: { value: LaunchMessage["phase"]; label: string }[] = [
  { value: "pre_pre", label: "プリプリローンチ" },
  { value: "pre", label: "プリローンチ" },
  { value: "launch", label: "ローンチ" },
  { value: "post", label: "ポストローンチ" },
];

const PHASE_BADGE_CLASSES: Record<LaunchMessage["phase"], string> = {
  pre_pre: "bg-gray-100 text-gray-600",
  pre: "bg-blue-100 text-blue-700",
  launch: "bg-purple-100 text-purple-700",
  post: "bg-green-100 text-green-700",
};

const PHASE_LABEL: Record<LaunchMessage["phase"], string> = {
  pre_pre: "プリプリローンチ",
  pre: "プリローンチ",
  launch: "ローンチ",
  post: "ポストローンチ",
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadLaunches(): CompetitorLaunch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLaunches(launches: CompetitorLaunch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(launches));
}

// ===== ソースタイプアイコン =====
function SourceIcon({ type }: { type: LaunchMessage["sourceType"] }) {
  if (type === "text") {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (type === "screenshot") {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  // url
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

// ===== メインページ =====
export default function LaunchAnalysisPage() {
  const [launches, setLaunches] = useState<CompetitorLaunch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 新規ローンチフォーム
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(LAUNCH_TYPES[0]);

  // メッセージ追加フォーム
  const [sourceTab, setSourceTab] = useState<LaunchMessage["sourceType"]>("text");
  const [msgText, setMsgText] = useState("");
  const [msgUrl, setMsgUrl] = useState("");
  const [msgImageUrl, setMsgImageUrl] = useState("");
  const [msgPhase, setMsgPhase] = useState<LaunchMessage["phase"]>("pre_pre");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 分析状態
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    setLaunches(loadLaunches());
    setLoaded(true);
  }, []);

  const selected = launches.find((l) => l.id === selectedId) ?? null;

  function updateLaunches(next: CompetitorLaunch[]) {
    setLaunches(next);
    saveLaunches(next);
  }

  function handleCreateLaunch() {
    if (!newCompetitor.trim() || !newName.trim()) return;
    const launch: CompetitorLaunch = {
      id: generateId(),
      name: newName.trim(),
      competitorName: newCompetitor.trim(),
      launchType: newType,
      status: "draft",
      messages: [],
      analysisResult: "",
      createdAt: new Date().toISOString(),
    };
    const next = [launch, ...launches];
    updateLaunches(next);
    setSelectedId(launch.id);
    setNewCompetitor("");
    setNewName("");
    setNewType(LAUNCH_TYPES[0]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMsgImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleAddMessage() {
    if (!selected) return;
    let rawContent = "";
    let imageUrl = "";

    if (sourceTab === "text") {
      if (!msgText.trim()) return;
      rawContent = msgText.trim();
    } else if (sourceTab === "screenshot") {
      if (!msgImageUrl) return;
      imageUrl = msgImageUrl;
      rawContent = "[screenshot]";
    } else {
      if (!msgUrl.trim()) return;
      rawContent = msgUrl.trim();
    }

    const nextOrder = selected.messages.length > 0
      ? Math.max(...selected.messages.map((m) => m.sequenceOrder)) + 1
      : 1;

    const msg: LaunchMessage = {
      id: generateId(),
      sourceType: sourceTab,
      rawContent,
      imageUrl,
      sequenceOrder: nextOrder,
      phase: msgPhase,
      sentAt: new Date().toISOString(),
      analysis: "",
    };

    const next = launches.map((l) =>
      l.id === selected.id ? { ...l, messages: [...l.messages, msg] } : l
    );
    updateLaunches(next);

    // reset form
    setMsgText("");
    setMsgUrl("");
    setMsgImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!selected || selected.messages.length === 0) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await fetch("/api/launch-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: selected.messages,
          launchType: selected.launchType,
          competitorName: selected.competitorName,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const next = launches.map((l) =>
        l.id === selected.id
          ? { ...l, analysisResult: data.analysisResult ?? data.result ?? JSON.stringify(data), status: "analyzed" }
          : l
      );
      updateLaunches(next);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "分析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDeleteLaunch(id: string) {
    const next = launches.filter((l) => l.id !== id);
    updateLaunches(next);
    if (selectedId === id) setSelectedId(null);
  }

  if (!loaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">競合ローンチ分析</h1>
        <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">競合ローンチ分析</h1>
        <p className="text-sm text-gray-500 mt-1">
          競合のローンチシーケンスを記録・分析します
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== 左パネル: ローンチ一覧 ===== */}
        <div className="lg:col-span-1 space-y-4">
          {/* 新規作成フォーム */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">新規ローンチ登録</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="競合名"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <input
                type="text"
                placeholder="ローンチ名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
              >
                {LAUNCH_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={handleCreateLaunch}
                disabled={!newCompetitor.trim() || !newName.trim()}
                className="w-full bg-accent text-white text-sm font-medium py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                作成
              </button>
            </div>
          </div>

          {/* ローンチ一覧 */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">ローンチ一覧</h2>
            {launches.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ローンチがありません</p>
            ) : (
              <div className="space-y-2">
                {launches.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                      selectedId === l.id
                        ? "border-accent bg-accent/5"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{l.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteLaunch(l.id); }}
                        className="text-gray-400 hover:text-red-500 text-xs ml-2 shrink-0"
                        aria-label="削除"
                      >
                        &times;
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{l.competitorName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{l.launchType}</span>
                      <span className="text-xs text-gray-400">{l.messages.length}件</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== 右パネル: 詳細・メッセージ追加 ===== */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">左のリストからローンチを選択するか、新規作成してください</p>
            </div>
          ) : (
            <>
              {/* ヘッダー */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{selected.launchType}</span>
                </div>
                <p className="text-sm text-gray-500">競合: {selected.competitorName}</p>
              </div>

              {/* メッセージ追加フォーム */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">メッセージを追加</h3>

                {/* ソースタブ */}
                <div className="flex gap-1 mb-4">
                  {([
                    { key: "text" as const, label: "テキスト" },
                    { key: "screenshot" as const, label: "スクリーンショット" },
                    { key: "url" as const, label: "URL" },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setSourceTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sourceTab === tab.key
                          ? "bg-accent text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 入力エリア */}
                {sourceTab === "text" && (
                  <textarea
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="メッセージ内容を入力..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none mb-3"
                  />
                )}
                {sourceTab === "screenshot" && (
                  <div className="mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {msgImageUrl && (
                      <img src={msgImageUrl} alt="プレビュー" className="mt-2 max-h-32 rounded-lg border border-gray-200" />
                    )}
                  </div>
                )}
                {sourceTab === "url" && (
                  <input
                    type="url"
                    value={msgUrl}
                    onChange={(e) => setMsgUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-3"
                  />
                )}

                {/* フェーズ選択 + 追加ボタン */}
                <div className="flex items-center gap-3">
                  <select
                    value={msgPhase}
                    onChange={(e) => setMsgPhase(e.target.value as LaunchMessage["phase"])}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
                  >
                    {PHASES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMessage}
                    className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* メッセージ一覧 */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    メッセージ一覧 ({selected.messages.length}件)
                  </h3>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || selected.messages.length === 0}
                    className="bg-accent text-white text-xs font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {analyzing ? "分析中..." : "AI分析を実行"}
                  </button>
                </div>

                {analysisError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {analysisError}
                  </div>
                )}

                {selected.messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">メッセージがありません</p>
                ) : (
                  <div className="space-y-2">
                    {selected.messages
                      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          {/* 順番 */}
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                            {msg.sequenceOrder}
                          </span>

                          {/* フェーズバッジ */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${PHASE_BADGE_CLASSES[msg.phase]}`}>
                            {PHASE_LABEL[msg.phase]}
                          </span>

                          {/* コンテンツプレビュー */}
                          <div className="flex-1 min-w-0">
                            {msg.sourceType === "screenshot" && msg.imageUrl ? (
                              <img src={msg.imageUrl} alt="スクリーンショット" className="max-h-20 rounded border border-gray-200" />
                            ) : (
                              <p className="text-sm text-gray-700 truncate">{msg.rawContent}</p>
                            )}
                          </div>

                          {/* ソースタイプアイコン */}
                          <span className="text-gray-400 shrink-0 mt-0.5">
                            <SourceIcon type={msg.sourceType} />
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 分析結果 */}
              {selected.analysisResult && (
                <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">分析結果</h3>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {selected.analysisResult}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
