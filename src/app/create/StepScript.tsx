"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getProfile } from "@/lib/script-analysis-store";
import { getPresetFor } from "@/lib/project-store";
import type { ScriptProject, TelopLine } from "@/lib/project-store";

export default function StepScript({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [generating, setGenerating] = useState(false);
  const [convertingTelop, setConvertingTelop] = useState(false);
  const [suggestingThumb, setSuggestingThumb] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!project.structureProposal) { setError("構成提案がありません"); return; }

    setGenerating(true);
    setError("");
    const preset = getPresetFor(project.genre, project.style);

    try {
      const res = await fetch("/api/script/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal: project.structureProposal,
          channelProfile: getProfile(),
          style: project.style,
          topic: project.title,
          additionalNotes: preset ? `【台本ルール】\n${preset.rules}\n\n【ベースプロンプト】\n${preset.prompt}\n\n【目標文字数】${preset.targetWordCount}文字\n\n【フックパターン】${preset.hookPattern}\n\n【CTAパターン】${preset.ctaPattern}` : "",
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.script) { onUpdate({ ...project, generatedScript: data.script, status: "completed" }); }
    } catch { setError("台本生成に失敗"); }
    finally { setGenerating(false); }
  };

  const handleConvertTelop = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey || !project.generatedScript) return;

    setConvertingTelop(true);
    try {
      const res = await fetch("/api/script/to-telop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: project.generatedScript, aiApiKey }),
      });
      const data = await res.json();
      if (data.telops) {
        onUpdate({ ...project, telopScript: data.telops });
      }
    } catch { setError("テロップ変換に失敗"); }
    finally { setConvertingTelop(false); }
  };

  const handleSuggestThumbnail = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) return;

    setSuggestingThumb(true);
    try {
      const res = await fetch("/api/script/thumbnail-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          hooks: project.structureProposal?.suggestedHooks,
          script: project.generatedScript?.substring(0, 500),
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.texts) { onUpdate({ ...project, thumbnailTexts: data.texts }); }
    } catch { setError("サムネ提案に失敗"); }
    finally { setSuggestingThumb(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(project.generatedScript); };

  const handleCopyTelop = () => {
    if (!project.telopScript) return;
    const text = project.telopScript.map((t) => t.text).join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleExport = () => {
    const header = `# ${project.title}\nジャンル: ${project.genre} / スタイル: ${project.style}\n作成日: ${new Date().toLocaleDateString("ja-JP")}\n\n---\n\n`;
    const blob = new Blob([header + project.generatedScript], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `台本-${project.title}-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSeconds = project.telopScript?.reduce((sum, t) => sum + t.displaySeconds, 0) || 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">⑥ 台本出力</h2>

      {!project.generatedScript && (
        <div className="text-center py-12">
          <button onClick={handleGenerate} disabled={generating}
            className="px-8 py-4 rounded-xl bg-accent text-white text-lg font-medium hover:bg-accent/90 disabled:opacity-50">
            {generating ? "台本を生成中..." : "台本を生成する"}
          </button>
        </div>
      )}

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {project.generatedScript && (
        <div className="space-y-6">
          {/* 台本本体 */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{project.title}</h3>
                <span className="text-xs text-gray-500">{project.generatedScript.length}文字</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">コピー</button>
                <button onClick={handleExport} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">エクスポート</button>
                <button onClick={handleGenerate} disabled={generating} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">
                  {generating ? "生成中..." : "再生成"}
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea value={project.generatedScript}
                onChange={(e) => onUpdate({ ...project, generatedScript: e.target.value })}
                rows={20} className="w-full text-sm leading-7 outline-none resize-y" />
            </div>
          </div>

          {/* ツール */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* テロップ変換 */}
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">テロップ形式</h3>
                <button onClick={handleConvertTelop} disabled={convertingTelop}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {convertingTelop ? "変換中..." : "テロップに変換"}
                </button>
              </div>
              {project.telopScript && (
                <>
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                    <span>{project.telopScript.length}テロップ · 約{Math.floor(totalSeconds / 60)}分{totalSeconds % 60}秒</span>
                    <button onClick={handleCopyTelop} className="text-accent hover:underline">コピー</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
                    {project.telopScript.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-gray-400 w-6 shrink-0 text-right">{t.displaySeconds}s</span>
                        <span className="text-gray-700">{t.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* サムネテキスト */}
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">サムネテキスト提案</h3>
                <button onClick={handleSuggestThumbnail} disabled={suggestingThumb}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50">
                  {suggestingThumb ? "提案中..." : "提案する"}
                </button>
              </div>
              {project.thumbnailTexts.length > 0 && (
                <div className="space-y-2">
                  {project.thumbnailTexts.map((t, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{t}</span>
                      <button onClick={() => navigator.clipboard.writeText(t)} className="text-xs text-accent hover:underline shrink-0 ml-2">コピー</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={() => onUpdate({ ...project, status: "proposal" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
      </div>
    </div>
  );
}
