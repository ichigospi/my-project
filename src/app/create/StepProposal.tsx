"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getAnalyses, getProfile } from "@/lib/script-analysis-store";
import { getPresetFor, getHooksFor, getCTAsFor } from "@/lib/project-store";
import type { ScriptProject, StructureProposal } from "@/lib/project-store";
import type { ScriptAnalysis } from "@/lib/script-analysis-store";

export default function StepProposal({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [analyses, setAnalyses] = useState<ScriptAnalysis[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const all = getAnalyses();
    setAnalyses(all.filter((a) => project.analyses.includes(a.id)));
  }, [project.analyses]);

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setGenerating(true);
    setError("");

    const preset = getPresetFor(project.genre, project.style);
    const hooks = getHooksFor(project.genre, project.style).slice(0, 5);
    const ctas = getCTAsFor(project.genre, project.style).slice(0, 5);

    try {
      const res = await fetch("/api/script/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses, style: project.style, topic: project.title,
          channelProfile: getProfile(), aiApiKey,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        const proposal: StructureProposal = {
          suggestedTitle: project.title,
          concept: data.concept || "",
          structure: data.structure || [],
          keyElements: data.keyElements || [],
          suggestedHooks: [...(data.suggestedHooks || []), ...hooks.map((h) => h.text)].slice(0, 5),
          suggestedCtas: [...(data.suggestedCtas || []), ...ctas.map((c) => c.text)].slice(0, 3),
          estimatedDuration: data.estimatedDuration || "10-15分",
          targetWordCount: preset?.targetWordCount || 5000,
        };
        onUpdate({ ...project, structureProposal: proposal });
      }
    } catch { setError("構成提案に失敗"); }
    finally { setGenerating(false); }
  };

  const proposal = project.structureProposal;

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-2">⑤ 構成提案</h2>
      <p className="text-sm text-gray-500 mb-6">{analyses.length}本の分析を基に構成を提案</p>

      {/* 分析サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {analyses.map((a) => (
          <div key={a.id} className="bg-card-bg rounded-lg p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-medium truncate">{a.videoTitle}</p>
            <p className="text-xs text-gray-500">{a.channelName} · スコア {a.score?.overall || "?"}/10</p>
            {a.analysisResult?.overallPattern && <p className="text-xs text-accent mt-1">{a.analysisResult.overallPattern}</p>}
          </div>
        ))}
      </div>

      {!proposal && (
        <button onClick={handleGenerate} disabled={generating}
          className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 mb-6">
          {generating ? "構成提案を生成中..." : "構成提案を生成"}
        </button>
      )}

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {proposal && (
        <div className="space-y-4 mb-6">
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2">コンセプト</h3>
            <p className="text-sm text-gray-700">{proposal.concept}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>推定尺: {proposal.estimatedDuration}</span>
              <span>目標: {proposal.targetWordCount}文字</span>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-4">構成</h3>
            {proposal.structure.map((s, i) => (
              <div key={i} className="flex gap-4 mb-3 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">{i + 1}</div>
                  {i < proposal.structure.length - 1 && <div className="w-0.5 flex-1 bg-accent/20 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="font-medium text-sm">{s.name} <span className="text-xs text-gray-400">{s.timeRange}</span></p>
                  <p className="text-xs text-gray-600">{s.description}</p>
                  <p className="text-xs text-accent/80 mt-0.5">→ {s.purpose}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <h4 className="text-xs font-medium text-green-700 mb-2">取り入れる要素</h4>
              <ul className="space-y-1">{proposal.keyElements.map((e, i) => <li key={i} className="text-xs text-gray-700">· {e}</li>)}</ul>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-100">
              <h4 className="text-xs font-medium text-red-700 mb-2">フック</h4>
              <ul className="space-y-1">{proposal.suggestedHooks.map((h, i) => <li key={i} className="text-xs text-gray-700">· {h}</li>)}</ul>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h4 className="text-xs font-medium text-blue-700 mb-2">CTA</h4>
              <ul className="space-y-1">{proposal.suggestedCtas.map((c, i) => <li key={i} className="text-xs text-gray-700">· {c}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => onUpdate({ ...project, status: "analyzing" })} className="px-6 py-3 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">← 戻る</button>
        {proposal && (
          <button onClick={() => onUpdate({ ...project, status: "script" })}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90">台本を生成 →</button>
        )}
      </div>
    </div>
  );
}
