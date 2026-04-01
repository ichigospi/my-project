"use client";

import { useState, useEffect } from "react";
import {
  getTasks, saveTask, deleteTask, getMembers, saveMembers,
  genId, DEFAULT_STEPS, GENRE_LABELS, STYLE_LABELS, TASK_STATUS_LABELS,
} from "@/lib/project-store";
import type { ProductionTask, WorkflowStep, TaskStatus, Genre, Style } from "@/lib/project-store";

export default function WorkflowPage() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [members, setMembersState] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newMember, setNewMember] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newGenre, setNewGenre] = useState<Genre>("love");
  const [newStyle, setNewStyle] = useState<Style>("healing");
  const [newDeadline, setNewDeadline] = useState("");

  useEffect(() => {
    setTasks(getTasks());
    setMembersState(getMembers());
  }, []);

  // 新規動画追加
  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const task: ProductionTask = {
      id: genId(),
      title: newTitle,
      genre: newGenre,
      style: newStyle,
      steps: DEFAULT_STEPS.map((s) => ({ ...s, assignee: members[0] || "自分" })),
      deadline: newDeadline,
      publishUrl: "",
      linkedProjectId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(saveTask(task));
    setNewTitle("");
    setNewDeadline("");
    setShowNewForm(false);
  };

  // メンバー追加
  const handleAddMember = () => {
    if (!newMember.trim() || members.includes(newMember.trim())) return;
    const updated = [...members, newMember.trim()];
    saveMembers(updated);
    setMembersState(updated);
    setNewMember("");
  };

  const handleRemoveMember = (name: string) => {
    const updated = members.filter((m) => m !== name);
    saveMembers(updated);
    setMembersState(updated);
  };

  // 工程ステータス更新
  const updateStep = (taskId: string, stepIdx: number, updates: Partial<WorkflowStep>) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = task.steps.map((s, i) => i === stepIdx ? {
      ...s, ...updates,
      completedAt: updates.status === "completed" ? new Date().toISOString() : s.completedAt,
    } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  // 差し戻し（検収NG → 前工程を作業中に戻す）
  const handleReject = (taskId: string, stepIdx: number, memo: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = [...task.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], status: "rejected", memo };
    if (stepIdx > 0) newSteps[stepIdx - 1] = { ...newSteps[stepIdx - 1], status: "in_progress" };
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  // 進捗計算
  const getProgress = (task: ProductionTask) => {
    const done = task.steps.filter((s) => s.status === "completed").length;
    return Math.round((done / task.steps.length) * 100);
  };

  const getTaskStatus = (task: ProductionTask) => {
    if (task.steps.every((s) => s.status === "completed")) return "completed";
    if (task.steps.some((s) => s.status === "in_progress" || s.status === "rejected")) return "in_progress";
    return "not_started";
  };

  // フィルタ
  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    return getTaskStatus(t) === filter;
  });

  const statusCounts = {
    all: tasks.length,
    in_progress: tasks.filter((t) => getTaskStatus(t) === "in_progress").length,
    completed: tasks.filter((t) => getTaskStatus(t) === "completed").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">作業工程表</h1>
          <p className="text-gray-500 mt-1">完了 {statusCounts.completed}/{tasks.length}本 · 進行中 {statusCounts.in_progress}本</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMembers(!showMembers)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
            担当者管理
          </button>
          <button onClick={() => setShowNewForm(!showNewForm)}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
            + 新規動画を追加
          </button>
        </div>
      </div>

      {/* 担当者管理 */}
      {showMembers && (
        <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-semibold text-sm mb-3">担当者管理</h3>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newMember} onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              placeholder="名前を入力" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            <button onClick={handleAddMember} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90">追加</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm">
                {m}
                <button onClick={() => handleRemoveMember(m)} className="text-accent/50 hover:text-accent ml-1">&times;</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 新規追加フォーム */}
      {showNewForm && (
        <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-accent/20 mb-6">
          <h3 className="font-semibold text-sm mb-3">新規動画を追加</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="動画タイトル" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            <input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            <select value={newGenre} onChange={(e) => setNewGenre(e.target.value as Genre)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={newStyle} onChange={(e) => setNewStyle(e.target.value as Style)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {Object.entries(STYLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={handleCreate} disabled={!newTitle.trim()}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">追加</button>
        </div>
      )}

      {/* フィルタ */}
      <div className="flex gap-1 mb-4">
        {([["all", `全て（${statusCounts.all}）`], ["in_progress", `進行中（${statusCounts.in_progress}）`], ["completed", `完了（${statusCounts.completed}）`]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-lg text-sm ${filter === val ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* タスク一覧 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">動画がありません</p>
          <p className="text-sm mt-1">「+ 新規動画を追加」で始めましょう</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((task) => {
          const progress = getProgress(task);
          const status = getTaskStatus(task);
          const isExpanded = expanded === task.id;
          const currentStepIdx = task.steps.findIndex((s) => s.status !== "completed");

          return (
            <div key={task.id} className={`bg-card-bg rounded-xl shadow-sm border overflow-hidden ${
              status === "completed" ? "border-green-200" : status === "in_progress" ? "border-accent/30" : "border-gray-100"
            }`}>
              {/* ヘッダー */}
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : task.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${status === "completed" ? "bg-green-500" : status === "in_progress" ? "bg-accent" : "bg-gray-300"}`} />
                      <h3 className="font-semibold text-sm truncate">{task.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[task.genre]}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[task.style]}</span>
                      {task.deadline && <span className="text-xs text-gray-500">期限: {task.deadline}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-accent">{progress}%</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* ミニ工程バー */}
                <div className="flex gap-1 mt-3 ml-5">
                  {task.steps.map((step, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-full ${
                      step.status === "completed" ? "bg-green-500" :
                      step.status === "in_progress" ? "bg-accent" :
                      step.status === "rejected" ? "bg-red-400" :
                      "bg-gray-200"
                    }`} title={`${step.name}: ${TASK_STATUS_LABELS[step.status]}`} />
                  ))}
                </div>
              </div>

              {/* 展開エリア */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                  <div className="space-y-3">
                    {task.steps.map((step, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                        step.status === "completed" ? "bg-green-50" :
                        step.status === "in_progress" ? "bg-accent/5" :
                        step.status === "rejected" ? "bg-red-50" :
                        "bg-gray-50"
                      }`}>
                        {/* ステータスアイコン */}
                        <button onClick={() => {
                          const next: TaskStatus = step.status === "not_started" ? "in_progress" :
                            step.status === "in_progress" ? "completed" : "not_started";
                          updateStep(task.id, i, { status: next });
                        }} className="shrink-0 mt-0.5" title="クリックでステータス切替">
                          {step.status === "completed" && <span className="text-green-500 text-lg">✅</span>}
                          {step.status === "in_progress" && <span className="text-accent text-lg">🔵</span>}
                          {step.status === "rejected" && <span className="text-red-500 text-lg">🔴</span>}
                          {step.status === "not_started" && <span className="text-gray-300 text-lg">⬜</span>}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{step.isReview ? `✋ ${step.name}` : step.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              step.status === "completed" ? "bg-green-100 text-green-700" :
                              step.status === "in_progress" ? "bg-accent/10 text-accent" :
                              step.status === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>{TASK_STATUS_LABELS[step.status]}</span>
                          </div>

                          {/* 担当者 */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">担当:</span>
                            <select value={step.assignee} onChange={(e) => updateStep(task.id, i, { assignee: e.target.value })}
                              className="text-xs px-2 py-0.5 rounded border border-gray-200 outline-none">
                              {members.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                          {/* メモ */}
                          {(step.memo || step.isReview) && (
                            <input type="text" value={step.memo}
                              onChange={(e) => updateStep(task.id, i, { memo: e.target.value })}
                              placeholder={step.isReview ? "検収メモ（フィードバック等）" : "メモ"}
                              className="mt-1 w-full text-xs px-2 py-1 rounded border border-gray-200 outline-none focus:border-accent" />
                          )}

                          {/* 検収工程の差し戻しボタン */}
                          {step.isReview && step.status === "in_progress" && (
                            <button onClick={() => handleReject(task.id, i, step.memo || "要修正")}
                              className="mt-1 text-xs text-red-500 hover:underline">
                              差し戻し
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* フッター */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      {task.publishUrl ? (
                        <a href={task.publishUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">YouTube</a>
                      ) : (
                        <input type="text" placeholder="公開URLを貼り付け"
                          onBlur={(e) => { if (e.target.value) setTasks(saveTask({ ...task, publishUrl: e.target.value })); }}
                          className="text-xs px-2 py-1 rounded border border-gray-200 outline-none w-48" />
                      )}
                    </div>
                    <button onClick={() => { deleteTask(task.id); setTasks(getTasks()); }}
                      className="text-xs text-gray-400 hover:text-red-500">削除</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
