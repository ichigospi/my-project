"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/channel-store";
import { getProfile, getAnalyses } from "@/lib/script-analysis-store";
import { getPresetFor } from "@/lib/project-store";
import { calcSimilarity } from "@/lib/similarity";
import type { ScriptProject, TelopLine } from "@/lib/project-store";

// マークダウン記法を除いた純粋なテキスト文字数
function pureTextLength(text: string): number {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/---+/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .length;
}

// セクション別文字数
function getSectionStats(text: string): { name: string; chars: number }[] {
  const sections: { name: string; chars: number }[] = [];
  const parts = text.split(/^## /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const name = lines[0]?.trim() || "（セクション名なし）";
    const body = lines.slice(1).join("\n");
    sections.push({ name, chars: pureTextLength(body) });
  }
  return sections;
}

// 推定動画尺（千代婆ベース: 後で調整、デフォルト250文字/分）
const CHARS_PER_MINUTE = 250;

export default function StepScript({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [generating, setGenerating] = useState(false);
  const [convertingTelop, setConvertingTelop] = useState(false);
  const [suggestingThumb, setSuggestingThumb] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [scriptHistory, setScriptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 一致率チェック
  const [similarities, setSimilarities] = useState<{ title: string; rate: number }[]>([]);

  useEffect(() => {
    if (!project.generatedScript) return;
    const allAnalyses = getAnalyses();
    const refs = allAnalyses.filter((a) => project.analyses.includes(a.id));
    const sims = refs
      .filter((a) => a.transcript)
      .map((a) => ({
        title: a.videoTitle,
        rate: Math.round(calcSimilarity(project.generatedScript, a.transcript) * 100),
      }));
    setSimilarities(sims);
  }, [project.generatedScript, project.analyses]);

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }
    if (!project.structureProposal) { setError("構成提案がありません"); return; }

    // 現在の台本を履歴に保存
    if (project.generatedScript) {
      setScriptHistory((prev) => [...prev, project.generatedScript]);
    }

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

  // 修正指示で台本を修正
  const handleRevise = async () => {
    if (!revisionNote.trim() || !project.generatedScript) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) { setError("AI APIキーを設定してください"); return; }

    setScriptHistory((prev) => [...prev, project.generatedScript]);
    setRevising(true);
    setError("");

    try {
      const res = await fetch("/api/script/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: project.generatedScript, revisionNote, aiApiKey }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else if (data.script) {
        onUpdate({ ...project, generatedScript: data.script });
        setRevisionNote("");
      }
    } catch { setError("修正に失敗"); }
    finally { setRevising(false); }
  };

  const handleRestoreHistory = (idx: number) => {
    if (project.generatedScript) {
      setScriptHistory((prev) => [...prev, project.generatedScript]);
    }
    onUpdate({ ...project, generatedScript: scriptHistory[idx] });
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
      if (data.telops) onUpdate({ ...project, telopScript: data.telops });
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
        body: JSON.stringify({ title: project.title, hooks: project.structureProposal?.suggestedHooks, script: project.generatedScript?.substring(0, 500), aiApiKey }),
      });
      const data = await res.json();
      if (data.texts) onUpdate({ ...project, thumbnailTexts: data.texts });
    } catch { setError("サムネ提案に失敗"); }
    finally { setSuggestingThumb(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(project.generatedScript); };
  const handleExport = () => {
    const header = `# ${project.title}\nジャンル: ${project.genre} / スタイル: ${project.style}\n作成日: ${new Date().toLocaleDateString("ja-JP")}\n\n---\n\n`;
    const blob = new Blob([header + project.generatedScript], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `台本-${project.title}-${new Date().toISOString().split("T")[0]}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const pureChars = project.generatedScript ? pureTextLength(project.generatedScript) : 0;
  const estimatedMinutes = Math.round(pureChars / CHARS_PER_MINUTE);
  const sections = project.generatedScript ? getSectionStats(project.generatedScript) : [];
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

          {/* 統計バー */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{pureChars}</p>
                <p className="text-xs text-gray-500">文字数（本文のみ）</p>
              </div>
              <div>
                <p className="text-2xl font-bold">約{estimatedMinutes}分</p>
                <p className="text-xs text-gray-500">推定動画尺</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{sections.length}</p>
                <p className="text-xs text-gray-500">セクション数</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${similarities.every((s) => s.rate <= 25) ? "text-green-600" : "text-red-500"}`}>
                  {similarities.length > 0 ? (similarities.every((s) => s.rate <= 25) ? "安全" : "要確認") : "—"}
                </p>
                <p className="text-xs text-gray-500">一致率チェック</p>
              </div>
            </div>

            {/* セクション別文字数 */}
            {sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">セクション別文字数</p>
                <div className="flex gap-1 items-end h-16">
                  {sections.map((s, i) => {
                    const maxChars = Math.max(...sections.map((x) => x.chars), 1);
                    const height = Math.max((s.chars / maxChars) * 100, 5);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${s.name}: ${s.chars}文字`}>
                        <span className="text-[10px] text-gray-400">{s.chars}</span>
                        <div className="w-full bg-accent/70 rounded-t" style={{ height: `${height}%` }} />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">{s.name.substring(0, 6)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 一致率詳細 */}
            {similarities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">参考台本との一致率（25%以下が安全圏）</p>
                <div className="space-y-1.5">
                  {similarities.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 flex-1 truncate">{s.title}</span>
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.rate <= 25 ? "bg-green-500" : s.rate <= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(s.rate, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${s.rate <= 25 ? "text-green-600" : s.rate <= 40 ? "text-yellow-600" : "text-red-500"}`}>
                        {s.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 台本本体 */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">{project.title}</h3>
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

          {/* 修正指示欄 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-accent/20">
            <h3 className="font-semibold text-sm mb-2">修正指示</h3>
            <div className="flex gap-3">
              <textarea value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="例: 冒頭のフックをもっと強くして / CTAの部分を予祝形式に変えて / 3セクション目を短くして"
                rows={2} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
              <button onClick={handleRevise} disabled={revising || !revisionNote.trim()}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 shrink-0 self-end">
                {revising ? "修正中..." : "修正する"}
              </button>
            </div>
          </div>

          {/* 修正履歴 */}
          {scriptHistory.length > 0 && (
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                <svg className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                修正履歴（{scriptHistory.length}件）
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2">
                  {scriptHistory.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                      <span className="text-xs text-gray-500">バージョン{i + 1} · {pureTextLength(s)}文字</span>
                      <button onClick={() => handleRestoreHistory(i)} className="text-xs text-accent hover:underline">復元</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    <button onClick={() => { const t = project.telopScript!.map((x) => x.text).join("\n"); navigator.clipboard.writeText(t); }} className="text-accent hover:underline">コピー</button>
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
