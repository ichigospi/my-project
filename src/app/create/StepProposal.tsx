"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getAnalyses, getProfile } from "@/lib/script-analysis-store";
import { formatNumber } from "@/lib/mock-data";
import type { ScriptProject } from "@/lib/project-store";
import type { ScriptAnalysis } from "@/lib/script-analysis-store";

export default function StepProposal({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [skeleton, setSkeleton] = useState(project.structureProposal?.concept || "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [viewTab, setViewTab] = useState<"skeleton" | "analyses">("skeleton");
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    const all = getAnalyses();
    setAnalyses(all.filter((a) => project.analyses.includes(a.id)));
  }, [project.analyses]);

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/script/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses, style: project.style, topic: project.title,
          channelProfile: getProfile(), aiApiKey,
          userPrompt: promptText || undefined,
          currentSkeleton: skeleton || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.skeleton) {
        setSkeleton(data.skeleton);
        setPromptText("");
        // 骨組みテキストをproposalに保存
        onUpdate({
          ...project,
          structureProposal: {
            suggestedTitle: project.title,
            concept: data.skeleton,
            structure: [], keyElements: [],
            suggestedHooks: [], suggestedCtas: [],
            estimatedDuration: "", targetWordCount: 5000,
          },
        });
      }
    } catch { setError("構成提案に失敗"); }
    finally { setGenerating(false); }
  };

  // マークダウンを簡易HTML変換
  const renderMarkdown = (md: string) => {
    return md
      .split("\n")
      .map((line, i) => {
        // 見出し
        if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-5 mb-2 text-accent">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h4>;
        // 引用（参考元ブロック）
        if (line.startsWith("> ")) return <p key={i} className="pl-4 border-l-2 border-accent/30 text-sm text-gray-600 my-1">{line.slice(2)}</p>;
        // ボールド
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(2, -2)}</p>;
        // リスト
        if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-700 ml-4 list-disc my-0.5">{line.slice(2)}</li>;
        // 区切り線
        if (line.startsWith("---")) return <hr key={i} className="my-4 border-gray-200" />;
        // 空行
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // 通常テキスト
        return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
      });
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-2">⑤ 構成提案</h2>
      <p className="text-sm text-gray-500 mb-6">{analyses.length}本の分析を基に台本の骨組みを提案</p>

      {/* 参考動画サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {analyses.map((a) => (
          <div key={a.id} className="bg-card-bg rounded-lg p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-medium truncate">{a.videoTitle}</p>
            <p className="text-xs text-gray-500">{a.channelName} · スコア {a.score?.overall || "?"}/10</p>
            {a.analysisResult?.overallPattern && <p className="text-xs text-accent mt-1">{a.analysisResult.overallPattern}</p>}
          </div>
        ))}
      </div>

      {/* メインタブ: 骨組み / 参考動画の分析 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setViewTab("skeleton")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${viewTab === "skeleton" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          骨組み
        </button>
        <button onClick={() => setViewTab("analyses")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${viewTab === "analyses" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          参考動画の分析を見る（{analyses.length}本）
        </button>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {/* 参考動画の分析タブ */}
      {viewTab === "analyses" && (
        <div className="space-y-4 mb-6">
          {analyses.map((a) => (
            <div key={a.id} className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 flex gap-4 items-start bg-gray-50/50">
                {a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="w-28 h-16 rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{a.videoTitle}</p>
                  <p className="text-xs text-gray-500">{a.channelName} · {formatNumber(a.views)}回再生 · スコア {a.score?.overall || "?"}/10</p>
                </div>
              </div>

              {a.analysisResult && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-700">{a.analysisResult.summary}</p>

                  {/* 構成 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">構成パターン</p>
                    <p className="text-sm text-accent">{a.analysisResult.overallPattern}</p>
                  </div>

                  {/* フック・CTA */}
                  <div className="grid grid-cols-2 gap-3">
                    {a.analysisResult.hooks?.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <p className="text-xs font-medium text-red-700 mb-1">フック</p>
                        <ul className="space-y-0.5">{a.analysisResult.hooks.map((h, i) => <li key={i} className="text-xs text-gray-700">· {h}</li>)}</ul>
                      </div>
                    )}
                    {a.analysisResult.ctas?.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 mb-1">CTA</p>
                        <ul className="space-y-0.5">{a.analysisResult.ctas.map((c, i) => <li key={i} className="text-xs text-gray-700">· {c}</li>)}</ul>
                      </div>
                    )}
                  </div>

                  {/* 伸び要因・訴求 */}
                  <div className="grid grid-cols-2 gap-3">
                    {a.analysisResult.growthFactors?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-medium text-green-700 mb-1">伸び要因</p>
                        <ul className="space-y-0.5">{a.analysisResult.growthFactors.map((g, i) => <li key={i} className="text-xs text-gray-700">· {g}</li>)}</ul>
                      </div>
                    )}
                    {a.analysisResult.appealPoints?.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs font-medium text-purple-700 mb-1">訴求ポイント</p>
                        <ul className="space-y-0.5">{a.analysisResult.appealPoints.map((ap, i) => <li key={i} className="text-xs text-gray-700">· {ap}</li>)}</ul>
                      </div>
                    )}
                  </div>

                  {/* 台本テキスト */}
                  {a.transcript && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-500">台本テキスト（{a.transcript.length}文字）</p>
                        <button onClick={() => navigator.clipboard.writeText(a.transcript)} className="text-xs text-accent hover:underline">コピー</button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <pre className="text-xs leading-5 whitespace-pre-wrap font-sans text-gray-600">{a.transcript}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 骨組みタブ */}
      {viewTab === "skeleton" && (
        <>
          {/* 生成ボタン */}
          {!skeleton && (
            <button onClick={handleGenerate} disabled={generating}
              className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 mb-6">
              {generating ? "骨組みを生成中..." : "台本の骨組みを生成"}
            </button>
          )}

          {skeleton && (
            <div className="space-y-4 mb-6">
              {/* 表示/編集切り替え */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${!editing ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                    プレビュー
                  </button>
                  <button onClick={() => setEditing(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${editing ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                    編集
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleGenerate} disabled={generating}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
                    {generating ? "生成中..." : "再生成"}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(skeleton)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                    コピー
                  </button>
                </div>
              </div>

          {/* プレビューモード */}
          {!editing && (
            <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
              {renderMarkdown(skeleton)}
            </div>
          )}

          {/* 編集モード */}
          {editing && (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
              <textarea
                value={skeleton}
                onChange={(e) => {
                  setSkeleton(e.target.value);
                  if (project.structureProposal) {
                    onUpdate({
                      ...project,
                      structureProposal: { ...project.structureProposal, concept: e.target.value },
                    });
                  }
                }}
                rows={25}
                className="w-full px-6 py-4 text-sm leading-relaxed outline-none resize-y font-mono"
              />
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* プロンプト入力欄（AIへの指示） */}
      {skeleton && (
        <div className="mb-6">
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="text-xs font-medium text-gray-500 mb-2 block">AIへの指示（修正依頼・追加指示）</label>
            <div className="flex gap-2">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="例: フックをもっと強くして / オープニングを短くして / ヒーリングパートの前に共感セクションを入れて"
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent resize-none"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !promptText.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0 self-end"
              >
                {generating ? "生成中..." : "反映"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "analyzing" })}
          className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {skeleton && (
          <button onClick={() => onUpdate({ ...project, status: "script" })}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90">
            この骨組みで台本を作成 →
          </button>
        )}
      </div>
    </div>
  );
}
