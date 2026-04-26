"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiKey, getChannels } from "@/lib/channel-store";
import { getIdeasByChannel, saveIdea, deleteIdea, getIdeaRules, saveIdeaRules, IDEA_STATUS_LABELS, type IdeaEntry, type IdeaRules, type IdeaStatus } from "@/lib/idea-store";
import { getHooksFor, getPerformanceRecords, GENRE_LABELS, STYLE_LABELS, genId, createProject, saveProject } from "@/lib/project-store";
import { useChannel } from "@/lib/channel-context";
import type { Genre, Style } from "@/lib/project-store";
import { pullSharedSettings, pushSharedSettings } from "@/lib/shared-sync";
import { getWinningPatterns } from "@/lib/winning-patterns-store";
import { formatNumber } from "@/lib/mock-data";

export default function IdeasPage() {
  const router = useRouter();
  const { activeChannel } = useChannel();
  const [tab, setTab] = useState<"list" | "suggest" | "rules">("list");
  const [ideas, setIdeas] = useState<IdeaEntry[]>([]);
  const [rules, setRulesState] = useState<IdeaRules>({ direction: "", constraints: "", priority: "", thumbnailPolicy: "", ngThemes: "" });
  const [filterGenre, setFilterGenre] = useState<Genre | "all">("all");
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "all">("all");

  // AI提案
  const [genre, setGenre] = useState<Genre>("money");
  const [style, setStyle] = useState<Style>("healing");
  const [promptText, setPromptText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<{ title: string; description: string; hooks: string[]; thumbnailWords: string[]; targetEmotion: string; estimatedPotential: string; sourceVideo: string; reason: string }[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    pullSharedSettings().then(() => {
      setIdeas(getIdeasByChannel(activeChannel?.id || ""));
      setRulesState(getIdeaRules());
    });
  }, [activeChannel]);

  // === 企画一覧 ===
  const filtered = ideas
    .filter((i) => filterGenre === "all" || i.genre === filterGenre)
    .filter((i) => filterStatus === "all" || i.status === filterStatus);

  const handleStatusChange = (id: string, status: IdeaStatus) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    setIdeas(saveIdea({ ...idea, status, updatedAt: new Date().toISOString() }));
    pushSharedSettings();
  };

  const handleDelete = (id: string) => {
    setIdeas(deleteIdea(id));
    pushSharedSettings();
  };

  const handleCreateProject = (idea: IdeaEntry) => {
    const p = createProject(idea.genre, idea.style, activeChannel?.id);
    p.title = idea.title;
    p.status = "references";
    saveProject(p);
    // 企画にプロジェクトIDを紐付け
    saveIdea({ ...idea, linkedProjectId: p.id, status: "adopted", updatedAt: new Date().toISOString() });
    pushSharedSettings();
    router.push("/create");
  };

  // === AI企画提案 ===
  const handleSuggest = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setSuggesting(true);
    setError("");
    try {
      const channels = getChannels().filter((ch) => ch.channelId);
      // 競合動画の取得
      let competitorVideos: { title: string; channel: string; views: number }[] = [];
      for (const ch of channels.slice(0, 3)) {
        try {
          const res = await fetch(`/api/youtube/videos?channelId=${ch.channelId}&apiKey=${encodeURIComponent(getApiKey("yt_api_key"))}&maxResults=10`);
          const data = await res.json();
          if (data.videos) {
            competitorVideos.push(...data.videos.map((v: { title: string; views: number }) => ({ title: v.title, channel: ch.name || ch.handle || "", views: v.views })));
          }
        } catch {}
      }
      competitorVideos.sort((a, b) => b.views - a.views);

      const perfRecords = getPerformanceRecords().filter((r) => r.genre === genre);
      const selfTopVideos = perfRecords.sort((a, b) => b.views - a.views).slice(0, 5).map((r) => `${r.title}（${r.views?.toLocaleString()}回再生）`);
      const hooks = getHooksFor(genre, style).slice(0, 5).map((h) => h.text);
      const wp = getWinningPatterns();

      const res = await fetch("/api/ideas/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre, style, prompt: promptText,
          competitorVideos: competitorVideos.slice(0, 15),
          selfTopVideos, hookPatterns: hooks.join(" / "),
          ideaRules: rules,
          winningPatterns: wp ? `最適構成: ${wp.bestStructure}, フック: ${wp.bestHookPattern}` : "",
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.retryable) { setError("API混雑中。少し待ってからリトライしてください。"); }
      else if (data.error) { setError(data.error); }
      else if (data.ideas) { setSuggestedIdeas(data.ideas); }
    } catch { setError("企画提案に失敗"); }
    finally { setSuggesting(false); }
  };

  const handleAdoptIdea = (suggested: typeof suggestedIdeas[0]) => {
    const idea: IdeaEntry = {
      id: genId(), title: suggested.title, genre, style, status: "idea",
      description: suggested.description, sourceVideos: [suggested.sourceVideo].filter(Boolean),
      sourceAnalysisIds: [], suggestedHooks: suggested.hooks || [],
      suggestedThumbnailWords: suggested.thumbnailWords || [],
      notes: `狙う感情: ${suggested.targetEmotion}\n理由: ${suggested.reason}`,
      channelId: activeChannel?.id || "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setIdeas(saveIdea(idea));
    pushSharedSettings();
  };

  // === ルール設定 ===
  const handleSaveRules = () => {
    saveIdeaRules(rules);
    pushSharedSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">企画出し</h1>
        <p className="text-gray-500 mt-1">競合分析＋AIで動画企画を立案</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {([["list", "企画一覧"], ["suggest", "AI企画提案"], ["rules", "企画ルール"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === id ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
            {label}{id === "list" ? `（${ideas.length}）` : ""}
          </button>
        ))}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* 企画一覧タブ */}
      {tab === "list" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value as Genre | "all")}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="all">全ジャンル</option>
              {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as IdeaStatus | "all")}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="all">全ステータス</option>
              {Object.entries(IDEA_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-sm text-gray-500 self-center">{filtered.length}件</span>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>企画がまだありません</p>
              <p className="text-sm mt-1">「AI企画提案」タブで企画を生成してください</p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((idea) => (
              <div key={idea.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{idea.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{idea.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[idea.genre]}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[idea.style]}</span>
                      <select value={idea.status} onChange={(e) => handleStatusChange(idea.id, e.target.value as IdeaStatus)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 ${
                          idea.status === "adopted" ? "bg-green-100 text-green-700" :
                          idea.status === "reviewing" ? "bg-yellow-100 text-yellow-700" :
                          idea.status === "rejected" ? "bg-gray-100 text-gray-500" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                        {Object.entries(IDEA_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      {idea.suggestedHooks?.length > 0 && (
                        <span className="text-xs text-gray-400">フック: {idea.suggestedHooks[0].substring(0, 20)}...</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!idea.linkedProjectId && (
                      <button onClick={() => handleCreateProject(idea)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90">
                        台本作成へ
                      </button>
                    )}
                    {idea.linkedProjectId && (
                      <span className="text-xs text-green-600 self-center">台本作成中</span>
                    )}
                    <button onClick={() => handleDelete(idea.id)}
                      className="text-gray-300 hover:text-danger">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI企画提案タブ */}
      {tab === "suggest" && (
        <div className="max-w-2xl">
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ジャンル</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">スタイル</label>
                <select value={style} onChange={(e) => setStyle(e.target.value as Style)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {Object.entries(STYLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">AIへの指示（任意）</label>
              <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                placeholder="例: 金運で今バズってるネタを提案して / もっとサムネ映えする企画を / 緊急性を煽る系で"
                rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent resize-none" />
            </div>
            <button onClick={handleSuggest} disabled={suggesting}
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50">
              {suggesting ? "提案中..." : "AIで企画を提案"}
            </button>
            <p className="text-xs text-gray-400">競合チャンネルの人気動画・自チャンネル実績・勝ちパターン・フックDBを自動参照します</p>
          </div>

          {suggestedIdeas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">提案された企画（{suggestedIdeas.length}件）</h3>
              {suggestedIdeas.map((s, i) => (
                <div key={i} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{s.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.thumbnailWords?.map((w, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{w}</span>
                        ))}
                      </div>
                      {s.hooks?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">フック: {s.hooks.join(" / ")}</p>
                      )}
                      {s.sourceVideo && (
                        <p className="text-xs text-gray-400 mt-0.5">参考: {s.sourceVideo}</p>
                      )}
                    </div>
                    <button onClick={() => handleAdoptIdea(s)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90 shrink-0">
                      保存
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 企画ルールタブ */}
      {tab === "rules" && (
        <div className="max-w-2xl">
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
            <p className="text-sm text-gray-500">AI企画提案時に自動適用されるルール</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">チャンネルの方向性</label>
              <textarea value={rules.direction} onChange={(e) => setRulesState({ ...rules, direction: e.target.value })}
                rows={3} placeholder="例: 音楽系ヒーリングに特化&#10;タロット系はやらない&#10;龍神・金運・開運がメインテーマ"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">企画の制約条件</label>
              <textarea value={rules.constraints} onChange={(e) => setRulesState({ ...rules, constraints: e.target.value })}
                rows={2} placeholder="例: 10分以内の動画を想定&#10;顔出しなし前提&#10;BGMと字幕メインの構成"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">重視する指標</label>
              <textarea value={rules.priority} onChange={(e) => setRulesState({ ...rules, priority: e.target.value })}
                rows={2} placeholder="例: CTR（クリック率）重視&#10;視聴維持率を最優先&#10;登録転換率も意識"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">サムネ・タイトルの方針</label>
              <textarea value={rules.thumbnailPolicy} onChange={(e) => setRulesState({ ...rules, thumbnailPolicy: e.target.value })}
                rows={2} placeholder="例: 数字を入れる&#10;限定感・緊急性を出す&#10;感情を煽るワードを使う"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NGテーマ</label>
              <textarea value={rules.ngThemes} onChange={(e) => setRulesState({ ...rules, ngThemes: e.target.value })}
                rows={2} placeholder="例: 政治的な内容&#10;他チャンネルの批判&#10;過度な不安煽り"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <button onClick={handleSaveRules}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
              {saved ? "保存しました！" : "ルールを保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
