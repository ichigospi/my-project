"use client";

// ⑧ 完成台本: 添削済みの台本を、文字を一切変えずにテロップ用（1テロップ＝最大2行×約25文字）に整える。
// 区切りは意味のまとまりと息継ぎ（読点・句点）。判断に迷った箇所は「確認が必要な箇所」として一覧にする。
import { useMemo, useState } from "react";
import type { ScriptProject } from "@/lib/project-store";
import { formatTelop } from "@/lib/telop-format";
import TarotCardGallery from "@/components/TarotCardGallery";

type Source = "reviewed" | "submitted" | "generated";

export default function StepFinal({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const allSources: { id: Source; label: string; text: string }[] = [
    { id: "reviewed", label: "添削済みの台本", text: project.reviewedScript || "" },
    { id: "submitted", label: "提出した台本", text: project.submittedScript || "" },
    { id: "generated", label: "生成した台本", text: project.generatedScript || "" },
  ];
  const sources = allSources.filter((s) => s.text.trim());
  const [source, setSource] = useState<Source>(sources[0]?.id || "reviewed");
  const [maxLineChars, setMaxLineChars] = useState(project.finalTelopOptions?.maxLineChars ?? 25);
  const [maxLines, setMaxLines] = useState(project.finalTelopOptions?.maxLines ?? 2);
  const [copied, setCopied] = useState(false);
  const [showIssues, setShowIssues] = useState(true);

  const sourceText = sources.find((s) => s.id === source)?.text || "";
  const result = useMemo(() => (sourceText ? formatTelop(sourceText, { maxLineChars, maxLines }) : null), [sourceText, maxLineChars, maxLines]);

  const save = () => {
    if (!result) return;
    onUpdate({
      ...project,
      finalTelop: result.text,
      finalTelopIssues: result.issues.map((i) => (i.index >= 0 ? `#${i.index + 1} ${i.reason}: ${i.text}` : i.reason)),
      finalTelopOptions: { maxLineChars, maxLines },
      finalTelopAt: new Date().toISOString(),
    });
  };
  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(project.title || "台本").replace(/[\\/:*?"<>|]/g, "_")}_完成台本.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (sources.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">⑧ 完成台本</h2>
        <p className="text-sm text-gray-500">整える台本がまだありません。台本出力か添削部屋で台本を作ってから来てください。</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">⑧ 完成台本</h2>
      <p className="text-sm text-gray-500 mb-4">
        台本の言葉は変えずに（言い換え・削除・追加なし。「。」「、」も残す）、意味のまとまりと息継ぎで、1テロップ＝最大{maxLines}行×{maxLineChars}文字程度に区切ります。
        単語の途中では改行しません。数字・固定の言い回し（5秒以内 等）は分けません。テロップごとに空行で区切って出力します。
      </p>

      {project.style === "tarot" && (
        <div className="max-w-3xl">
          <TarotCardGallery text={`${project.abstractLogic || ""}\n${project.structureProposal?.concept || ""}`} script={sourceText} />
        </div>
      )}

      {/* 設定 */}
      <div className="flex flex-wrap items-end gap-4 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">元にする台本</span>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white">
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}（{s.text.replace(/\s/g, "").length}字）</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">1行の文字数</span>
          <input type="number" min={10} max={60} value={maxLineChars} onChange={(e) => setMaxLineChars(Number(e.target.value) || 25)} className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">1テロップの最大行数</span>
          <input type="number" min={1} max={4} value={maxLines} onChange={(e) => setMaxLines(Number(e.target.value) || 2)} className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
        </label>
        {result && (
          <div className="text-xs text-gray-500 ml-auto">
            テロップ {result.count} 個
            <span className={`ml-2 px-2 py-0.5 rounded-full ${result.intact ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {result.intact ? "文字の一致を確認済み" : "文字が一致しません"}
            </span>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={copy} className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm hover:opacity-90">{copied ? "コピーしました" : "コピー"}</button>
            <button onClick={download} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">テキストで保存</button>
            <button onClick={save} className="px-3 py-1.5 rounded-lg border border-accent text-accent text-sm hover:bg-accent/5">この企画に保存</button>
            {project.finalTelopAt && <span className="text-xs text-gray-400 ml-2">保存済み: {new Date(project.finalTelopAt).toLocaleString("ja-JP")}</span>}
          </div>

          <div className="grid md:grid-cols-[1fr_320px] gap-4">
            <textarea readOnly value={result.text} className="w-full h-[560px] p-4 rounded-xl border border-gray-200 text-sm leading-6 font-sans bg-white" />

            <div className="bg-amber-50 rounded-xl border border-amber-100 p-3 h-[560px] overflow-y-auto">
              <button onClick={() => setShowIssues(!showIssues)} className="w-full flex items-center justify-between text-sm font-medium text-amber-800">
                <span>確認が必要な箇所（{result.issues.length}）</span>
                <span className="text-amber-400">{showIssues ? "▲" : "▼"}</span>
              </button>
              {showIssues && (
                result.issues.length === 0 ? (
                  <p className="text-xs text-amber-700 mt-2">判断に迷った箇所はありません。</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {result.issues.map((it, i) => (
                      <li key={i} className="text-xs text-amber-900 bg-white/70 rounded-lg p-2">
                        {it.index >= 0 && <span className="font-medium">#{it.index + 1}</span>} {it.reason}
                        {it.text && <div className="text-gray-600 mt-1 break-all">「{it.text}」</div>}
                      </li>
                    ))}
                  </ul>
                )
              )}
              <p className="text-[10px] text-amber-700/70 mt-3">#は上から数えたテロップの番号。言葉の途中で切れていないか、意味のまとまりとして自然かを確認してください</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
