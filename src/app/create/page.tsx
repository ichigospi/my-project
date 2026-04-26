"use client";

import { useState, useEffect } from "react";
import { getProjectsByChannel, saveProject, deleteProject, createProject, GENRE_LABELS, STYLE_LABELS, addTaskFromProject, updateTaskStepStatus } from "@/lib/project-store";
import type { ScriptProject, Genre, Style, ReviewStatus } from "@/lib/project-store";
import { pullSharedSettings, pushSharedSettings } from "@/lib/shared-sync";
import { useChannel } from "@/lib/channel-context";
import StepGenre from "./StepGenre";
import StepTitle from "./StepTitle";
import StepReferences from "./StepReferences";
import StepAnalyze from "./StepAnalyze";
import StepProposal from "./StepProposal";
import StepScript from "./StepScript";

const STEPS = [
  { id: "genre", label: "ジャンル" },
  { id: "title", label: "企画タイトル" },
  { id: "references", label: "参考動画" },
  { id: "analyzing", label: "分析" },
  { id: "proposal", label: "構成提案" },
  { id: "script", label: "台本出力" },
];

export default function CreatePage() {
  const { activeChannel } = useChannel();
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [activeProject, setActiveProject] = useState<ScriptProject | null>(null);

  useEffect(() => { pullSharedSettings().then(() => setProjects(getProjectsByChannel(activeChannel?.id || ""))); }, [activeChannel]);

  const handleNew = () => {
    const p = createProject("love", "healing", activeChannel?.id);
    p.status = "genre";
    saveProject(p);
    setActiveProject(p);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();
  };

  const handleResume = (p: ScriptProject) => { setActiveProject(p); };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();
  };

  const updateProject = (updated: ScriptProject) => {
    const prev = activeProject;
    saveProject(updated);
    setActiveProject(updated);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();

    // 工程表との自動連動
    if (updated.title && updated.status === "references" && prev?.status === "title") {
      // タイトル確定 → 工程表に追加+企画出し完了
      addTaskFromProject(updated.title, updated.genre, updated.style, updated.id);
      updateTaskStepStatus(updated.id, "企画出し", "completed");
    }
    if (updated.status === "script" && prev?.status === "proposal") {
      // 台本生成開始 → 台本作成を作業中に
      updateTaskStepStatus(updated.id, "台本作成", "in_progress");
    }
    if (updated.generatedScript && !prev?.generatedScript) {
      // 台本生成完了 → 台本作成を検収待ちに
      updateTaskStepStatus(updated.id, "台本作成", "review_waiting");
    }
  };

  const handleBack = () => { setActiveProject(null); setProjects(getProjectsByChannel(activeChannel?.id || "")); };

  const stepIndex = activeProject ? STEPS.findIndex((s) => s.id === activeProject.status) : -1;
  // completedの場合は最後のステップ扱い
  const effectiveStepIndex = stepIndex === -1 && activeProject?.status === "completed" ? STEPS.length - 1 : stepIndex;

  const goToStep = (status: ScriptProject["status"]) => {
    if (!activeProject) return;
    updateProject({ ...activeProject, status });
  };

  // プロジェクト一覧
  if (!activeProject) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">台本作成</h1>
            <p className="text-gray-500 mt-1">ウィザード形式で台本を作成</p>
          </div>
          <button onClick={handleNew} className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
            + 新規プロジェクト
          </button>
        </div>

        {projects.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">プロジェクトがありません</p>
            <p className="text-sm mt-1">「+ 新規プロジェクト」で台本作成を始めましょう</p>
          </div>
        )}

        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleResume(p)}>
                  <p className="font-semibold text-sm">{p.title || "（タイトル未定）"}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[p.genre]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[p.style]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {STEPS.find((s) => s.id === p.status)?.label || p.status}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                </div>
                <button onClick={() => handleResume(p)} className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors shrink-0">再開</button>
                <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-danger shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* 企画チェック */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {(!p.reviewStatus || p.reviewStatus === "none") && (
                  <button onClick={() => { saveProject({ ...p, reviewStatus: "pending" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                    className="px-3 py-1.5 rounded-lg text-xs border border-orange-300 text-orange-600 hover:bg-orange-50">
                    企画チェック依頼
                  </button>
                )}
                {p.reviewStatus === "pending" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">チェック待ち</span>
                    <select
                      value="pending"
                      onChange={(e) => {
                        const val = e.target.value as ReviewStatus;
                        const note = val === "rejected" ? prompt("差し戻し理由:") || "" : "";
                        saveProject({ ...p, reviewStatus: val, reviewNote: note });
                        setProjects(getProjectsByChannel(activeChannel?.id || ""));
                        pushSharedSettings();
                      }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                    >
                      <option value="pending">チェック待ち</option>
                      <option value="approved">承認</option>
                      <option value="rejected">差し戻し</option>
                      <option value="none">取り消し</option>
                    </select>
                  </>
                )}
                {p.reviewStatus === "approved" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">承認済み</span>
                    <button onClick={() => { saveProject({ ...p, reviewStatus: "none", reviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                      className="text-xs text-gray-400 hover:text-gray-600">リセット</button>
                  </>
                )}
                {p.reviewStatus === "rejected" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">差し戻し</span>
                    {p.reviewNote && <span className="text-xs text-red-500">{p.reviewNote}</span>}
                    <button onClick={() => { saveProject({ ...p, reviewStatus: "pending", reviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                      className="px-2 py-1 rounded text-xs border border-orange-300 text-orange-600 hover:bg-orange-50">
                      再依頼
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ウィザードビュー
  return (
    <div className="p-4 md:p-8">
      <button onClick={handleBack} className="text-accent text-sm font-medium mb-4 flex items-center gap-1 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        プロジェクト一覧
      </button>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => goToStep(s.id as ScriptProject["status"])}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                i === effectiveStepIndex ? "bg-accent text-white" : i < effectiveStepIndex ? "bg-accent/10 text-accent cursor-pointer hover:bg-accent/20" : i > effectiveStepIndex ? "bg-gray-100 text-gray-400" : ""
              }`}
              disabled={i > effectiveStepIndex}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i === effectiveStepIndex ? "bg-white/20" : i < effectiveStepIndex ? "bg-accent/20" : "bg-gray-200"
              }`}>{i < effectiveStepIndex ? "✓" : i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <svg className="w-4 h-4 text-gray-300 mx-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
          </div>
        ))}
      </div>

      {/* ステップ本体 */}
      {activeProject.status === "genre" && <StepGenre project={activeProject} onUpdate={updateProject} />}
      {activeProject.status === "title" && <StepTitle project={activeProject} onUpdate={updateProject} />}
      {activeProject.status === "references" && <StepReferences project={activeProject} onUpdate={updateProject} />}
      {activeProject.status === "analyzing" && <StepAnalyze project={activeProject} onUpdate={updateProject} />}
      {activeProject.status === "proposal" && <StepProposal project={activeProject} onUpdate={updateProject} />}
      {(activeProject.status === "script" || activeProject.status === "completed") && <StepScript project={activeProject} onUpdate={updateProject} />}
    </div>
  );
}
